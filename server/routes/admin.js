import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { store } from "../lib/store.js";
import { requireAdmin, requireAcceptedTerms } from "../lib/currentUser.js";
import { getLaunchChecklist } from "../lib/legal.js";
import { listApis, setNamedApi, API_SLOTS, listCustomApis, setCustomApi, deleteCustomApi } from "../lib/config.js";
import { DATA_DIR, BUNDLED_DATA_DIR } from "../lib/paths.js";
import { getLanIp } from "./../lib/network.js";

const router = Router();
router.use(requireAdmin, requireAcceptedTerms);

// One call for the whole admin dashboard: users incl. usage counts,
// configured APIs (masked), and system info.
router.get("/overview", (req, res) => {
  const users = store.collection("users");
  const accounts = store.collection("accounts");
  const txs = store.collection("transactions");
  const subs = store.collection("subscriptions");
  const analyses = store.collection("analyses");

  // Funnel & Kill-Kriterien (Produktplan 6.3/6.4): Analysen → Zahler-Konversion.
  const now = Date.now();
  const days30 = analyses.filter((a) => now - new Date(a.uploadedAt).getTime() < 30 * 86400000);
  const payers = users.filter((u) => u.billing?.plan && u.billing.plan !== "free");
  const funnel = {
    analysesTotal: analyses.length,
    analyses30d: days30.length,
    payers: payers.length,
    payersByPlan: payers.reduce((acc, u) => { acc[u.billing.plan] = (acc[u.billing.plan] || 0) + 1; return acc; }, {}),
    conversionPct: analyses.length > 0 ? Math.round((payers.length / analyses.length) * 1000) / 10 : null,
    killCriteria: {
      rule30d: "Nach 30 Tagen < 3 % Konversion trotz 500+ Analysen → Paywall/Preis testen",
      rule90d: "Nach 90 Tagen < 500 €/Monat → Wartungsmodus",
      status: analyses.length >= 500 && payers.length / analyses.length < 0.03
        ? "⚠ Kill-Kriterium 30d verletzt — Paywall-Position und Preis testen"
        : "OK (oder noch zu wenig Daten)",
    },
  };

  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      aiEnabled: Boolean(u.settings?.aiEnabled),
      plan: u.billing?.plan || "free",
      accounts: accounts.filter((a) => a.userId === u.id).length,
      transactions: txs.filter((t) => t.userId === u.id).length,
      subscriptions: subs.filter((s) => s.userId === u.id).length,
    })),
    apis: listApis(),
    customApis: listCustomApis(),
    funnel,
    stats: { users: users.length, accounts: accounts.length, transactions: txs.length, subscriptions: subs.length },
    launch: getLaunchChecklist(),
    system: {
      dataDir: DATA_DIR,
      port: Number(process.env.PORT || 8787),
      host: process.env.HOST || "0.0.0.0",
      lanIp: getLanIp(),
      node: process.version,
    },
  });
});

router.patch("/users/:id", (req, res) => {
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  if (req.body.name !== undefined) users[idx].name = String(req.body.name);
  if (req.body.role !== undefined) {
    // Never demote the last remaining admin — the admin area would lock out.
    const admins = users.filter((u) => u.role === "admin");
    if (users[idx].role === "admin" && req.body.role !== "admin" && admins.length === 1) {
      return res.status(400).json({ error: "Der letzte Admin kann nicht herabgestuft werden." });
    }
    users[idx].role = req.body.role === "admin" ? "admin" : "user";
  }
  if (req.body.aiEnabled !== undefined) {
    users[idx].settings = { ...users[idx].settings, aiEnabled: Boolean(req.body.aiEnabled) };
  }
  store.setCollection("users", users);
  res.json(users[idx]);
});

// Removes the user and everything that belongs to them.
router.delete("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "Du kannst dein eigenes Konto nicht löschen, während du es benutzt." });
  const users = store.collection("users");
  if (!users.some((u) => u.id === id)) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  store.setCollection("users", users.filter((u) => u.id !== id));
  store.setCollection("accounts", store.collection("accounts").filter((a) => a.userId !== id));
  store.setCollection("transactions", store.collection("transactions").filter((t) => t.userId !== id));
  store.setCollection("subscriptions", store.collection("subscriptions").filter((s) => s.userId !== id));
  res.status(204).end();
});

router.put("/apis/:name", (req, res) => {
  if (!API_SLOTS.some((s) => s.name === req.params.name)) return res.status(404).json({ error: "Unbekannter API-Slot." });
  const key = String(req.body?.key || "").trim();
  if (!key) return res.status(400).json({ error: "Kein Schlüssel übergeben." });
  setNamedApi(req.params.name, key);
  res.json({ ok: true, apis: listApis() });
});

router.delete("/apis/:name", (req, res) => {
  if (!API_SLOTS.some((s) => s.name === req.params.name)) return res.status(404).json({ error: "Unbekannter API-Slot." });
  setNamedApi(req.params.name, "");
  res.json({ ok: true, apis: listApis() });
});

// Free-form provider slots (Grok, DeepSeek, Base44, or anything else) —
// unlike /apis this isn't a fixed list, the admin names the provider.
router.post("/custom-apis", (req, res) => {
  const { name, key, baseUrl } = req.body || {};
  const id = String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id) return res.status(400).json({ error: "Name fehlt." });
  if (API_SLOTS.some((s) => s.name === id)) return res.status(400).json({ error: "Dieser Name ist bereits durch einen festen API-Slot belegt." });
  if (!String(key || "").trim()) return res.status(400).json({ error: "Kein Schlüssel übergeben." });
  setCustomApi(id, { label: String(name).trim(), key: String(key).trim(), baseUrl: baseUrl ? String(baseUrl).trim() : null });
  res.status(201).json({ ok: true, customApis: listCustomApis() });
});

router.delete("/custom-apis/:id", (req, res) => {
  deleteCustomApi(req.params.id);
  res.json({ ok: true, customApis: listCustomApis() });
});

// Resets the database back to the shipped demo dataset.
router.post("/reset", (req, res) => {
  const seedFile = path.join(BUNDLED_DATA_DIR, "db.seed.json");
  const dbFile = path.join(DATA_DIR, "db.json");
  fs.copyFileSync(seedFile, dbFile);
  res.json({ ok: true });
});

export default router;

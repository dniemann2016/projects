import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { store } from "../lib/store.js";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { BUNDLED_DATA_DIR } from "../lib/paths.js";

const providers = JSON.parse(fs.readFileSync(path.join(BUNDLED_DATA_DIR, "providers.json"), "utf8"));

const router = Router();

// Provider catalog is public (needed before a profile exists).
router.get("/providers", (req, res) => {
  res.json(providers);
});

router.use(requireUser, requireAcceptedTerms);

router.get("/", (req, res) => {
  res.json(store.collection("accounts").filter((a) => a.userId === req.user.id));
});

// All transactions of the current user (optionally per account via ?accountId=).
router.get("/transactions", (req, res) => {
  let txs = store.collection("transactions").filter((t) => t.userId === req.user.id);
  if (req.query.accountId) txs = txs.filter((t) => t.accountId === req.query.accountId);
  txs.sort((a, b) => b.date.localeCompare(a.date));
  res.json(txs);
});

// Connect a provider from the catalog. Real PSD2/OAuth needs aggregator API
// keys (admin area → APIs); until those are configured this creates the
// account in demo mode and data arrives via import.
router.post("/connect", (req, res) => {
  const { provider, label, iban } = req.body || {};
  const prov = providers.find((p) => p.id === provider);
  if (!prov) return res.status(400).json({ error: "Unbekannter Anbieter." });
  const accounts = store.collection("accounts");
  const account = {
    id: `acc-${Date.now()}`,
    userId: req.user.id,
    provider: prov.id,
    label: label || prov.name,
    iban: iban || null,
    status: "connected",
    connectedAt: new Date().toISOString().slice(0, 10),
  };
  accounts.push(account);
  store.setCollection("accounts", accounts);
  res.status(201).json(account);
});

router.post("/:id/disconnect", (req, res) => {
  const accounts = store.collection("accounts");
  const idx = accounts.findIndex((a) => a.id === req.params.id && a.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Konto nicht gefunden." });
  accounts[idx] = { ...accounts[idx], status: "disconnected" };
  store.setCollection("accounts", accounts);
  res.json(accounts[idx]);
});

router.delete("/:id", (req, res) => {
  const accounts = store.collection("accounts");
  const account = accounts.find((a) => a.id === req.params.id && a.userId === req.user.id);
  if (!account) return res.status(404).json({ error: "Konto nicht gefunden." });
  store.setCollection("accounts", accounts.filter((a) => a.id !== account.id));
  store.setCollection("transactions", store.collection("transactions").filter((t) => t.accountId !== account.id));
  res.status(204).end();
});

// Plain-algorithm statement import (no AI): accepts pasted text or CSV and
// extracts date / name / subject / IBAN / amount per line with regexes.
router.post("/:id/import", (req, res) => {
  const accounts = store.collection("accounts");
  const account = accounts.find((a) => a.id === req.params.id && a.userId === req.user.id);
  if (!account) return res.status(404).json({ error: "Konto nicht gefunden." });
  const text = String(req.body?.text || "");
  if (!text.trim()) return res.status(400).json({ error: "Kein Text übergeben." });

  const txs = store.collection("transactions");
  let nextId = Math.max(0, ...txs.map((t) => t.id)) + 1;
  const dateRe = /(\d{4}-\d{2}-\d{2})|(\d{1,2})\.(\d{1,2})\.(\d{2,4})/;
  const ibanRe = /\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{2,4}){2,8})\b/;
  const amountRe = /(-?\d{1,6}[.,]\d{2})\s*(?:€|EUR)?\s*$/;

  const imported = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const dm = line.match(dateRe);
    const am = line.match(amountRe);
    if (!dm || !am) continue;
    let date;
    if (dm[1]) date = dm[1];
    else {
      const yyyy = dm[4].length === 2 ? `20${dm[4]}` : dm[4];
      date = `${yyyy}-${dm[3].padStart(2, "0")}-${dm[2].padStart(2, "0")}`;
    }
    const amount = Number(am[1].replace(",", "."));
    const im = line.match(ibanRe);
    let rest = line.replace(dm[0], "").replace(am[0], "");
    if (im) rest = rest.replace(im[0], "");
    rest = rest.replace(/[;|,]{1,}/g, "  ").replace(/\s{2,}/g, "  ").trim();
    const [name, ...subjectParts] = rest.split("  ");
    imported.push({
      id: nextId++,
      accountId: account.id,
      userId: req.user.id,
      date,
      name: (name || "Unbekannt").trim(),
      iban: im ? im[1] : null,
      subject: subjectParts.join(" ").trim(),
      amount: amount > 0 && /lastschrift|abbuchung|abo/i.test(line) ? -amount : amount,
    });
  }

  if (imported.length === 0) {
    return res.status(400).json({ error: "Keine Umsätze erkannt. Erwartet pro Zeile: Datum, Name/Verwendungszweck und Betrag (z.B. \"15.06.2026  NETFLIX  -17,99\")." });
  }
  store.setCollection("transactions", [...txs, ...imported]);
  res.json({ imported: imported.length });
});

export default router;

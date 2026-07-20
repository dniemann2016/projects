import { Router } from "express";
import { store } from "../lib/store.js";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { billingPublicView } from "../lib/billingEngine.js";
import { hashPassword, verifyPassword, destroyUserSessions, createSession } from "../lib/auth.js";
import { TERMS_VERSION, acceptTermsForUser, termsPublicView } from "../lib/legal.js";

const router = Router();

router.get("/", requireUser, (req, res) => {
  const { id, name, role, emails, settings, createdAt } = req.user;
  res.json({
    id,
    name,
    role,
    emails: emails?.length ? emails : [""],
    settings: settings || { aiEnabled: false },
    createdAt,
    hasPassword: Boolean(req.user.passwordHash),
    billing: billingPublicView(req.user),
    ...termsPublicView(req.user),
  });
});

router.post("/accept-terms", requireUser, (req, res) => {
  if (req.body?.termsVersion !== TERMS_VERSION) {
    return res.status(400).json({ error: "AGB-Version veraltet — bitte Seite neu laden." });
  }
  if (!req.body?.termsAccepted) {
    return res.status(400).json({ error: "Zustimmung erforderlich." });
  }
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === req.user.id);
  Object.assign(users[idx], acceptTermsForUser());
  store.setCollection("users", users);
  res.json({ ok: true, ...termsPublicView(users[idx]) });
});

router.use(requireUser, requireAcceptedTerms);

router.put("/", (req, res) => {
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === req.user.id);
  users[idx] = {
    ...users[idx],
    name: req.body.name ?? users[idx].name,
    emails: req.body.emails?.length ? req.body.emails : users[idx].emails,
  };
  store.setCollection("users", users);
  const { id, name, role, emails, settings } = users[idx];
  res.json({ id, name, role, emails, settings });
});

// Per-user feature switches, e.g. { aiEnabled: true } — KI stays off until
// the user explicitly enables it here.
router.patch("/settings", (req, res) => {
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === req.user.id);
  users[idx].settings = { ...users[idx].settings, ...req.body };
  store.setCollection("users", users);
  res.json(users[idx].settings);
});

// Konto-Passwort setzen/ändern — schützt das Kundenkonto gegen Header-Spoofing.
router.post("/password", (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: "Neues Passwort braucht mindestens 8 Zeichen." });
  }
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === req.user.id);
  if (users[idx].passwordHash && !verifyPassword(currentPassword, users[idx].passwordHash)) {
    return res.status(401).json({ error: "Aktuelles Passwort ist falsch." });
  }
  users[idx].passwordHash = hashPassword(newPassword);
  store.setCollection("users", users);
  destroyUserSessions(req.user.id);
  const token = createSession(req.user.id);
  res.json({ ok: true, token });
});

// DSGVO „Alle Daten löschen" (Produktplan Screen 6): ein Klick, wirklich alles —
// Konto, Konten, Umsätze, Abos, Depot, Analyse-Metadaten, Sessions.
router.delete("/", (req, res) => {
  const id = req.user.id;
  const users = store.collection("users");
  const admins = users.filter((u) => u.role === "admin");
  if (req.user.role === "admin" && admins.length === 1) {
    return res.status(400).json({ error: "Der letzte Admin kann sich nicht selbst löschen — erst einen anderen Admin ernennen." });
  }
  store.setCollection("users", users.filter((u) => u.id !== id));
  store.setCollection("accounts", store.collection("accounts").filter((a) => a.userId !== id));
  store.setCollection("transactions", store.collection("transactions").filter((t) => t.userId !== id));
  store.setCollection("subscriptions", store.collection("subscriptions").filter((s) => s.userId !== id));
  store.setCollection("holdings", store.collection("holdings").filter((hd) => hd.userId !== id));
  store.setCollection("analyses", store.collection("analyses").filter((a) => a.userId !== id));
  destroyUserSessions(id);
  res.status(204).end();
});

export default router;

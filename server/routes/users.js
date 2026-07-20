import { Router } from "express";
import { store } from "../lib/store.js";
import {
  hashPassword, verifyPassword,
  createSession, destroySession,
  createChallenge, verifyChallenge,
  createPasswordReset, consumeReset,
} from "../lib/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { defaultBilling } from "../lib/billingConfig.js";
import { TERMS_VERSION, acceptTermsForUser, hasAcceptedTerms } from "../lib/legal.js";

const router = Router();

function publicUser(u) {
  return {
    id: u.id,
    loginName: u.loginName || null,
    name: u.name,
    email: (u.emails || [])[0] || "",
    role: u.role,
    twoFactorEnabled: u.twoFactorEnabled !== false,
    needsTermsAcceptance: !hasAcceptedTerms(u),
  };
}

function findUserByLogin(login) {
  const key = String(login || "").trim().toLowerCase();
  if (!key) return null;
  return store.collection("users").find((u) =>
    (u.loginName && u.loginName.toLowerCase() === key) ||
    (u.emails || []).some((e) => e && e.toLowerCase() === key) ||
    u.name.toLowerCase().replace(/\s+/g, "") === key.replace(/\s+/g, "")
  ) || null;
}

/** Alte Profil-Liste ist entfernt — nur Admin sieht Nutzer über /market/admin/users. */
router.get("/", (_req, res) => {
  res.status(403).json({ error: "Nutzerliste nur für Admin verfügbar — bitte einloggen." });
});

// Registrierung: Name + Benutzername + E-Mail + Passwort + AGB.
router.post("/", rateLimit({ windowMs: 60_000, max: 10 }), (req, res) => {
  const users = store.collection("users");
  const name = String(req.body?.name || "").trim().slice(0, 60);
  const loginName = String(req.body?.loginName || req.body?.username || "").trim().toLowerCase().slice(0, 40);
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 120);
  const password = String(req.body?.password || "");
  if (!name) return res.status(400).json({ error: "Name fehlt." });
  if (!loginName || !/^[a-z0-9_.-]{3,40}$/.test(loginName)) {
    return res.status(400).json({ error: "Benutzername: 3–40 Zeichen, nur a–z, 0–9, _ . -" });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Bitte gültige E-Mail eingeben." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Passwort braucht mindestens 8 Zeichen." });
  }
  if (users.some((u) => u.loginName && u.loginName.toLowerCase() === loginName)) {
    return res.status(409).json({ error: "Benutzername ist bereits vergeben." });
  }
  if (users.some((u) => (u.emails || []).some((e) => e && e.toLowerCase() === email))) {
    return res.status(409).json({ error: "E-Mail ist bereits registriert." });
  }
  if (!req.body?.termsAccepted) {
    return res.status(400).json({ error: "AGB müssen akzeptiert werden." });
  }
  if (req.body?.termsVersion !== TERMS_VERSION) {
    return res.status(400).json({ error: "AGB-Version veraltet — bitte Seite neu laden." });
  }

  const user = {
    id: Math.max(0, ...users.map((u) => u.id)) + 1,
    loginName,
    name,
    role: "user",
    createdAt: new Date().toISOString().slice(0, 10),
    emails: [email],
    settings: { aiEnabled: false },
    billing: defaultBilling(),
    passwordHash: hashPassword(password),
    demoPassword: null,
    twoFactorEnabled: true,
    ...acceptTermsForUser(),
  };
  users.push(user);
  store.setCollection("users", users);

  // Auto-Login nach Registrierung
  const token = createSession(user.id, { userAgent: req.headers["user-agent"], ip: req.ip });
  res.status(201).json({ ...publicUser(user), token });
});

// Login Schritt 1: Benutzername/E-Mail + Passwort → 2FA-Challenge oder direkt Token.
router.post("/login", rateLimit({ windowMs: 60_000, max: process.env.NODE_ENV === "production" ? 10 : 100, message: "Zu viele Login-Versuche — 1 Minute warten." }), (req, res) => {
  const { password, loginName, username, email } = req.body || {};
  const user = findUserByLogin(loginName || username || email);
  if (!user) return res.status(404).json({ error: "Kein Konto mit dieser Angabe gefunden." });
  if (!user.passwordHash) return res.status(400).json({ error: "Konto ohne Passwort — bitte Passwort setzen." });
  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Falsches Passwort." });
  }
  if (user.twoFactorEnabled === false) {
    const token = createSession(user.id, { userAgent: req.headers["user-agent"], ip: req.ip });
    return res.json({ ...publicUser(user), token });
  }
  const { token: challengeToken, code } = createChallenge(user.id, "login");
  res.json({
    twoFactorRequired: true,
    challengeToken,
    delivery: "email",
    hint: `Code an ${maskEmail(user.emails?.[0] || "")}`,
    demoCode: code, // In-App-Demo: Code direkt anzeigen. In Produktion entfernen.
  });
});

// Login Schritt 2: Challenge + Code → Session-Token.
router.post("/login/verify", rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  const { challengeToken, code } = req.body || {};
  const result = verifyChallenge(challengeToken, code);
  if (!result.ok) return res.status(401).json({ error: result.error });
  const user = store.collection("users").find((u) => u.id === result.userId);
  if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  const token = createSession(user.id, { userAgent: req.headers["user-agent"], ip: req.ip });
  res.json({ ...publicUser(user), token });
});

// Login-Code erneut anfordern
router.post("/login/resend", rateLimit({ windowMs: 60_000, max: 5 }), (req, res) => {
  const { challengeToken } = req.body || {};
  const list = store.collection("auth_challenges").filter((c) => c.expiresAt > Date.now());
  const ch = list.find((c) => c.token === challengeToken);
  if (!ch) return res.status(404).json({ error: "Ungültige oder abgelaufene Anfrage." });
  const { token, code } = createChallenge(ch.userId, ch.purpose);
  res.json({ challengeToken: token, demoCode: code, delivery: "email" });
});

// Passwort vergessen: Code anfordern
router.post("/forgot", rateLimit({ windowMs: 60_000, max: 5 }), (req, res) => {
  const user = findUserByLogin(req.body?.loginName || req.body?.email);
  if (!user) {
    // Immer OK zurückgeben, um Nutzer-Enumeration zu verhindern.
    return res.json({ ok: true, hint: "Falls das Konto existiert, wurde ein Code gesendet." });
  }
  const { token, code } = createPasswordReset(user.id);
  res.json({ ok: true, resetToken: token, demoCode: code, hint: `Code an ${maskEmail(user.emails?.[0] || "")}` });
});

// Passwort zurücksetzen: Token + Code + neues Passwort
router.post("/reset", rateLimit({ windowMs: 60_000, max: 10 }), (req, res) => {
  const { resetToken, code, password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ error: "Neues Passwort: min. 8 Zeichen." });
  const r = consumeReset(resetToken, code, password);
  if (!r.ok) return res.status(400).json({ error: r.error });
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) destroySession(auth.slice(7));
  res.json({ ok: true });
});

function maskEmail(email) {
  if (!email) return "…";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export default router;

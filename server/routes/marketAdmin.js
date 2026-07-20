import { Router } from "express";
import { requireAdmin } from "../lib/currentUser.js";
import { store } from "../lib/store.js";
import { marketStore } from "../lib/marketStore.js";
import { destroyUserSessions, hashPassword } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

/** Übersicht aller Nutzer mit Kennzahlen. */
router.get("/users", (_req, res) => {
  const users = store.collection("users");
  const profiles = marketStore.profiles();
  const projects = marketStore.projects();
  const teams = marketStore.teams();
  const teamMembers = marketStore.teamMembers();
  const offers = marketStore.offers();
  const sessions = store.collection("sessions");

  res.json(users.map((u) => {
    const prof = profiles.find((p) => p.userId === u.id);
    const owned = projects.filter((p) => p.ownerId === u.id).length;
    const assigned = projects.filter((p) => p.assignedTo === u.id).length;
    const teamsOwned = teams.filter((t) => t.ownerId === u.id).length;
    const teamsMember = teamMembers.filter((m) => m.userId === u.id).length;
    const offersCount = offers.filter((o) => o.sellerUserId === u.id).length;
    const activeSession = sessions.find((s) => s.userId === u.id && s.expiresAt > Date.now());
    return {
      id: u.id,
      loginName: u.loginName || null,
      name: u.name,
      role: u.role,
      email: (u.emails || [])[0] || "",
      hasPassword: Boolean(u.passwordHash),
      demoPassword: u.demoPassword || (u.passwordHash ? "••••••" : "—"),
      twoFactorEnabled: u.twoFactorEnabled !== false,
      headline: prof?.headline || "",
      rank: prof?.rank || null,
      verified: prof?.verified || false,
      createdAt: u.createdAt,
      lastSeen: activeSession?.lastSeenAt || null,
      counts: { owned, assigned, teamsOwned, teamsMember, offers: offersCount },
    };
  }));
});

/** Vollständiges Detail-Bild eines Nutzers — für die Admin-Detail-Ansicht. */
router.get("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const user = store.collection("users").find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  const prof = marketStore.profiles().find((p) => p.userId === id) || null;
  const projects = marketStore.projects();
  const teamMembers = marketStore.teamMembers();
  const teams = marketStore.teams();
  const teamIds = teamMembers.filter((m) => m.userId === id).map((m) => m.teamId);
  const bids = marketStore.bids().filter((b) => b.bidderId === id);
  const offers = marketStore.offers().filter((o) => o.sellerUserId === id);
  const reviews = marketStore.reviews().filter((r) => r.subjectUserId === id);
  const sessions = store.collection("sessions").filter((s) => s.userId === id && s.expiresAt > Date.now());

  res.json({
    account: {
      id: user.id,
      loginName: user.loginName || null,
      name: user.name,
      role: user.role,
      email: (user.emails || [])[0] || "",
      hasPassword: Boolean(user.passwordHash),
      demoPassword: user.demoPassword || null,
      twoFactorEnabled: user.twoFactorEnabled !== false,
      createdAt: user.createdAt,
      settings: user.settings || {},
      billing: user.billing || {},
      terms: {
        accepted: Boolean(user.termsAcceptedAt),
        version: user.termsVersion || null,
      },
    },
    profile: prof,
    projectsOwned: projects.filter((p) => p.ownerId === id),
    projectsAssigned: projects.filter((p) => p.assignedTo === id),
    teamsOwned: teams.filter((t) => t.ownerId === id),
    teamsMember: teams.filter((t) => teamIds.includes(t.id) && t.ownerId !== id),
    offers,
    bids,
    reviews,
    sessions: sessions.map((s) => ({
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      userAgent: s.userAgent || "",
      ip: s.ip || "",
    })),
  });
});

/** Passwort zurücksetzen (Admin-Aktion, im Klartext an Admin zurück). */
router.post("/users/:id/reset-password", (req, res) => {
  const id = Number(req.params.id);
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  const newPw = req.body?.password || generateTempPassword();
  users[idx].passwordHash = hashPassword(newPw);
  users[idx].demoPassword = newPw;
  store.setCollection("users", users);
  destroyUserSessions(id);
  res.json({ ok: true, password: newPw });
});

/** 2FA an-/ausschalten (Admin-Override). */
router.post("/users/:id/two-factor", (req, res) => {
  const id = Number(req.params.id);
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  users[idx].twoFactorEnabled = req.body?.enabled !== false;
  store.setCollection("users", users);
  res.json({ ok: true, twoFactorEnabled: users[idx].twoFactorEnabled });
});

/** Rolle setzen. */
router.post("/users/:id/role", (req, res) => {
  const id = Number(req.params.id);
  const role = req.body?.role === "admin" ? "admin" : "user";
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  users[idx].role = role;
  store.setCollection("users", users);
  res.json({ ok: true, role });
});

/** Nutzer löschen (+ Session-Cleanup). */
router.delete("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "Eigenes Konto nicht löschbar." });
  const users = store.collection("users").filter((u) => u.id !== id);
  store.setCollection("users", users);
  destroyUserSessions(id);
  res.json({ ok: true });
});

/** Alle Sessions eines Nutzers beenden. */
router.post("/users/:id/logout-all", (req, res) => {
  destroyUserSessions(Number(req.params.id));
  res.json({ ok: true });
});

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export default router;

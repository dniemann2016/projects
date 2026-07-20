import crypto from "node:crypto";
import { store } from "./store.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 Tage
const CHALLENGE_TTL_MS = 1000 * 60 * 10; // 10 Minuten
const RESET_TTL_MS = 1000 * 60 * 30; // 30 Minuten

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const check = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, "hex");
  return check.length === expected.length && crypto.timingSafeEqual(check, expected);
}

export function createSession(userId, meta = {}) {
  const sessions = store.collection("sessions").filter((s) => s.expiresAt > Date.now());
  const token = crypto.randomBytes(32).toString("hex");
  sessions.push({
    token, userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    lastSeenAt: Date.now(),
    userAgent: meta.userAgent || "",
    ip: meta.ip || "",
  });
  store.setCollection("sessions", sessions);
  return token;
}

export function resolveSession(token) {
  if (!token) return null;
  const sessions = store.collection("sessions");
  const session = sessions.find((s) => s.token === token && s.expiresAt > Date.now());
  if (!session) return null;
  session.lastSeenAt = Date.now();
  store.setCollection("sessions", sessions);
  return session.userId;
}

export function destroySession(token) {
  store.setCollection("sessions", store.collection("sessions").filter((s) => s.token !== token));
}

export function destroyUserSessions(userId) {
  store.setCollection("sessions", store.collection("sessions").filter((s) => s.userId !== userId));
}

/** 6-stelliger 2FA-Code (Demo: E-Mail-Simulation). */
export function createChallenge(userId, purpose = "login") {
  const list = store.collection("auth_challenges").filter((c) => c.expiresAt > Date.now());
  const token = crypto.randomBytes(24).toString("hex");
  const code = String(crypto.randomInt(100000, 999999));
  list.push({
    token, userId, code, purpose,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    attempts: 0,
  });
  store.setCollection("auth_challenges", list);
  return { token, code };
}

export function verifyChallenge(token, code) {
  const list = store.collection("auth_challenges").filter((c) => c.expiresAt > Date.now());
  const idx = list.findIndex((c) => c.token === token);
  if (idx === -1) return { ok: false, error: "Code abgelaufen — bitte neu anfordern." };
  const ch = list[idx];
  ch.attempts += 1;
  if (ch.attempts > 5) {
    list.splice(idx, 1);
    store.setCollection("auth_challenges", list);
    return { ok: false, error: "Zu viele Versuche — Code ungültig." };
  }
  if (String(code).trim() !== ch.code) {
    store.setCollection("auth_challenges", list);
    return { ok: false, error: "Falscher Code." };
  }
  list.splice(idx, 1);
  store.setCollection("auth_challenges", list);
  return { ok: true, userId: ch.userId, purpose: ch.purpose };
}

export function createPasswordReset(userId) {
  const list = store.collection("auth_resets").filter((r) => r.expiresAt > Date.now());
  const token = crypto.randomBytes(32).toString("hex");
  const code = String(crypto.randomInt(100000, 999999));
  list.push({ token, userId, code, createdAt: Date.now(), expiresAt: Date.now() + RESET_TTL_MS });
  store.setCollection("auth_resets", list);
  return { token, code };
}

export function consumeReset(token, code, newPassword) {
  const list = store.collection("auth_resets").filter((r) => r.expiresAt > Date.now());
  const idx = list.findIndex((r) => r.token === token);
  if (idx === -1) return { ok: false, error: "Reset-Anfrage abgelaufen." };
  if (String(code).trim() !== list[idx].code) return { ok: false, error: "Falscher Code." };
  const userId = list[idx].userId;
  list.splice(idx, 1);
  store.setCollection("auth_resets", list);
  const users = store.collection("users");
  const uIdx = users.findIndex((u) => u.id === userId);
  if (uIdx === -1) return { ok: false, error: "Nutzer nicht gefunden." };
  users[uIdx].passwordHash = hashPassword(newPassword);
  users[uIdx].demoPassword = newPassword;
  store.setCollection("users", users);
  destroyUserSessions(userId);
  return { ok: true, userId };
}

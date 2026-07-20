import { store } from "./store.js";
import { resolveSession } from "./auth.js";
import { hasAcceptedTerms, TERMS_VERSION } from "./legal.js";

/**
 * Auth: Nur Bearer-Session-Token. Legacy `x-user-id`-Header wird nur noch für
 * passwortlose Demo-Profile toleriert (Skripte). Admins können via
 * `x-impersonate-user` einen Nutzer imitieren.
 */
export function currentUser(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const sessionUserId = resolveSession(auth.slice(7));
    if (!sessionUserId) return null;
    const sessionUser = store.collection("users").find((u) => u.id === sessionUserId) || null;
    if (!sessionUser) return null;

    const impersonateId = Number(req.headers["x-impersonate-user"] || 0);
    if (impersonateId && sessionUser.role === "admin" && impersonateId !== sessionUser.id) {
      const target = store.collection("users").find((u) => u.id === impersonateId);
      if (target) {
        req._impersonatedBy = sessionUser.id;
        return target;
      }
    }
    return sessionUser;
  }
  const id = Number(req.headers["x-user-id"] || 0);
  if (!id) return null;
  const user = store.collection("users").find((u) => u.id === id) || null;
  if (user?.passwordHash) return null;
  return user;
}

export function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Nicht angemeldet — bitte einloggen." });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Nicht angemeldet." });
  const sessionUserId = resolveSession(auth.slice(7));
  if (!sessionUserId) return res.status(401).json({ error: "Session ungültig." });
  const sessionUser = store.collection("users").find((u) => u.id === sessionUserId);
  if (!sessionUser || sessionUser.role !== "admin") return res.status(403).json({ error: "Nur für Admin-Konten." });
  req.user = sessionUser;
  next();
}

export function requireAcceptedTerms(req, res, next) {
  if (!hasAcceptedTerms(req.user)) {
    return res.status(403).json({
      error: "Bitte AGB akzeptieren, um fortzufahren.",
      code: "TERMS_REQUIRED",
      termsVersion: TERMS_VERSION,
    });
  }
  next();
}

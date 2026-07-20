import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";
import {
  listProvidersForClient,
  activeProviderId,
  createVerificationSession,
  completeDemoStep,
} from "../lib/verificationProviders.js";

const router = Router();

function syncProfileVerification(userId, verification) {
  const profiles = marketStore.profiles();
  const idx = profiles.findIndex((p) => p.userId === userId);
  if (idx === -1) return;
  profiles[idx].verified = verification.status === "verified";
  profiles[idx].verificationTier = verification.status === "verified" ? "full" : null;
  profiles[idx].updatedAt = new Date().toISOString();
  marketStore.setProfiles(profiles);
}

router.get("/providers", (_req, res) => {
  res.json({
    active: activeProviderId(),
    providers: listProvidersForClient(),
    disclaimer:
      "Die Identitätsprüfung erfolgt über einen externen Anbieter. Projects speichert keine Ausweiskopien — nur das Prüfergebnis.",
  });
});

router.get("/me", requireUser, requireAcceptedTerms, (req, res) => {
  const v = marketStore.verifications().find((x) => x.userId === req.user.id);
  res.json(v || { userId: req.user.id, status: "none", provider: null, checks: {} });
});

router.post("/start", requireUser, requireAcceptedTerms, async (req, res) => {
  const { providerId } = req.body || {};
  const all = marketStore.verifications();
  const existing = all.find((x) => x.userId === req.user.id);
  if (existing?.status === "verified") {
    return res.status(400).json({ error: "Profil ist bereits verifiziert." });
  }

  const session = await createVerificationSession({
    userId: req.user.id,
    userName: req.user.name,
    providerId,
  });

  const record = {
    userId: req.user.id,
    provider: session.provider,
    status: session.status,
    sessionId: session.sessionId,
    redirectUrl: session.redirectUrl || null,
    demoSteps: session.demoSteps || null,
    checks: { idDocument: false, liveness: false, video: false },
    createdAt: new Date().toISOString(),
    verifiedAt: null,
    rejectReason: null,
  };

  const idx = all.findIndex((x) => x.userId === req.user.id);
  if (idx === -1) all.push(record);
  else all[idx] = { ...all[idx], ...record };
  marketStore.setVerifications(all);

  res.json({
    ...record,
    message: session.message,
    demoSteps: session.demoSteps,
  });
});

/** Demo-Modus: einzelnen Schritt abschließen (Ausweis / Video). */
router.post("/demo-step", requireUser, requireAcceptedTerms, (req, res) => {
  const { stepId } = req.body || {};
  const all = marketStore.verifications();
  const idx = all.findIndex((x) => x.userId === req.user.id);
  if (idx === -1) return res.status(400).json({ error: "Keine laufende Verifizierung." });
  if (all[idx].provider !== "demo") {
    return res.status(400).json({ error: "Nur im Demo-Modus verfügbar. Externe Anbieter nutzen die Weiterleitung." });
  }

  const updated = completeDemoStep(all[idx], stepId);
  all[idx] = updated;
  marketStore.setVerifications(all);
  if (updated.status === "verified") syncProfileVerification(req.user.id, updated);

  res.json(updated);
});

/** Webhook-Stub für externe Anbieter (Persona/Veriff/Onfido). */
router.post("/webhook", (req, res) => {
  const { userId, status, sessionId, checks, rejectReason } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId fehlt" });

  const all = marketStore.verifications();
  const idx = all.findIndex((x) => x.userId === Number(userId));
  const record = {
    userId: Number(userId),
    status: status || "verified",
    sessionId: sessionId || `wh_${Date.now()}`,
    checks: checks || { idDocument: true, liveness: true, video: true },
    verifiedAt: status === "verified" ? new Date().toISOString() : null,
    rejectReason: rejectReason || null,
    updatedAt: new Date().toISOString(),
  };
  if (idx === -1) all.push({ ...record, provider: activeProviderId(), createdAt: record.updatedAt });
  else all[idx] = { ...all[idx], ...record };
  marketStore.setVerifications(all);
  if (record.status === "verified") syncProfileVerification(Number(userId), record);

  res.json({ ok: true });
});

export default router;

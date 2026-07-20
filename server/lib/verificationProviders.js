/**
 * Identitätsprüfung — Ausweis + Video/Liveness über externe Anbieter.
 * Konfiguration per .env; ohne Keys läuft Demo-Modus für Entwicklung.
 */

export const VERIFICATION_PROVIDERS = [
  {
    id: "persona",
    name: "Persona",
    description: "Ausweis-Scan + Selfie-Video, KYC/AML-konform.",
    docsUrl: "https://withpersona.com/",
    envKey: "PERSONA_API_KEY",
    supports: ["id_document", "liveness", "video"],
  },
  {
    id: "veriff",
    name: "Veriff",
    description: "Video-Ident mit Ausweis und Gesichtserkennung.",
    docsUrl: "https://www.veriff.com/",
    envKey: "VERIFF_API_KEY",
    supports: ["id_document", "liveness", "video"],
  },
  {
    id: "onfido",
    name: "Onfido",
    description: "Dokument + Motion-Liveness-Check.",
    docsUrl: "https://onfido.com/",
    envKey: "ONFIDO_API_KEY",
    supports: ["id_document", "liveness", "video"],
  },
  {
    id: "demo",
    name: "Demo (lokal)",
    description: "Simuliert den Verifizierungsablauf ohne externen Anbieter.",
    docsUrl: null,
    envKey: null,
    supports: ["id_document", "liveness", "video"],
  },
];

export function activeProviderId() {
  const configured = process.env.VERIFICATION_PROVIDER;
  if (configured && VERIFICATION_PROVIDERS.some((p) => p.id === configured)) return configured;
  for (const p of VERIFICATION_PROVIDERS) {
    if (p.envKey && process.env[p.envKey]) return p.id;
  }
  return "demo";
}

export function listProvidersForClient() {
  return VERIFICATION_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    docsUrl: p.docsUrl,
    available: p.id === "demo" || Boolean(p.envKey && process.env[p.envKey]),
    supports: p.supports,
  }));
}

/** Startet eine Verifizierungssitzung beim gewählten Anbieter. */
export async function createVerificationSession({ userId, userName, providerId }) {
  const provider = providerId || activeProviderId();
  const sessionId = `vs_${userId}_${Date.now()}`;

  if (provider === "persona" && process.env.PERSONA_API_KEY) {
    // Produktion: Persona Inquiry API aufrufen
    return {
      provider,
      sessionId,
      status: "pending",
      redirectUrl: process.env.PERSONA_INQUIRY_URL || `https://withpersona.com/verify?reference=${sessionId}`,
      message: "Weiterleitung zu Persona — Ausweis und Video aufnehmen.",
    };
  }

  if (provider === "veriff" && process.env.VERIFF_API_KEY) {
    return {
      provider,
      sessionId,
      status: "pending",
      redirectUrl: process.env.VERIFF_SESSION_URL || `https://magic.veriff.me/v/${sessionId}`,
      message: "Weiterleitung zu Veriff — Ausweis und Gesicht prüfen lassen.",
    };
  }

  if (provider === "onfido" && process.env.ONFIDO_API_KEY) {
    return {
      provider,
      sessionId,
      status: "pending",
      redirectUrl: process.env.ONFIDO_SDK_URL || `https://sdk.onfido.com/l/${sessionId}`,
      message: "Weiterleitung zu Onfido — Dokument und Motion-Check.",
    };
  }

  // Demo: lokaler Ablauf ohne externe API
  return {
    provider: "demo",
    sessionId,
    status: "pending",
    redirectUrl: null,
    demoSteps: [
      { id: "id_document", label: "Ausweis hochladen", done: false },
      { id: "liveness", label: "Kurzvideo / Selfie aufnehmen", done: false },
    ],
    message: "Demo-Modus: Schritte simulieren oder Admin-Freigabe abwarten.",
  };
}

export function completeDemoStep(session, stepId) {
  if (session.provider !== "demo") return session;
  const steps = (session.demoSteps || []).map((s) =>
    s.id === stepId ? { ...s, done: true } : s
  );
  const allDone = steps.every((s) => s.done);
  return {
    ...session,
    demoSteps: steps,
    status: allDone ? "verified" : "pending",
    verifiedAt: allDone ? new Date().toISOString() : null,
    checks: {
      idDocument: steps.find((s) => s.id === "id_document")?.done || false,
      liveness: steps.find((s) => s.id === "liveness")?.done || false,
      video: steps.find((s) => s.id === "liveness")?.done || false,
    },
  };
}

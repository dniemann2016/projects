/** Rechtliche Konstanten — ExpertiseMarkt */

import { hasApiKey } from "./config.js";

export const TERMS_VERSION = "2026-07-10-em";

export const LIABILITY_SHORT =
  "Projects ist nur Vermittler — kein Arbeitgeber, keine Vertragspartei, keine Gewähr für Leistungen Dritter. Nutzung auf eigenes Risiko.";

const DEFAULT_IMPRESSUM = {
  name: "David Hammon",
  email: "david.hammon@outlook.de",
  address: "Parkstr. 7\n82194 Gröbenzell\nDeutschland",
};

export function getImpressum() {
  const name = process.env.IMPRESSUM_NAME || DEFAULT_IMPRESSUM.name;
  const email = process.env.IMPRESSUM_EMAIL || DEFAULT_IMPRESSUM.email;
  const phone = process.env.IMPRESSUM_PHONE || "";
  const address =
    process.env.IMPRESSUM_ADDRESS?.replace(/\\n/g, "\n") ||
    DEFAULT_IMPRESSUM.address;
  return { name, email, phone: phone || null, address };
}

export function impressumComplete() {
  const { address } = getImpressum();
  return !address.includes("[Straße") && !address.includes("[PLZ");
}

export function hasAcceptedTerms(user) {
  if (!user?.termsAcceptedAt) return false;
  return user.termsVersion === TERMS_VERSION;
}

export function acceptTermsForUser(userId) {
  return {
    termsAcceptedAt: new Date().toISOString(),
    termsVersion: TERMS_VERSION,
  };
}

export function termsPublicView(user) {
  return {
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: user?.termsAcceptedAt || null,
    userTermsVersion: user?.termsVersion || null,
    needsTermsAcceptance: user ? !hasAcceptedTerms(user) : true,
    liabilityShort: LIABILITY_SHORT,
  };
}

export function getLaunchChecklist() {
  const missing = [];
  const prod = process.env.NODE_ENV === "production";
  if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY (Treuhand)");
  if (prod && !process.env.STRIPE_WEBHOOK_SECRET) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }
  if (!impressumComplete()) missing.push("IMPRESSUM_ADDRESS in .env");
  return { launchReady: missing.length === 0, missing, mode: prod ? "production" : "development" };
}

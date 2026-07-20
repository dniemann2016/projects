/** Preisstruktur (Produktplan Kap. 6): Gratis / Einmal-Analyse 9,99 / Pro 4,99. */
export const PLANS = {
  free: {
    id: "free",
    label: "Gratis",
    priceEUR: 0,
    walletEUR: 0,
    recurring: false,
    features: ["1 Analyse — Top-2-Funde komplett sichtbar", "Summen-Teaser der übrigen Funde", "Algorithmus-Scan & Abo-Verwaltung", "Invest-Rechner"],
  },
  check: {
    id: "check",
    label: "Einmal-Analyse",
    priceEUR: 9.99,
    walletEUR: 3,
    recurring: false,
    oneTime: true,
    validDays: 30,
    envPrice: "STRIPE_PRICE_CHECK",
    features: ["Vollständiges Analyse-Ergebnis", "Alle Kündigungsschreiben", "Umwidmungs-Flow + Projektionen", "3 € KI-Wallet (30 Tage)", "Kein Abo — einmal zahlen"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceEUR: 4.99,
    yearlyEUR: 39,
    walletEUR: 3,
    recurring: true,
    envPrice: "STRIPE_PRICE_PRO",
    envPriceYear: "STRIPE_PRICE_PRO_YEAR",
    features: ["Unbegrenzte Analysen", "Vermögens-Dashboard + Umwidmungs-Tracker", "Monatlicher Vermögens-Report", "3 € KI-Wallet/Monat", "Neue Auszüge jederzeit nachschieben"],
  },
};

export const OVERAGE_PER_PROMPT_EUR = 0.05;

/** Prompt-Kosten in EUR (Prompts × 0,05 €). */
export const PROMPT_ACTIONS = {
  "ki-full-scan": { label: "KI-Konten-Scan + Scam-Recherche", prompts: 15 },
  "ki-scam-check": { label: "Scam-Recherche (IBAN/Absender)", prompts: 3 },
  "ki-swap-suggestion": { label: "Sparplan-Vorschlag statt Abo", prompts: 4 },
  "ki-invest-analysis": { label: "KI-Marktanalyse / Prognose", prompts: 5 },
  "ki-abo-assessment": { label: "Seriositäts-Check", prompts: 2 },
  "ki-cancellation-letter": { label: "Kündigungsschreiben", prompts: 2 },
  "ki-auto-classify": { label: "KI-Klassifizierung aller Abos", prompts: 10 },
  "ki-company-report": { label: "Firmen-Recherche", prompts: 3 },
  "ki-finance-radar": { label: "Finanz-Radar KI-Recherche", prompts: 4 },
  "ki-broker-offers": { label: "Broker-Angebote recherchieren", prompts: 4 },
};

export function actionCostEUR(action) {
  const a = PROMPT_ACTIONS[action];
  if (!a) throw new Error(`Unbekannte KI-Aktion: ${action}`);
  return a.prompts * OVERAGE_PER_PROMPT_EUR;
}

export function defaultBilling() {
  return {
    plan: "free",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    walletBalanceEUR: 0,
    walletGrantedEUR: 0,
    walletPeriodStart: new Date().toISOString().slice(0, 10),
    oneTimeExpires: null,
    allowOverage: true,
    promptLog: [],
  };
}

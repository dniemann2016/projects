import fs from "node:fs";
import path from "node:path";
import { BUNDLED_DATA_DIR } from "./paths.js";

// Merchant_DB: 60 Anbieter mit Buchungstext-Aliases, Kündigungsadresse,
// Frist und Kategorie — das manuell gepflegte Kern-Asset (wächst weiter).
const merchants = JSON.parse(fs.readFileSync(path.join(BUNDLED_DATA_DIR, "merchants.json"), "utf8"))
  .map((m) => ({ ...m, aliasRes: m.aliases.map((a) => new RegExp(a, "i")) }));

export function allMerchants() {
  return merchants;
}

/** Findet den Merchant-Eintrag zu einem Buchungstext (Name + Verwendungszweck). */
export function matchMerchant(text) {
  const hay = String(text || "");
  for (const m of merchants) {
    if (m.aliasRes.some((re) => re.test(hay))) return m;
  }
  return null;
}

// Kategorie-Basisrate der Nichtnutzung: Fitness & Streaming-Mehrfachabos oben.
const CATEGORY_BASE = {
  fitness: 30,
  streaming: 25,
  dating: 25,
  gaming: 20,
  medien: 20,
  software: 15,
  shopping: 12,
  lebensmittel: 12,
  mobilfunk: 8,
  mobilitaet: 8,
  versicherung: 5,
  energie: 0,
  wohnen: 0,
  pflicht: 0,
};

/**
 * Kündigungs-Kandidat-Score 0–100, deterministisch und erklärbar:
 * (a) Betrag relativ zu allen Abos, (b) Kategorie-Basisrate,
 * (c) Preiserhöhung +20, (d) Kategorie-Doppelung +25.
 */
export function scoreSubscriptions(subs) {
  const monthlyOf = (s) => {
    if (s.cycle === "jährlich") return s.amount / 12;
    if (s.cycle === "vierteljährlich") return s.amount / 3;
    if (s.cycle === "wöchentlich") return s.amount * 4.33;
    return s.amount;
  };
  const totalMonthly = subs.reduce((a, s) => a + monthlyOf(s), 0) || 1;
  const catCount = {};
  for (const s of subs) {
    const cat = s.merchantCategory || "sonstiges";
    catCount[cat] = (catCount[cat] || 0) + 1;
  }

  return subs.map((s) => {
    const monthly = monthlyOf(s);
    const cat = s.merchantCategory || "sonstiges";
    if (s.kuendbar === false) {
      return { ...s, monthlyEUR: Math.round(monthly * 100) / 100, score: 0, scoreReasons: ["notwendige Zahlung — kein Kündigungs-Kandidat"] };
    }

    const reasons = [];
    const amountPart = Math.min(30, Math.round((monthly / totalMonthly) * 100 * 0.6));
    if (amountPart >= 15) reasons.push(`großer Hebel: ${Math.round((monthly / totalMonthly) * 100)}% deiner Abo-Ausgaben`);
    const basePart = CATEGORY_BASE[cat] ?? 10;
    if (basePart >= 20) reasons.push("Kategorie mit hoher Nichtnutzungs-Quote");
    let score = amountPart + basePart;
    if (s.priceIncreaseDetected) {
      score += 20;
      reasons.push("Preiserhöhung erkannt");
    }
    if ((catCount[cat] || 0) >= 2 && ["streaming", "medien", "gaming", "fitness"].includes(cat)) {
      score += 25;
      reasons.push(`${catCount[cat]}× ${cat} — Doppelung`);
    }
    return { ...s, monthlyEUR: Math.round(monthly * 100) / 100, score: Math.min(100, score), scoreReasons: reasons };
  }).sort((a, b) => b.score - a.score || b.monthlyEUR - a.monthlyEUR);
}

/**
 * Zukunftswert einer monatlichen Sparrate: FV = Rate × (((1+r/12)^m − 1) / (r/12)).
 * Immer drei Szenarien (4/6/8 % p.a.) — ehrlicher und rechtlich sauber.
 */
export function projection(monthlyEUR, years) {
  const m = Math.round(years * 12);
  const scenario = (annual) => {
    const r = annual / 12;
    const fv = monthlyEUR * ((Math.pow(1 + r, m) - 1) / r);
    return Math.round(fv);
  };
  return {
    monthlyEUR: Math.round(monthlyEUR * 100) / 100,
    years,
    paidIn: Math.round(monthlyEUR * m),
    low: scenario(0.04),
    mid: scenario(0.06),
    high: scenario(0.08),
    disclaimer: "Modellrechnung mit historischen Durchschnittswerten (4/6/8 % p.a.). Keine Garantie, keine Anlageberatung. Wertanlagen können an Wert verlieren.",
  };
}

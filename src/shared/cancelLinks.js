// Kündigungs-Direktlinks (Kündigungsbutton-Gesetz seit 2022) +
// CSV-Export-Anleitungen je Bank für den "Konto verbinden"-Flow (Phase 1).
export const CANCEL_LINKS = {
  netflix: { match: /netflix/i, label: "Netflix kündigen", url: "https://www.netflix.com/cancelplan" },
  spotify: { match: /spotify/i, label: "Spotify kündigen", url: "https://www.spotify.com/de/account/subscription/" },
  adobe: { match: /adobe/i, label: "Adobe kündigen", url: "https://account.adobe.com/plans" },
  amazon: { match: /amazon\s*prime|prime/i, label: "Amazon Prime kündigen", url: "https://www.amazon.de/gp/primecentral" },
  disney: { match: /disney/i, label: "Disney+ kündigen", url: "https://www.disneyplus.com/de-de/account" },
  vodafone: { match: /vodafone/i, label: "Vodafone kündigen", url: "https://www.vodafone.de/kuendigung/" },
  telekom: { match: /telekom/i, label: "Telekom kündigen", url: "https://www.telekom.de/kuendigung" },
  o2: { match: /o2|telefonica/i, label: "o2 kündigen", url: "https://www.o2online.de/kuendigung/" },
  sky: { match: /sky/i, label: "Sky kündigen", url: "https://www.sky.de/kuendigen" },
  dazn: { match: /dazn/i, label: "DAZN kündigen", url: "https://www.dazn.com/de-DE/account/subscription" },
  fitx: { match: /fitx/i, label: "FitX kündigen", url: "https://www.fitx.de/kuendigung" },
  mcfit: { match: /mcfit|rsg/i, label: "McFIT kündigen", url: "https://www.mcfit.com/de/kuendigung/" },
  fitnessfirst: { match: /fitness\s*first/i, label: "Fitness First kündigen", url: "https://www.fitnessfirst.de/kuendigung" },
  youtube: { match: /youtube|google\s*(premium|one)/i, label: "YouTube/Google kündigen", url: "https://myaccount.google.com/subscriptions" },
  apple: { match: /apple|itunes/i, label: "Apple-Abo kündigen", url: "https://support.apple.com/de-de/HT202039" },
  audible: { match: /audible/i, label: "Audible kündigen", url: "https://www.audible.de/account/membership-details" },
};

export function findCancelLink(name) {
  for (const entry of Object.values(CANCEL_LINKS)) {
    if (entry.match.test(name || "")) return { label: entry.label, url: entry.url };
  }
  return null;
}

export const EXPORT_GUIDES = {
  sparkasse: ["Online-Banking öffnen → Umsätze", "Zeitraum wählen (z. B. 3 Monate)", "„Exportieren“ → CSV wählen", "Datei hier hochladen"],
  ing: ["Banking → Girokonto → Umsätze", "Zeitraum: letzte 90 Tage", "Symbol „Exportieren“ → CSV", "Datei hier hochladen"],
  dkb: ["Banking → Kontoumsätze", "Zeitraum einstellen", "„CSV-Export“ klicken", "Datei hier hochladen"],
  comdirect: ["Persönlicher Bereich → Umsätze", "Zeitraum wählen", "„Umsätze exportieren“ → CSV", "Datei hier hochladen"],
  paypal: ["paypal.com → Aktivitäten", "„Berichte“ → Aktivitäten herunterladen", "Format CSV, Zeitraum 3 Monate", "Datei hier hochladen"],
  "deutsche-bank": ["OnlineBanking → Umsatzanzeige", "Zeitraum wählen", "Export-Symbol → CSV", "Datei hier hochladen"],
  commerzbank: ["Online Banking → Umsätze", "Zeitraum wählen", "„Umsätze exportieren“ → CSV", "Datei hier hochladen"],
  volksbank: ["OnlineBanking → Umsätze", "Zeitraum wählen", "„Export“ → CSV-Format", "Datei hier hochladen"],
  n26: ["N26-App → Konto", "„Kontoauszüge“ → CSV-Export", "Zeitraum 3 Monate", "Datei hier hochladen"],
  default: ["Online-Banking öffnen → Umsätze/Transaktionen", "Zeitraum wählen (3–6 Monate empfohlen)", "Export als CSV (oder PDF/Text)", "Datei hier hochladen — fertig"],
};

// Rule-based subscription classifier — the no-API-key fallback for /api/ai/auto-classify.
// Mirrors what the Claude prompt asks for: status (keep/switch/warning/pending) + German reason.

const KNOWN_BRANDS = [
  "netflix", "spotify", "amazon", "prime", "disney", "adobe", "vodafone", "telekom",
  "o2", "1und1", "apple", "google", "microsoft", "youtube", "dazn", "sky", "audible",
  "paypal", "klarna", "fitx", "mcfit", "fitness first", "urban sports", "sixt", "adac",
  "zeit", "spiegel", "faz", "sueddeutsche", "duolingo", "chatgpt", "openai", "dropbox",
  "icloud", "playstation", "xbox", "nintendo", "steam", "twitch", "tinder", "parship",
];

const EU_TRUSTED_IBAN = ["DE", "AT"];

function monthsSince(ym) {
  if (!ym) return 0;
  const [y, m] = ym.split("-").map(Number);
  const now = new Date();
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
}

export function classifySubscription(sub) {
  const nameLower = (sub.name || "").toLowerCase();
  const isKnown = KNOWN_BRANDS.some((b) => nameLower.includes(b));
  const ibanCountry = sub.iban ? sub.iban.replace(/\s/g, "").slice(0, 2) : null;
  const foreignIban = ibanCountry && !EU_TRUSTED_IBAN.includes(ibanCountry);
  const age = monthsSince(sub.since);
  const history = sub.priceHistory || [];
  const first = history[0]?.amount ?? sub.amount;
  const hikePct = first > 0 ? ((sub.amount - first) / first) * 100 : 0;

  const reasons = [];
  let status = "keep";

  if (!isKnown && foreignIban) {
    status = "warning";
    reasons.push(`Unbekannter Anbieter mit ausländischer IBAN (${ibanCountry})`);
  } else if (!isKnown && age <= 3) {
    status = "warning";
    reasons.push("Unbekannter Anbieter, erst kürzlich erste Abbuchung");
  } else if (!isKnown) {
    status = "pending";
    reasons.push("Anbieter nicht in der Liste bekannter Firmen — bitte selbst prüfen");
  }

  if (status !== "warning") {
    if (hikePct >= 25) {
      status = "switch";
      reasons.push(`Preis um ${Math.round(hikePct)}% gestiegen — Wechsel oder Kündigung prüfen`);
    } else if (age >= 48 && sub.status === "pending") {
      status = "pending";
      reasons.push(`Läuft seit über ${Math.floor(age / 12)} Jahren ohne Überprüfung`);
    } else if (isKnown && reasons.length === 0) {
      reasons.push("Bekannter, seriöser Anbieter — Betrag plausibel");
    }
  }

  if (foreignIban && isKnown) {
    reasons.push(`Hinweis: IBAN-Land ${ibanCountry} — bei bekannten Anbietern (z.B. Streaming) üblich`);
  }

  return { id: sub.id, status, reason: reasons.join(" · ") };
}

export function classifyAll(subs) {
  return subs.map(classifySubscription);
}

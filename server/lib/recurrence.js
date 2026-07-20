// Algorithmic recurring-payment detection — no AI involved.
// Groups transactions by IBAN (strongest signal) or normalized name/subject
// tokens, then checks interval regularity and amount consistency.

const KNOWN_BRANDS = [
  "netflix", "spotify", "adobe", "amazon", "vodafone", "telekom", "o2", "1und1",
  "disney", "dazn", "sky", "youtube", "apple", "google", "microsoft", "dropbox",
  "fitness", "mcfit", "urban sports", "stadtwerke", "rewe", "edeka", "aldi", "lidl",
  "shell", "aral", "dm-", "rossmann", "miete", "wohnbau", "wohnung", "steam", "ebay",
  "paypal", "klarna", "allianz", "huk", "adac", "bahn", "rundfunk", "gez",
];

const GENERIC_TOKENS = ["ltd", "limited", "service", "services", "pro", "solutions", "consulting", "billing", "payment", "fee", "media pay"];

const CATEGORY_RULES = [
  [/netflix|disney|dazn|sky|wow|paramount|youtube premium/i, "Streaming"],
  [/spotify|deezer|tidal|apple music/i, "Musik"],
  [/adobe|microsoft|dropbox|notion|figma|github|jetbrains/i, "Software"],
  [/vodafone|telekom|o2|1und1|congstar|mobilfunk/i, "Mobilfunk & Internet"],
  [/fitness|mcfit|gym|urban sports|sport/i, "Sport"],
  [/amazon prime|prime mitglied/i, "Shopping"],
  [/miete|wohnbau|wohnung|hausverwaltung/i, "Wohnen"],
  [/stadtwerke|strom|gas|energie|vattenfall|eon|e\.on/i, "Energie"],
  [/allianz|huk|versicherung|axa|ergo/i, "Versicherung"],
  [/steam|playstation|xbox|nintendo/i, "Gaming"],
  [/rundfunk|gez|beitragsservice/i, "Rundfunk"],
];

const norm = (s) => (s || "").toLowerCase().replace(/[0-9]/g, "").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
const ibanKey = (iban) => (iban || "").replace(/\s/g, "").toUpperCase();

function nameKey(name, subject) {
  const n = norm(name);
  if (n) return n.split(" ").slice(0, 3).join(" ");
  return norm(subject).split(" ").slice(0, 3).join(" ");
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

function detectCycle(gapsDays) {
  if (gapsDays.length === 0) return null;
  const m = median(gapsDays);
  if (m >= 5 && m <= 9) return "wöchentlich";
  if (m >= 26 && m <= 35) return "monatlich";
  if (m >= 80 && m <= 105) return "vierteljährlich";
  if (m >= 330 && m <= 400) return "jährlich";
  return null;
}

function guessCategory(name, subject) {
  const hay = `${name} ${subject}`;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return "Sonstiges";
}

function isKnownBrand(name, subject) {
  const hay = `${name} ${subject}`.toLowerCase();
  return KNOWN_BRANDS.some((b) => hay.includes(b));
}

// Assesses one group of transactions; returns a recurring-payment record or null.
function assessGroup(txs, today) {
  if (txs.length < 2) return null;
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map((t) => new Date(t.date));
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
  const cycle = detectCycle(gaps);
  if (!cycle) return null;

  // Amount consistency: recurring payments repeat few distinct amounts
  // (identical fees, or a price ladder like 29,99 → 39,99). Variable spending
  // (groceries, fuel, shopping) shows mostly unique amounts and is rejected
  // even when it hits the same IBAN every month.
  const amounts = sorted.map((t) => Math.abs(t.amount));
  const distinct = [...new Set(amounts.map((a) => a.toFixed(2)))];
  const distinctRatio = distinct.length / amounts.length;
  const medAmount = median(amounts);
  const nearMedian = amounts.filter((a) => Math.abs(a - medAmount) / medAmount <= 0.02).length;
  if (distinctRatio > 0.5 && nearMedian / amounts.length < 0.6) return null;

  const last = sorted[sorted.length - 1];
  const name = last.name || last.subject || "Unbekannt";
  const iban = last.iban || "";
  const known = isKnownBrand(name, last.subject);
  const country = ibanKey(iban).slice(0, 2);
  const foreign = country && !["DE", "AT"].includes(country);
  const generic = GENERIC_TOKENS.some((t) => `${name} ${last.subject}`.toLowerCase().includes(t));
  const firstSeenDays = (today - dates[0]) / 86400000;

  // Rule-based suspicion score (no AI): unknown + foreign + generic + new = suspicious.
  let score = 0;
  if (!known) score += 2;
  if (foreign) score += 1;
  if (generic) score += 1;
  if (firstSeenDays < 75) score += 1;
  const suspicious = score >= 3;

  // Price history from distinct amounts in chronological order.
  const priceHistory = [];
  for (const t of sorted) {
    const amt = Math.abs(t.amount);
    if (!priceHistory.length || priceHistory[priceHistory.length - 1].amount !== amt) {
      priceHistory.push({ date: t.date.slice(0, 7), amount: amt });
    }
  }
  const priceRose = priceHistory.length > 1 && priceHistory[priceHistory.length - 1].amount > priceHistory[0].amount;

  const notes = [];
  if (suspicious) {
    const reasons = [];
    if (!known) reasons.push("unbekannter Anbieter");
    if (foreign) reasons.push(`ausländische IBAN (${country})`);
    if (generic) reasons.push("generischer Name");
    if (firstSeenDays < 75) reasons.push("neue Abbuchung");
    notes.push(`⚠ ${reasons.join(" · ")}`);
  }
  if (priceRose) notes.push(`Preis gestiegen: ${priceHistory[0].amount.toFixed(2)} € → ${priceHistory[priceHistory.length - 1].amount.toFixed(2)} €`);

  return {
    name,
    iban,
    subject: last.subject || "",
    amount: Math.abs(last.amount),
    cycle,
    since: sorted[0].date.slice(0, 7),
    lastCharge: last.date,
    paymentDay: Math.min(28, Math.round(median(dates.map((d) => d.getDate())))),
    category: guessCategory(name, last.subject),
    status: suspicious ? "warning" : "pending",
    note: notes.join(" — "),
    priceHistory,
    occurrences: sorted.length,
    matchedBy: iban ? "IBAN" : "Name/Betreff",
  };
}

// Scans all transactions of one user; returns detected recurring payments.
export function detectRecurring(transactions, now = new Date()) {
  const expenses = transactions.filter((t) => t.amount < 0);
  const groups = new Map();
  for (const t of expenses) {
    const key = ibanKey(t.iban) || `n:${nameKey(t.name, t.subject)}`;
    if (!key || key === "n:") continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const results = [];
  for (const txs of groups.values()) {
    const rec = assessGroup(txs, now);
    if (rec) results.push(rec);
  }
  return results.sort((a, b) => b.amount - a.amount);
}

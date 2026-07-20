// Die Analyse-Pipeline aus dem Produktplan (Kap. 5), drei Schichten:
// 1. Parsing (deterministisch: CSV/Text-Zeilen → Transaktionen)
// 2. Wiederkehrungs-Erkennung (deterministisch: recurrence.js)
// 3. KI-Anreicherung (optional, nur die erkannten Kandidaten, striktes JSON)
// Rohdaten werden NIE gespeichert — rein in-memory, Ergebnis raus, Original weg.

import { detectRecurring } from "./recurrence.js";
import { matchMerchant } from "./coach.js";
import { scoreSubscriptions, projection } from "./coach.js";
import { hasApiKey } from "./config.js";
import { enrichCandidates } from "./anthropic.js";

const dateRe = /(\d{4}-\d{2}-\d{2})|(\d{1,2})\.(\d{1,2})\.(\d{2,4})/;
const ibanRe = /\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{2,4}){2,8})\b/;
const amountRe = /(-?\d{1,6}[.,]\d{2})\s*(?:€|EUR)?\s*(?:$|[;,])/;

// ---- Bank-CSV-Parser (Produktplan 5.1): echte Export-Header der großen Banken. ----
// Spaltennamen-Kandidaten je Feld; deckt Sparkasse (CAMT), ING, DKB, N26,
// comdirect, Consorsbank, PayPal und generische Exporte ab.
const CSV_COLUMNS = {
  date: ["buchungstag", "buchungsdatum", "buchung", "datum", "date", "wertstellung", "valutadatum"],
  name: ["beguenstigter/zahlungspflichtiger", "begünstigter/zahlungspflichtiger", "zahlungsempfänger*in", "zahlungsempfaenger", "auftraggeber/empfänger", "auftraggeber/empfaenger", "name", "payee", "empfänger", "empfaenger", "partner name"],
  subject: ["verwendungszweck", "buchungstext", "vorgang", "beschreibung", "payment reference", "reference", "subject"],
  iban: ["iban", "kontonummer/iban", "account number", "partner iban"],
  amount: ["betrag", "betrag (€)", "betrag (eur)", "umsatz in eur", "umsatz", "amount", "amount (eur)", "betrag."],
};

function normalizeHeader(cell) {
  return String(cell || "").replace(/^["']|["']$/g, "").trim().toLowerCase();
}

function parseGermanAmount(raw) {
  let s = String(raw || "").replace(/^["']|["']$/g, "").replace(/\s|€|EUR/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

function normalizeDate(raw) {
  const s = String(raw || "").replace(/^["']|["']$/g, "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (de) {
    const yyyy = de[3].length === 2 ? `20${de[3]}` : de[3];
    return `${yyyy}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  }
  return null;
}

function splitCsvLine(line, sep) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.replace(/^["']|["']$/g, "").trim());
}

/**
 * Erkennt Bank-CSV-Exporte an der Header-Zeile und liest sie spaltengenau.
 * Liefert null, wenn kein bekannter Header gefunden wird (→ Zeilen-Fallback).
 */
export function parseCsvStatement(text) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  // Header kann nach Metazeilen kommen (Sparkasse/comdirect schreiben Kontoinfos davor).
  for (let h = 0; h < Math.min(lines.length, 12); h++) {
    const sep = (lines[h].match(/;/g) || []).length >= (lines[h].match(/,/g) || []).length ? ";" : ",";
    const header = splitCsvLine(lines[h], sep).map(normalizeHeader);
    const col = {};
    for (const [field, candidates] of Object.entries(CSV_COLUMNS)) {
      const idx = header.findIndex((cell) => candidates.includes(cell));
      if (idx !== -1) col[field] = idx;
    }
    if (col.date === undefined || col.amount === undefined) continue;

    const txs = [];
    let id = 1;
    for (let i = h + 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i], sep);
      if (cells.length < 2) continue;
      const date = normalizeDate(cells[col.date]);
      const amount = parseGermanAmount(cells[col.amount]);
      if (!date || !Number.isFinite(amount)) continue;
      const name = col.name !== undefined ? cells[col.name] : "";
      const subject = col.subject !== undefined ? cells[col.subject] : "";
      const ibanCell = col.iban !== undefined ? cells[col.iban] : "";
      const ibanMatch = `${ibanCell} ${subject}`.match(ibanRe);
      txs.push({
        id: id++,
        date,
        name: (name || subject || "Unbekannt").slice(0, 120).trim() || "Unbekannt",
        iban: ibanMatch ? ibanMatch[1] : null,
        subject: String(subject || "").slice(0, 200).trim(),
        amount,
      });
    }
    if (txs.length > 0) return txs;
  }
  return null;
}

/** Schicht 1: Text/CSV → Transaktionsliste. Bank-CSV-Header zuerst, dann Zeilen-Regex. */
export function parseStatementText(text) {
  const fromCsv = parseCsvStatement(text);
  if (fromCsv) return fromCsv;
  const txs = [];
  let id = 1;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const dm = line.match(dateRe);
    const am = line.match(amountRe) || line.match(/(-?\d{1,6}[.,]\d{2})\s*(?:€|EUR)?\s*$/);
    if (!dm || !am) continue;
    let date;
    if (dm[1]) date = dm[1];
    else {
      const yyyy = dm[4].length === 2 ? `20${dm[4]}` : dm[4];
      date = `${yyyy}-${dm[3].padStart(2, "0")}-${dm[2].padStart(2, "0")}`;
    }
    let amount = Number(am[1].replace(",", "."));
    const im = line.match(ibanRe);
    let rest = line.replace(dm[0], "").replace(am[0], "");
    if (im) rest = rest.replace(im[0], "");
    rest = rest.replace(/[;|,]{1,}/g, "  ").replace(/\s{2,}/g, "  ").trim();
    const [name, ...subjectParts] = rest.split("  ");
    // Lastschriften in Exporten sind oft positiv notiert — als Ausgabe werten.
    if (amount > 0 && /lastschrift|abbuchung|abo|einzug|sepa-basislastschrift/i.test(line)) amount = -amount;
    txs.push({
      id: id++,
      date,
      name: (name || "Unbekannt").trim(),
      iban: im ? im[1] : null,
      subject: subjectParts.join(" ").trim(),
      amount,
    });
  }
  return txs;
}

/**
 * Volle Pipeline: Text rein → bewertete Abo-Kandidaten mit Score,
 * Projektion (4/6/8 %) und Merchant-Daten (Kündigungsadresse, Frist) raus.
 */
export async function analyzeStatementText(text, { years = 25 } = {}) {
  const txs = parseStatementText(text);
  if (txs.length === 0) {
    return { transactions: 0, items: [], totalMonthly: 0 };
  }

  const detected = detectRecurring(txs);

  // Merchant-DB-Anreicherung (deterministisch, Schicht "Klartext-Name").
  let items = detected.map((d) => {
    const merchant = matchMerchant(`${d.name} ${d.subject}`);
    return {
      ...d,
      merchantId: merchant?.id || null,
      merchantName: merchant?.name || null,
      merchantCategory: merchant?.category || null,
      cancelUrl: merchant?.cancelUrl || null,
      cancelAddress: merchant?.cancelAddress || null,
      noticePeriod: merchant?.noticePeriod || null,
      kuendbar: merchant ? merchant.kuendbar : undefined,
      priceIncreaseDetected: d.priceHistory && d.priceHistory.length > 1 && d.priceHistory[d.priceHistory.length - 1].amount > d.priceHistory[0].amount,
    };
  });

  // Schicht 3: KI klärt nur die Kandidaten, die die Merchant-DB nicht kennt.
  // Kosten: wenige Cent pro Analyse — trägt die Marge (Produktplan 5.3).
  const unknown = items.filter((i) => !i.merchantId);
  if (unknown.length > 0 && hasApiKey()) {
    try {
      const raw = await enrichCandidates(unknown.map((i) => ({ text: `${i.name} ${i.subject}`.trim(), amount: i.amount, cycle: i.cycle })));
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      const results = parsed.results || [];
      items = items.map((i) => {
        if (i.merchantId) return i;
        const idx = unknown.indexOf(i);
        const r = results[idx];
        if (!r) return i;
        return {
          ...i,
          merchantName: r.merchant_clean || i.merchantName,
          merchantCategory: r.kategorie || i.merchantCategory,
          kuendbar: typeof r.kuendbar === "boolean" ? r.kuendbar : i.kuendbar,
          aiConfidence: r.confidence,
        };
      });
    } catch (err) {
      console.error("KI-Anreicherung fehlgeschlagen (Analyse läuft ohne weiter):", err.message);
    }
  }

  const scored = scoreSubscriptions(items);
  const withProjection = scored.map((s) => ({
    ...s,
    displayName: s.merchantName || s.name,
    projection: s.kuendbar === false ? null : projection(s.monthlyEUR, years),
  }));

  const cancellable = withProjection.filter((s) => s.kuendbar !== false);
  const totalMonthly = Math.round(cancellable.reduce((a, s) => a + s.monthlyEUR, 0) * 100) / 100;

  return {
    transactions: txs.length,
    items: withProjection,
    totalMonthly,
    totalProjection: totalMonthly > 0 ? projection(totalMonthly, years) : null,
  };
}

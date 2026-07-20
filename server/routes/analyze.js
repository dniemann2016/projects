import { Router } from "express";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { analyzeStatementText } from "../lib/analyzer.js";
import { currentUser } from "../lib/currentUser.js";
import { hasAcceptedTerms } from "../lib/legal.js";
import { ensureBilling, resetWalletIfNeeded } from "../lib/billingEngine.js";
import { rateLimit } from "../lib/rateLimit.js";
import { store } from "../lib/store.js";
import { allMerchants } from "../lib/coach.js";

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024, files: 5 } });

/** Hat der Nutzer vollen Zugriff? Pro-Abo oder gültiger Einmal-Check. */
function hasFullAccess(user) {
  if (!user) return false;
  const billing = resetWalletIfNeeded(ensureBilling(user));
  if (billing.plan === "pro") return true;
  if (billing.plan === "check" && (!billing.oneTimeExpires || new Date(billing.oneTimeExpires) >= new Date())) return true;
  return false;
}

/**
 * Der Kern-Funnel (Produktplan 3.1): Kontoauszug hochladen → Analyse —
 * OHNE Registrierung für die erste Vorschau. Rohdaten werden nur in-memory
 * verarbeitet und nie gespeichert (DSGVO, Kap. 2.3).
 *
 * Paywall (Kap. 3.2): Gratis sieht die 2 größten Funde komplett (inkl.
 * Projektion für den Aha-Moment); der Rest wird als Summen-Teaser ausgeblendet.
 */
router.post("/", rateLimit({ windowMs: 60_000, max: 6, message: "Zu viele Analysen — bitte kurz warten." }), upload.array("files", 5), async (req, res) => {
  try {
    let text = String(req.body?.text || "");
    for (const file of req.files || []) {
      if (file.mimetype === "application/pdf") {
        const parsed = await pdfParse(file.buffer);
        text += "\n" + parsed.text;
      } else {
        text += "\n" + file.buffer.toString("utf8");
      }
    }
    if (!text.trim()) return res.status(400).json({ error: "Bitte Kontoauszug einfügen oder als PDF/CSV hochladen." });

    const result = await analyzeStatementText(text);
    // Rohtext ab hier verworfen — nur strukturierte Ergebnisse gehen raus.

    if (result.items.length === 0) {
      return res.json({
        transactions: result.transactions,
        found: 0,
        items: [],
        locked: 0,
        message: result.transactions === 0
          ? "Keine Umsätze erkannt. Erwartet pro Zeile: Datum, Name/Verwendungszweck, Betrag (z.B. \"15.06.2026  NETFLIX  -17,99\")."
          : `${result.transactions} Umsätze geprüft — keine wiederkehrenden Zahlungen gefunden. Tipp: 3 Monate Auszug hochladen, damit auch quartalsweise Abbuchungen erkannt werden.`,
      });
    }

    const user = currentUser(req);
    const full = hasFullAccess(user);

    // Analysis-Entity (Produktplan 4.1): nur Metadaten, nie Rohdaten.
    // Grundlage für Funnel-Statistik und Kill-Kriterien (Kap. 6.4).
    try {
      const analyses = store.collection("analyses");
      analyses.push({
        id: Date.now(),
        userId: user?.id || null,
        uploadedAt: new Date().toISOString(),
        transactions: result.transactions,
        found: result.items.length,
        totalMonthly: result.totalMonthly,
        full,
      });
      store.setCollection("analyses", analyses.slice(-5000));
    } catch { /* Statistik darf die Analyse nie blockieren */ }

    const visible = full ? result.items : result.items.slice(0, 2);
    const hidden = full ? [] : result.items.slice(2);
    const hiddenMonthly = Math.round(hidden.reduce((a, s) => a + (s.kuendbar === false ? 0 : s.monthlyEUR), 0) * 100) / 100;

    res.json({
      transactions: result.transactions,
      found: result.items.length,
      totalMonthly: result.totalMonthly,
      totalProjection: result.totalProjection,
      items: visible.map((s) => (full ? s : { ...s, cancelAddress: undefined })),
      locked: hidden.length,
      lockedMonthly: hiddenMonthly,
      lockedPreview: hidden.map((s) => ({ category: s.merchantCategory || "sonstiges", monthlyEUR: s.monthlyEUR })),
      full,
      disclaimer: "Modellrechnung mit historischen Durchschnittswerten (4/6/8 % p.a.). Keine Garantie, keine Anlageberatung. Wertanlagen können an Wert verlieren.",
    });
  } catch (err) {
    console.error("Analyse fehlgeschlagen:", err);
    res.status(500).json({ error: "Analyse fehlgeschlagen. Bitte erneut versuchen." });
  }
});

/**
 * Deterministischer Kündigungsschreiben-Generator aus der Merchant_DB —
 * kein LLM nötig. Vollzugriff (Pro / Einmal-Check) erforderlich.
 */
router.post("/letter", (req, res) => {
  const user = currentUser(req);
  if (!hasFullAccess(user)) {
    return res.status(402).json({ error: "Kündigungsschreiben gibt es mit der Einmal-Analyse (9,99 €) oder Pro (4,99 €/Monat)." });
  }
  const { merchantId, merchantName, customerNumber, userName } = req.body || {};
  const merchant = allMerchants().find((m) => m.id === merchantId) || null;
  const name = merchant?.name || String(merchantName || "").slice(0, 80);
  if (!name) return res.status(400).json({ error: "Anbieter fehlt." });

  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const subject = `Kündigung meines Vertrags${customerNumber ? ` — Kundennummer ${customerNumber}` : ""}`;
  const body = [
    merchant?.cancelAddress ? `An: ${merchant.cancelAddress}` : `An: ${name}`,
    "",
    `Betreff: ${subject}`,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    `hiermit kündige ich meinen Vertrag bei ${name}${customerNumber ? ` (Kundennummer: ${customerNumber})` : ""} fristgerecht zum nächstmöglichen Zeitpunkt.`,
    merchant?.noticePeriod ? `Laut Ihren Bedingungen gilt: ${merchant.noticePeriod}.` : "",
    "",
    "Bitte bestätigen Sie mir den Erhalt dieser Kündigung sowie das Vertragsende schriftlich.",
    "Einer Fortsetzung oder automatischen Verlängerung des Vertrags widerspreche ich ausdrücklich.",
    "",
    "Mit freundlichen Grüßen",
    userName || "",
    today,
  ].filter((l) => l !== null).join("\n");

  res.json({
    subject,
    body,
    cancelUrl: merchant?.cancelUrl || null,
    noticePeriod: merchant?.noticePeriod || null,
  });
});

/**
 * Analyse-Ergebnis ins Konto übernehmen (Abos anlegen) — für eingeloggte
 * Nutzer, damit Umwidmungs-Flow und Dashboard damit weiterarbeiten.
 */
router.post("/adopt", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Bitte zuerst Konto anlegen/anmelden, um Ergebnisse zu speichern." });
  if (!hasAcceptedTerms(user)) {
    return res.status(403).json({ error: "Bitte AGB und Haftungsausschluss akzeptieren.", code: "TERMS_REQUIRED" });
  }
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
  if (items.length === 0) return res.status(400).json({ error: "Keine Positionen übergeben." });

  const COLORS = ["#E50914", "#1DB954", "#FF0000", "#0A84FF", "#FF9900", "#E60000", "#5856D6", "#FF2D55", "#34C759", "#AF52DE"];
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const subs = store.collection("subscriptions");
  let nextId = Math.max(0, ...subs.map((s) => s.id)) + 1;
  let created = 0;

  for (const item of items) {
    const name = String(item.displayName || item.name || "").slice(0, 80);
    if (!name) continue;
    const exists = subs.some((s) => s.userId === user.id && (norm(s.name) === norm(name) || (item.iban && norm(s.iban) === norm(item.iban))));
    if (exists) continue;
    subs.push({
      id: nextId++,
      userId: user.id,
      name,
      domain: null,
      amount: Number(item.amount) || Number(item.monthlyEUR) || 0,
      cycle: item.cycle || "monatlich",
      since: item.since || new Date().toISOString().slice(0, 7),
      category: item.merchantCategory || item.category || "Sonstiges",
      status: item.status === "warning" ? "warning" : "pending",
      color: COLORS[(nextId - 1) % COLORS.length],
      letter: name[0].toUpperCase(),
      iban: item.iban || "",
      email: "",
      username: "",
      passwordEnc: null,
      phone: "",
      lastCharge: item.lastCharge || null,
      note: item.scoreReasons?.join(" · ") || "",
      paused: false,
      paymentDay: item.paymentDay || null,
      priceHistory: item.priceHistory || [],
    });
    created++;
  }
  store.setCollection("subscriptions", subs);
  res.json({ created, message: `${created} Abos ins Konto übernommen.` });
});

export default router;

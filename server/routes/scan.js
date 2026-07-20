import { Router } from "express";
import { store } from "../lib/store.js";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { detectRecurring } from "../lib/recurrence.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const COLORS = ["#E50914", "#1DB954", "#FF0000", "#0A84FF", "#FF9900", "#E60000", "#5856D6", "#FF2D55", "#34C759", "#AF52DE"];

// Runs the pure-algorithm scanner over the user's transactions and upserts
// the results into the subscriptions list. No AI involved — this is the
// default analysis path; the KI endpoints refine on top when enabled.
router.post("/", (req, res) => {
  const txs = store.collection("transactions").filter((t) => t.userId === req.user.id);
  if (txs.length === 0) {
    return res.json({ found: 0, created: 0, updated: 0, warnings: 0, engine: "algorithmus", summary: "Keine Umsätze vorhanden. Verbinde ein Konto oder importiere Umsätze." });
  }

  const detected = detectRecurring(txs);
  const subs = store.collection("subscriptions");
  let nextId = Math.max(0, ...subs.map((s) => s.id)) + 1;
  let created = 0;
  let updated = 0;

  for (const rec of detected) {
    const existing = subs.find(
      (s) =>
        s.userId === req.user.id &&
        ((rec.iban && norm(s.iban) === norm(rec.iban)) || (!rec.iban && norm(s.name) === norm(rec.name)))
    );
    if (existing) {
      existing.amount = rec.amount;
      existing.cycle = rec.cycle;
      existing.lastCharge = rec.lastCharge;
      existing.paymentDay = existing.paymentDay || rec.paymentDay;
      existing.priceHistory = rec.priceHistory;
      // Never downgrade a user decision (keep/switch); refresh pending/warning.
      if (existing.status === "pending" || existing.status === "warning") {
        existing.status = rec.status;
        existing.note = rec.note;
      }
      updated++;
    } else {
      subs.push({
        id: nextId++,
        userId: req.user.id,
        name: rec.name,
        domain: null,
        amount: rec.amount,
        cycle: rec.cycle,
        since: rec.since,
        category: rec.category,
        status: rec.status,
        color: COLORS[(nextId - 1) % COLORS.length],
        letter: (rec.name || "?")[0].toUpperCase(),
        iban: rec.iban,
        email: "",
        username: "",
        passwordEnc: null,
        phone: "",
        lastCharge: rec.lastCharge,
        note: rec.note,
        paused: false,
        paymentDay: rec.paymentDay,
        priceHistory: rec.priceHistory,
        occurrences: rec.occurrences,
        matchedBy: rec.matchedBy,
      });
      created++;
    }
  }
  store.setCollection("subscriptions", subs);

  const warnings = detected.filter((d) => d.status === "warning").length;
  res.json({
    found: detected.length,
    created,
    updated,
    warnings,
    engine: "algorithmus",
    summary: `${txs.length} Umsätze geprüft — ${detected.length} wiederkehrende Zahlungen erkannt (${created} neu, ${updated} aktualisiert), ${warnings} Warnung${warnings !== 1 ? "en" : ""}. Erkennung rein algorithmisch: wiederholte IBANs, Namen, Betreffe und regelmäßige Intervalle & Beträge.`,
    detected: detected.map((d) => ({ name: d.name, amount: d.amount, cycle: d.cycle, status: d.status, occurrences: d.occurrences, matchedBy: d.matchedBy })),
  });
});

export default router;

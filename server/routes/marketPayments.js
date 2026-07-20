import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";
import {
  escrowMode,
  getProjectEscrowSummary,
  setProjectSplitAllocations,
  fundProjectEscrow,
  payOfferBooking,
  releaseOfferBooking,
  computeTeamPayouts,
} from "../lib/marketEscrow.js";
import { store } from "../lib/store.js";
import { formatEUR } from "../lib/marketConstants.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

router.get("/status", (req, res) => {
  const payout = marketStore.payoutAccounts().find((a) => a.userId === req.user.id);
  const payment = marketStore.paymentMethods().find((a) => a.userId === req.user.id);
  res.json({
    mode: escrowMode(),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    payout: payout || null,
    paymentMethod: payment || null,
    payoutReady: payout?.status === "active" || payout?.status === "simulated" || escrowMode() === "simulation",
    paymentReady: payment?.status === "active" || payment?.status === "simulated" || escrowMode() === "simulation",
  });
});

router.post("/payout/onboard", (req, res) => {
  const all = marketStore.payoutAccounts();
  let row = all.find((a) => a.userId === req.user.id);
  const mode = escrowMode();
  if (mode === "stripe" || mode === "stripe_partial") {
    const url = process.env.STRIPE_CONNECT_ONBOARD_URL || "https://connect.stripe.com/setup/s/simulation";
    if (!row) {
      row = { userId: req.user.id, status: "pending", stripeAccountId: null, createdAt: new Date().toISOString() };
      all.push(row);
    }
    row.onboardUrl = url;
    row.updatedAt = new Date().toISOString();
    marketStore.setPayoutAccounts(all);
    return res.json({ ok: true, url, message: "Stripe Connect — Onboarding starten." });
  }
  if (!row) {
    row = { userId: req.user.id, status: "simulated", label: "Demo-Auszahlungskonto", createdAt: new Date().toISOString() };
    all.push(row);
  } else {
    row.status = "simulated";
    row.updatedAt = new Date().toISOString();
  }
  marketStore.setPayoutAccounts(all);
  res.json({ ok: true, simulated: true, message: "Auszahlungskonto verbunden (Demo)." });
});

router.post("/client/method", (req, res) => {
  const all = marketStore.paymentMethods();
  let row = all.find((a) => a.userId === req.user.id);
  const mode = escrowMode();
  if (mode === "stripe" || mode === "stripe_partial") {
    const url = process.env.STRIPE_CHECKOUT_SETUP_URL || null;
    if (!row) {
      row = { userId: req.user.id, status: "pending", createdAt: new Date().toISOString() };
      all.push(row);
    }
    row.setupUrl = url;
    row.updatedAt = new Date().toISOString();
    marketStore.setPaymentMethods(all);
    return res.json({ ok: true, url, message: "Zahlungsmittel hinterlegen (Stripe)." });
  }
  if (!row) {
    row = {
      userId: req.user.id,
      status: "simulated",
      label: "Demo-Karte ·••• 4242",
      brand: "visa",
      createdAt: new Date().toISOString(),
    };
    all.push(row);
  } else {
    row.status = "simulated";
    row.updatedAt = new Date().toISOString();
  }
  marketStore.setPaymentMethods(all);
  res.json({ ok: true, simulated: true, message: "Zahlungsmittel hinterlegt (Demo)." });
});

router.get("/payouts/mine", (req, res) => {
  const items = marketStore.payouts()
    .filter((p) => p.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  res.json(items);
});

/** Treuhand-Übersicht + Team-Split-Vorschau für ein Projekt. */
router.get("/project/:id", (req, res) => {
  const summary = getProjectEscrowSummary(Number(req.params.id));
  if (!summary) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const p = marketStore.projects().find((x) => x.id === summary.projectId);
  const isOwner = p?.ownerId === req.user.id;
  const isParticipant = summary.participants.some((part) => part.userId === req.user.id);
  if (!isOwner && !isParticipant && req.user.role !== "admin") {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  res.json(summary);
});

/** Geld in Treuhand einzahlen (Auftraggeber). */
router.post("/project/:id/fund", (req, res) => {
  const pid = Number(req.params.id);
  const amountCents = req.body?.amountCents ? Number(req.body.amountCents) : null;
  const result = fundProjectEscrow(pid, req.user.id, amountCents);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

/** Team-Vergütung zuweisen: gleich, Anteile, privat oder individuelle Beträge (eingefroren). */
router.post("/project/:id/splits", (req, res) => {
  const pid = Number(req.params.id);
  const { splitMode, allocations } = req.body || {};
  const result = setProjectSplitAllocations(pid, req.user.id, allocations, splitMode);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const preview = computeTeamPayouts(pid, marketStore.projects().find((p) => p.id === pid)?.escrowHeldCents || marketStore.projects().find((p) => p.id === pid)?.budgetCents || 0);
  const users = store.collection("users");
  res.json({
    ...result,
    splitPreview: preview.map((row) => ({
      ...row,
      name: users.find((u) => u.id === row.userId)?.name || `#${row.userId}`,
    })),
  });
});

/** Split-Vorschau für beliebigen Betrag (ohne Speichern). */
router.post("/project/:id/splits/preview", (req, res) => {
  const pid = Number(req.params.id);
  const p = marketStore.projects().find((x) => x.id === pid);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur Auftraggeber." });
  const amountCents = Number(req.body?.amountCents) || p.budgetCents || 0;
  const mode = req.body?.splitMode || p.splitMode || "equal";
  const saved = p.splitMode;
  const savedAlloc = p.splitAllocations;
  if (mode === "custom" && Array.isArray(req.body?.allocations)) {
    p.splitMode = "custom";
    p.splitAllocations = req.body.allocations;
  } else {
    p.splitMode = mode;
    p.splitAllocations = null;
  }
  const preview = computeTeamPayouts(pid, amountCents);
  p.splitMode = saved;
  p.splitAllocations = savedAlloc;
  const users = store.collection("users");
  res.json({
    amountCents,
    splitMode: mode,
    splitPreview: preview.map((row) => ({
      ...row,
      name: users.find((u) => u.id === row.userId)?.name || `#${row.userId}`,
      formatted: formatEUR(row.grossCents),
    })),
  });
});

/** Leistungsangebot bezahlen — Betrag in Treuhand. */
router.post("/bookings/:id/pay", (req, res) => {
  const result = payOfferBooking(Number(req.params.id), req.user.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

/** Leistungsangebot freigeben — Auszahlung an Anbieter. */
router.post("/bookings/:id/release", (req, res) => {
  const result = releaseOfferBooking(Number(req.params.id), req.user.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

export default router;

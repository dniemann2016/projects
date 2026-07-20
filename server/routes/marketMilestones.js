import { Router } from "express";
import { requireUser, requireAcceptedTerms, requireAdmin } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";
import { getMilestonesForProject } from "../lib/marketHelpers.js";
import { releaseMilestoneFunds, updateOwnerClientMetrics, processAutoReleases } from "../lib/marketEscrow.js";
import { notifyUser } from "../lib/marketNotifications.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

function canAccess(project, userId) {
  const parts = marketStore.participants().filter((x) => x.projectId === project.id && x.status === "active");
  return project.ownerId === userId || project.assignedTo === userId || parts.some((p) => p.userId === userId);
}

router.get("/project/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (!canAccess(p, req.user.id)) return res.status(403).json({ error: "Kein Zugriff." });
  const milestones = getMilestonesForProject(projectId);
  const escrowHeldCents = milestones.filter((m) => m.status !== "released").reduce((s, m) => s + m.amountCents, 0);
  const escrowReleasedCents = milestones.filter((m) => m.status === "released").reduce((s, m) => s + m.amountCents, 0);
  const payouts = marketStore.payouts().filter((x) => x.projectId === projectId);
  res.json({
    projectId,
    budgetCents: p.budgetCents,
    earlyBonusCents: p.earlyBonusCents || 0,
    escrowHeldCents,
    escrowReleasedCents,
    splitMode: p.splitMode || "equal",
    milestones,
    payouts: req.user.id === p.ownerId || p.assignedTo === req.user.id ? payouts : [],
  });
});

/** Fachperson reicht Meilenstein ein. */
router.post("/:id/submit", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.milestones();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Meilenstein nicht gefunden." });
  const m = all[idx];
  const p = marketStore.projects().find((x) => x.id === m.projectId);
  if (!p || p.assignedTo !== req.user.id) return res.status(403).json({ error: "Nur die zugewiesene Fachperson." });
  if (m.status !== "held") return res.status(400).json({ error: "Meilenstein nicht in Wartestellung." });
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  all[idx].status = "submitted";
  all[idx].submittedAt = new Date().toISOString();
  all[idx].reviewDeadline = deadline.toISOString();
  marketStore.setMilestones(all);
  notifyUser(p.ownerId, {
    type: "milestone_submit",
    title: "Meilenstein zur Prüfung",
    body: `„${m.name}" wartet auf deine Abnahme (7 Tage).`,
    linkProjectId: p.id,
  });
  res.json(all[idx]);
});

function doRelease(idx, all, { finalizeEarly = false } = {}) {
  const m = all[idx];
  const p = marketStore.projects().find((x) => x.id === m.projectId);
  if (!p) return null;
  all[idx].status = "released";
  all[idx].releasedAt = new Date().toISOString();
  if (finalizeEarly) all[idx].finalizeEarly = true;
  if (m.submittedAt) {
    const days = (Date.now() - new Date(m.submittedAt).getTime()) / 86400000;
    updateOwnerClientMetrics(p.ownerId, { approvalDays: Math.max(0, Math.round(days * 10) / 10), finalizeEarly });
  }
  releaseMilestoneFunds(all[idx], p, { finalizeEarly });
  return all[idx];
}

/** Auftraggeber nimmt ab → Freigabe. */
router.post("/:id/approve", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.milestones();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const m = all[idx];
  const p = marketStore.projects().find((x) => x.id === m.projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  if (m.status !== "submitted") return res.status(400).json({ error: "Nicht zur Prüfung eingereicht." });
  doRelease(idx, all, { finalizeEarly: false });
  marketStore.setMilestones(all);
  res.json(all[idx]);
});

/** Finalize Early — vorzeitige Freigabe (positiv für Auftraggeber-Ruf). */
router.post("/:id/finalize-early", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.milestones();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const m = all[idx];
  const p = marketStore.projects().find((x) => x.id === m.projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  if (m.status !== "submitted") return res.status(400).json({ error: "Nur eingereichte Meilensteine vorzeitig freigeben." });
  doRelease(idx, all, { finalizeEarly: true });
  marketStore.setMilestones(all);
  res.json(all[idx]);
});

/** Auftraggeber beanstandet → Auszahlung stoppt. */
router.post("/:id/dispute", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.milestones();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const m = all[idx];
  const p = marketStore.projects().find((x) => x.id === m.projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  all[idx].status = "disputed";
  all[idx].disputeReason = String(req.body?.reason || "").slice(0, 300);
  all[idx].disputedAt = new Date().toISOString();
  marketStore.setMilestones(all);
  notifyUser(p.assignedTo, {
    type: "dispute",
    title: "Streitfall gemeldet",
    body: `Meilenstein „${m.name}" — Auszahlung pausiert.`,
    linkProjectId: p.id,
  });
  res.json(all[idx]);
});

/** Admin: Streitfall Meilenstein lösen. */
router.get("/admin/disputes", requireAdmin, (_req, res) => {
  const items = marketStore.milestones()
    .filter((m) => m.status === "disputed")
    .map((m) => {
      const p = marketStore.projects().find((x) => x.id === m.projectId);
      return { ...m, projectTitle: p?.title || "" };
    });
  res.json(items);
});

router.post("/admin/disputes/:id/resolve", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const decision = req.body?.decision === "release" ? "release" : "refund";
  const all = marketStore.milestones();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (all[idx].status !== "disputed") return res.status(400).json({ error: "Kein Streitfall." });
  const p = marketStore.projects().find((x) => x.id === all[idx].projectId);
  if (decision === "release") {
    doRelease(idx, all, { finalizeEarly: false });
  } else {
    all[idx].status = "refunded";
    all[idx].resolvedAt = new Date().toISOString();
    all[idx].resolution = "refund";
  }
  marketStore.setMilestones(all);
  if (p) {
    notifyUser(p.ownerId, { type: "dispute_resolved", title: "Streit entschieden", body: decision === "release" ? "Freigabe" : "Rückerstattung", linkProjectId: p.id });
    notifyUser(p.assignedTo, { type: "dispute_resolved", title: "Streit entschieden", body: decision === "release" ? "Freigabe" : "Rückerstattung", linkProjectId: p.id });
  }
  res.json(all[idx]);
});

/** Cron-Hook — auch manuell aufrufbar. */
router.post("/process-auto-release", requireAdmin, (_req, res) => {
  const n = processAutoReleases();
  res.json({ ok: true, released: n });
});

export default router;

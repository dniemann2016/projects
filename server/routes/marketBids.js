import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore, hasNda } from "../lib/marketStore.js";
import { createDefaultMilestones, projectAcceptsApplications, syncProjectAfterParticipant } from "../lib/marketHelpers.js";
import { canBid, holdEscrowForProject, canPostProject } from "../lib/marketEscrow.js";
import { notifyBidReceived } from "../lib/marketNotifications.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

router.post("/", (req, res) => {
  const { projectId, message, priceCents, teamId, suggestedUserId } = req.body || {};
  const pid = Number(projectId);
  const p = marketStore.projects().find((x) => x.id === pid);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (p.payModel === "contest") return res.status(400).json({ error: "Wettbewerb — keine Bewerbung nötig. Einfach Arbeit einreichen." });
  if (!projectAcceptsApplications(p)) return res.status(400).json({ error: "Projekt nimmt keine Bewerbungen an." });
  if (p.ownerId === req.user.id) return res.status(400).json({ error: "Eigene Projekte nicht bewerben." });
  const bidCheck = canBid(req.user.id);
  if (!bidCheck.ok) {
    return res.status(403).json({
      error: !bidCheck.payoutOk
        ? "Auszahlungskonto verbinden — unter Konto → Auszahlung."
        : "Mindestens eine Arbeitsprobe hochladen — unter Profil.",
      bidCheck,
    });
  }
  if (p.ndaLevel > 0 && !hasNda(req.user.id, pid)) {
    return res.status(403).json({ error: "Zuerst Geheimhaltung bestätigen." });
  }
  const msg = String(message || "").trim();
  if (!msg || msg.length > 400) {
    return res.status(400).json({ error: "Nachricht: 1–400 Zeichen." });
  }
  if (teamId) {
    const tid = Number(teamId);
    const member = marketStore.teamMembers().find(
      (m) => m.teamId === tid && m.userId === req.user.id && m.status === "active"
    );
    if (!member) return res.status(403).json({ error: "Du bist nicht in diesem Team." });
  }
  const bids = marketStore.bids();
  if (bids.some((b) => b.projectId === pid && b.bidderId === req.user.id)) {
    return res.status(400).json({ error: "Du hast dich bereits beworben." });
  }
  const bid = {
    id: marketStore.nextBidId(),
    projectId: pid,
    bidderId: req.user.id,
    message: msg,
    priceCents: priceCents ? Number(priceCents) : null,
    teamId: teamId ? Number(teamId) : null,
    suggestedUserId: suggestedUserId ? Number(suggestedUserId) : null,
    status: "sent",
    createdAt: new Date().toISOString(),
  };
  bids.push(bid);
  marketStore.setBids(bids);
  notifyBidReceived(p);
  if (bid.suggestedUserId) {
    const suggestions = marketStore.suggestions();
    suggestions.push({
      id: suggestions.length ? Math.max(...suggestions.map((s) => s.id)) + 1 : 1,
      type: "person_on_bid",
      projectId: pid,
      fromUserId: req.user.id,
      toUserId: bid.suggestedUserId,
      bidId: bid.id,
      message: `Mitbewerber-Vorschlag zur Bewerbung`,
      status: "awaiting_owner",
      createdAt: new Date().toISOString(),
    });
    marketStore.setSuggestions(suggestions);
  }
  res.status(201).json(bid);
});

router.post("/:id/accept", (req, res) => {
  const bidId = Number(req.params.id);
  const bids = marketStore.bids();
  const bidx = bids.findIndex((b) => b.id === bidId);
  if (bidx === -1) return res.status(404).json({ error: "Bewerbung nicht gefunden." });
  const bid = bids[bidx];
  const projects = marketStore.projects();
  const pidx = projects.findIndex((p) => p.id === bid.projectId);
  if (pidx === -1) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (projects[pidx].ownerId !== req.user.id) {
    return res.status(403).json({ error: "Nur der Auftraggeber kann annehmen." });
  }
  if (!projectAcceptsApplications(projects[pidx])) {
    return res.status(400).json({ error: "Projekt ist nicht mehr offen." });
  }
  bids[bidx].status = "accepted";
  const parts = marketStore.participants();
  if (!parts.some((x) => x.projectId === bid.projectId && x.userId === bid.bidderId && x.status === "active")) {
    parts.push({
      id: parts.length ? Math.max(...parts.map((p) => p.id)) + 1 : 1,
      projectId: bid.projectId,
      userId: bid.bidderId,
      bidId: bid.id,
      teamId: bid.teamId || null,
      status: "active",
      joinedAt: new Date().toISOString(),
    });
    marketStore.setParticipants(parts);
  }
  syncProjectAfterParticipant(projects[pidx]);
  if (!projects[pidx].assignedTo) projects[pidx].assignedTo = bid.bidderId;
  projects[pidx].assignedTeamId = bid.teamId || null;
  projects[pidx].assignedAt = new Date().toISOString();
  holdEscrowForProject(projects[pidx], projects[pidx].budgetCents);
  if (!marketStore.milestones().some((m) => m.projectId === bid.projectId)) {
    const ms = createDefaultMilestones(bid.projectId, projects[pidx].budgetCents);
    marketStore.setMilestones([...marketStore.milestones(), ...ms]);
  }
  marketStore.setBids(bids);
  marketStore.setProjects(projects);
  res.json({ ok: true, projectId: bid.projectId, escrowHeldCents: projects[pidx].escrowHeldCents });
});

router.post("/:id/reject", (req, res) => {
  const bidId = Number(req.params.id);
  const bids = marketStore.bids();
  const bidx = bids.findIndex((b) => b.id === bidId);
  if (bidx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const projects = marketStore.projects();
  const p = projects.find((x) => x.id === bids[bidx].projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Kein Zugriff." });
  bids[bidx].status = "rejected";
  marketStore.setBids(bids);
  res.json({ ok: true });
});

export default router;

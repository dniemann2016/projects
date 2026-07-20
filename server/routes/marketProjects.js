import { Router } from "express";
import { requireUser, requireAdmin, requireAcceptedTerms, currentUser } from "../lib/currentUser.js";
import { marketStore, projectPublic, hasNda } from "../lib/marketStore.js";
import { CATEGORIES, PAY_MODELS, WINNER_CRITERIA, formatEUR } from "../lib/marketConstants.js";
import { store } from "../lib/store.js";
import { enrichProjectListItem, getProjectStaffing, enrichBid } from "../lib/marketHelpers.js";
import { canPostProject } from "../lib/marketEscrow.js";

const router = Router();

router.get("/meta", (_req, res) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const assigned = marketStore.projects().filter(
    (p) => p.assignedAt && new Date(p.assignedAt).getTime() >= weekAgo
  );
  const weekCount = assigned.length;
  const weekSumCents = assigned.reduce((s, p) => s + (p.budgetCents || 0), 0);
  res.json({
    categories: CATEGORIES,
    payModels: PAY_MODELS,
    winnerCriteria: WINNER_CRITERIA,
    weekStats: { count: weekCount, sumCents: weekSumCents },
  });
});

/** Öffentliche Projektliste — ohne Beschreibung (NDA-Schutz). */
router.get("/", (req, res) => {
  const { category, hiringMode, staffing, q, for: forType } = req.query;
  const user = currentUser(req);
  let items = marketStore.projects().filter(
    (p) => p.status === "open" || p.status === "assigned" || (user && p.ownerId === user.id)
  );
  if (category) items = items.filter((p) => p.category === category);
  if (hiringMode) items = items.filter((p) => (p.hiringMode || (p.teamRecommended ? "team" : "solo")) === hiringMode);
  if (forType === "solo") items = items.filter((p) => ["solo", "both"].includes(p.hiringMode || (p.teamRecommended ? "team" : "solo")));
  if (forType === "team") items = items.filter((p) => ["team", "both"].includes(p.hiringMode || (p.teamRecommended ? "team" : "solo")));
  items = items.map(enrichProjectListItem);
  if (staffing) items = items.filter((p) => p.staffingStatus === staffing);
  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) => p.title?.toLowerCase().includes(needle) || p.staffingLabel?.toLowerCase().includes(needle));
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

router.get("/mine", requireUser, requireAcceptedTerms, (req, res) => {
  const owned = marketStore.projects()
    .filter((p) => p.ownerId === req.user.id)
    .map(enrichProjectListItem);
  const assigned = marketStore.projects()
    .filter((p) => p.assignedTo === req.user.id)
    .map(enrichProjectListItem);
  res.json({ owned, assigned });
});

router.get("/admin/queue", requireAdmin, requireAcceptedTerms, (_req, res) => {
  const items = marketStore.projects()
    .filter((p) => p.status === "pending_review")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(items);
});

router.get("/:id", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const p = marketStore.projects().find((x) => x.id === id);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const isOwner = p.ownerId === req.user.id;
  const isAssigned = p.assignedTo === req.user.id;
  const isAdmin = req.user.role === "admin";
  const canRead =
    isOwner || isAssigned || isAdmin ||
    p.ndaLevel === 0 ||
    hasNda(req.user.id, id);
  const out = { ...projectPublic(p) };
  if (canRead) {
    out.description = p.description;
    out.canReadFull = true;
  } else {
    out.description = null;
    out.canReadFull = false;
    out.ndaRequired = p.ndaLevel > 0;
    if (p.publicSummary) out.publicSummary = p.publicSummary;
  }
  out.ideaProtected = p.ndaLevel >= 3;
  out.realizationOnly = p.ndaLevel > 0;
  out.hasNda = hasNda(req.user.id, id);
  const staffing = getProjectStaffing(p);
  out.staffing = staffing;
  out.staffingLabel = staffing.label;
  out.bidCount = marketStore.bids().filter((b) => b.projectId === id).length;
  const allParticipants = marketStore.participants()
    .filter((x) => x.projectId === id && x.status === "active")
    .map((part) => {
      const u = store.collection("users").find((x) => x.id === part.userId);
      const prof = marketStore.profiles().find((pr) => pr.userId === part.userId);
      return { ...part, name: u?.name || "Nutzer", headline: prof?.headline || "", skills: prof?.skills || [] };
    });
  if (isOwner || isAssigned || isAdmin) out.participants = allParticipants;
  else if (allParticipants.length) {
    out.participantsPublic = allParticipants.map((x) => ({ name: x.name, headline: x.headline }));
  }
  if (isOwner || isAdmin) {
    out.bids = marketStore.bids()
      .filter((b) => b.projectId === id)
      .map(enrichBid);
    out.ownerSuggestions = marketStore.suggestions()
      .filter((s) => s.projectId === id && s.status === "awaiting_owner")
      .map((s) => ({
        ...s,
        fromName: store.collection("users").find((u) => u.id === s.fromUserId)?.name || "Nutzer",
        toName: store.collection("users").find((u) => u.id === s.toUserId)?.name || "Nutzer",
      }));
  }
  if (!out.hiringMode) {
    out.hiringMode = out.teamRecommended ? "team" : "solo";
  }
  res.json(out);
});

router.post("/", requireUser, requireAcceptedTerms, (req, res) => {
  const postCheck = canPostProject(req.user.id);
  if (!postCheck.ok) {
    return res.status(403).json({
      error: "Zahlungsmittel hinterlegen — unter Konto → Zahlung, bevor du Projekte einstellst.",
      postCheck,
    });
  }
  const {
    title, description, publicSummary, category, budgetCents, budgetType = "fixed",
    location, durationLabel, ndaLevel = 1, successFee, teamRecommended, hiringMode,
    payModel = "fixed", winnerCriteria, contestDeadline, taskMode, splitMode,
  } = req.body || {};
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Titel und vollständige Beschreibung sind Pflicht." });
  }
  const level = Math.min(3, Math.max(0, Number(ndaLevel) || 0));
  const summary = publicSummary ? String(publicSummary).trim().slice(0, 1200) : "";
  if (level >= 2 && !summary) {
    return res.status(400).json({ error: "Bei geschützten Projekten: öffentliche Stichpunkte angeben (ohne Geheimnisse)." });
  }
  if (!CATEGORIES.some((c) => c.id === category)) {
    return res.status(400).json({ error: "Ungültige Kategorie." });
  }
  const pay = PAY_MODELS.some((m) => m.id === payModel) ? payModel : "fixed";
  if (pay === "contest" && level > 1) {
    return res.status(400).json({ error: "Wettbewerbe funktionieren nur öffentlich oder mit Stufe 1 — alle sollen mitmachen können." });
  }
  const isContest = pay === "contest";
  const mode = isContest ? "solo" : (hiringMode || (teamRecommended ? "team" : "solo"));
  const teamSlots = Number(req.body?.teamSlots) || (mode === "solo" ? 1 : 4);
  const projects = marketStore.projects();
  const project = {
    id: marketStore.nextProjectId(),
    ownerId: req.user.id,
    title: String(title).trim().slice(0, 120),
    description: String(description).trim().slice(0, 8000),
    publicSummary: level > 0 ? summary : null,
    category,
    budgetCents: Math.max(0, Number(budgetCents) || 0),
    budgetType,
    payModel: pay,
    winnerCriteria: isContest && WINNER_CRITERIA.some((c) => c.id === winnerCriteria) ? winnerCriteria : (isContest ? "best" : null),
    contestDeadline: isContest && contestDeadline ? String(contestDeadline).slice(0, 30) : null,
    taskMode: taskMode === "owner" ? "owner" : "team",
    splitMode: ["equal", "shares", "private", "custom"].includes(splitMode) ? splitMode : "equal",
    splitPreset: req.body?.splitPreset === "80_20" ? "80_20" : null,
    unitPriceCents: pay === "quantity" ? Math.max(0, Number(req.body?.unitPriceCents) || 0) : null,
    unitLabel: pay === "quantity" ? String(req.body?.unitLabel || "Einheit").slice(0, 40) : null,
    location: location ? String(location).slice(0, 80) : null,
    durationLabel: durationLabel ? String(durationLabel).slice(0, 40) : "nach Absprache",
    ndaLevel: level,
    successFee: pay === "success" && !successFee ? "Nach Vereinbarung" : (successFee ? String(successFee).slice(0, 300) : null),
    hiringMode: ["solo", "team", "both"].includes(mode) ? mode : "both",
    teamRecommended: !isContest && (mode === "team" || mode === "both"),
    teamSlots: mode === "solo" ? 1 : Math.max(2, Math.min(20, teamSlots)),
    workMode: req.body?.workMode === "remote" || req.body?.workMode === "hybrid" || req.body?.workMode === "onsite"
      ? req.body.workMode : (location && /remote|fern/i.test(location) ? "remote" : null),
    status: "pending_review",
    assignedTo: null,
    createdAt: new Date().toISOString(),
  };
  projects.push(project);
  marketStore.setProjects(projects);
  res.status(201).json(projectPublic(project));
});

/** Aufgaben-Verteilung einstellen: owner = nur Auftraggeber delegiert · team = Team verteilt selbst */
router.post("/:id/task-mode", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (projects[idx].ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  const mode = req.body?.taskMode === "owner" ? "owner" : "team";
  projects[idx].taskMode = mode;
  marketStore.setProjects(projects);
  res.json({ ok: true, taskMode: mode });
});

router.post("/:id/publish", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (projects[idx].ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  if (projects[idx].status !== "draft") {
    return res.status(400).json({ error: "Nur Entwürfe können veröffentlicht werden." });
  }
  projects[idx].status = "pending_review";
  marketStore.setProjects(projects);
  res.json(projectPublic(projects[idx]));
});

router.post("/:id/nda", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const p = marketStore.projects().find((x) => x.id === id);
  if (!p) return res.status(404).json({ error: "Nicht gefunden." });
  if (p.ndaLevel === 0) return res.json({ ok: true, level: 0 });
  if (hasNda(req.user.id, id)) return res.json({ ok: true, already: true });
  const typedName = req.body?.typedName;
  const acceptIdeaTerms = Boolean(req.body?.acceptIdeaTerms);
  if (p.ndaLevel >= 3 && !acceptIdeaTerms) {
    return res.status(400).json({ error: "Ideen-Schutz-Bedingungen müssen ausdrücklich akzeptiert werden." });
  }
  if (p.ndaLevel >= 2 && !typedName?.trim()) {
    return res.status(400).json({ error: "Bei Stufe 2/3: vollständigen Namen zur Bestätigung eingeben." });
  }
  const rows = marketStore.nda();
  rows.push({
    id: rows.length + 1,
    projectId: id,
    userId: req.user.id,
    ndaLevel: p.ndaLevel,
    typedName: typedName?.trim() || null,
    acceptIdeaTerms: p.ndaLevel >= 3 ? acceptIdeaTerms : false,
    acceptedAt: new Date().toISOString(),
  });
  marketStore.setNda(rows);
  res.json({ ok: true });
});

/** Admin: Freigabe oder Ablehnung. */
router.post("/:id/review", requireAdmin, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const { approve, reason } = req.body || {};
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (projects[idx].status !== "pending_review") {
    return res.status(400).json({ error: "Projekt ist nicht in der Prüf-Warteschlange." });
  }
  projects[idx].status = approve ? "open" : "rejected";
  if (!approve && reason) projects[idx].rejectReason = String(reason).slice(0, 500);
  marketStore.setProjects(projects);
  res.json(projectPublic(projects[idx]));
});

router.post("/:id/complete", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const p = projects[idx];
  if (p.ownerId !== req.user.id && p.assignedTo !== req.user.id) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  if (p.status !== "assigned") return res.status(400).json({ error: "Projekt muss vergeben sein." });
  projects[idx].status = "completed";
  projects[idx].completedAt = new Date().toISOString();
  marketStore.setProjects(projects);
  res.json({ ok: true, budget: formatEUR(p.budgetCents) });
});

export default router;

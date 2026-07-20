import { Router } from "express";
import { requireUser, requireAdmin, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore, hasNda } from "../lib/marketStore.js";
import { store } from "../lib/store.js";

const router = Router();

function userName(id) {
  return store.collection("users").find((u) => u.id === id)?.name || "Nutzer";
}

function nextId(items) {
  return items.length ? Math.max(...items.map((x) => x.id)) + 1 : 1;
}

function contestProject(projectId) {
  const p = marketStore.projects().find((x) => x.id === Number(projectId));
  if (!p || p.payModel !== "contest") return null;
  return p;
}

function enrichSubmission(s, { withUser = true } = {}) {
  return {
    ...s,
    userName: withUser ? userName(s.userId) : undefined,
    headline: marketStore.profiles().find((pr) => pr.userId === s.userId)?.headline || "",
  };
}

function deadlinePassed(p) {
  return Boolean(p.contestDeadline && new Date(p.contestDeadline).getTime() < Date.now());
}

/** Einreichungen eines Wettbewerbs — Besitzer sieht alle, Teilnehmer nur die eigene. */
router.get("/:projectId/submissions", requireUser, requireAcceptedTerms, (req, res) => {
  const p = contestProject(req.params.projectId);
  if (!p) return res.status(404).json({ error: "Wettbewerb nicht gefunden." });
  const all = marketStore.submissions().filter((s) => s.projectId === p.id);
  const isOwner = p.ownerId === req.user.id || req.user.role === "admin";
  const mine = all.find((s) => s.userId === req.user.id);
  res.json({
    projectId: p.id,
    prizeCents: p.budgetCents,
    winnerCriteria: p.winnerCriteria || "best",
    contestDeadline: p.contestDeadline || null,
    deadlinePassed: deadlinePassed(p),
    submissionCount: all.length,
    winnerSubmissionId: all.find((s) => s.status === "winner")?.id || null,
    submissions: isOwner ? all.map((s) => enrichSubmission(s)) : [],
    mySubmission: mine ? enrichSubmission(mine, { withUser: false }) : null,
  });
});

/** Arbeit einreichen — jeder kann mitmachen, ohne Bewerbung. Erneutes Senden aktualisiert. */
router.post("/:projectId/submit", requireUser, requireAcceptedTerms, (req, res) => {
  const p = contestProject(req.params.projectId);
  if (!p) return res.status(404).json({ error: "Wettbewerb nicht gefunden." });
  if (p.status !== "open") return res.status(400).json({ error: "Wettbewerb ist nicht offen." });
  if (p.ownerId === req.user.id) return res.status(400).json({ error: "Eigener Wettbewerb — Einreichen nicht möglich." });
  if (deadlinePassed(p)) return res.status(400).json({ error: "Die Einreichfrist ist abgelaufen." });
  if (p.ndaLevel > 0 && !hasNda(req.user.id, p.id)) {
    return res.status(403).json({ error: "Zuerst Vertraulichkeit bestätigen." });
  }
  const note = String(req.body?.note || "").trim();
  const link = String(req.body?.link || "").trim();
  if (!note && !link) return res.status(400).json({ error: "Kurze Beschreibung oder Link zur Arbeit angeben." });
  const all = marketStore.submissions();
  const existing = all.findIndex((s) => s.projectId === p.id && s.userId === req.user.id);
  const now = new Date().toISOString();
  if (existing !== -1) {
    if (all[existing].status !== "submitted") return res.status(400).json({ error: "Einreichung ist bereits entschieden." });
    all[existing].note = note.slice(0, 2000);
    all[existing].link = link.slice(0, 500);
    all[existing].updatedAt = now;
    marketStore.setSubmissions(all);
    return res.json({ ok: true, updated: true, submission: all[existing] });
  }
  const row = {
    id: nextId(all),
    projectId: p.id,
    userId: req.user.id,
    note: note.slice(0, 2000),
    link: link.slice(0, 500),
    status: "submitted",
    submittedAt: now,
    trustSeal: { at: now, userId: req.user.id, ipHash: "local", protocol: "submission_v1" },
  };
  all.push(row);
  marketStore.setSubmissions(all);
  res.status(201).json({ ok: true, submission: row });
});

/** Eigene Einreichung zurückziehen. */
router.post("/submissions/:id/withdraw", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.submissions();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (all[idx].userId !== req.user.id) return res.status(403).json({ error: "Nur die eigene Einreichung." });
  if (all[idx].status !== "submitted") return res.status(400).json({ error: "Bereits entschieden." });
  all.splice(idx, 1);
  marketStore.setSubmissions(all);
  res.json({ ok: true });
});

/** Besitzer kürt Gewinner — Preisgeld (Treuhand) wird freigegeben, Wettbewerb abgeschlossen. */
router.post("/submissions/:id/winner", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.submissions();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Einreichung nicht gefunden." });
  const sub = all[idx];
  const projects = marketStore.projects();
  const pidx = projects.findIndex((x) => x.id === sub.projectId);
  const p = projects[pidx];
  if (!p || p.payModel !== "contest") return res.status(404).json({ error: "Wettbewerb nicht gefunden." });
  if (p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber kürt den Gewinner." });
  if (all.some((s) => s.projectId === p.id && s.status === "winner")) {
    return res.status(400).json({ error: "Gewinner ist bereits gekürt." });
  }
  const openDispute = marketStore.disputes().some((d) => d.projectId === p.id && d.status === "open");
  if (openDispute) return res.status(400).json({ error: "Offener Streitfall — erst Klärung durch den Markt abwarten." });

  const now = new Date().toISOString();
  for (const s of all) {
    if (s.projectId !== p.id) continue;
    s.status = s.id === id ? "winner" : "lost";
    s.decidedAt = now;
  }
  marketStore.setSubmissions(all);

  projects[pidx].assignedTo = sub.userId;
  projects[pidx].assignedAt = now;
  projects[pidx].status = "completed";
  projects[pidx].completedAt = now;
  marketStore.setProjects(projects);

  // Preisgeld als freigegebener Treuhand-Posten
  const milestones = marketStore.milestones();
  milestones.push({
    id: nextId(milestones),
    projectId: p.id,
    name: "Preisgeld · Wettbewerb",
    amountCents: p.budgetCents,
    status: "released",
    submittedAt: now,
    releasedAt: now,
    createdAt: now,
  });
  marketStore.setMilestones(milestones);

  const parts = marketStore.participants();
  if (!parts.some((x) => x.projectId === p.id && x.userId === sub.userId && x.status === "active")) {
    parts.push({ id: nextId(parts), projectId: p.id, userId: sub.userId, bidId: null, status: "active", joinedAt: now });
    marketStore.setParticipants(parts);
  }

  res.json({ ok: true, winnerUserId: sub.userId, prizeCents: p.budgetCents });
});

/** Streitfall eröffnen — der Markt (Admin, ggf. + Experte) entscheidet. */
router.post("/:projectId/dispute", requireUser, requireAcceptedTerms, (req, res) => {
  const p = contestProject(req.params.projectId);
  if (!p) return res.status(404).json({ error: "Wettbewerb nicht gefunden." });
  const involved = p.ownerId === req.user.id
    || marketStore.submissions().some((s) => s.projectId === p.id && s.userId === req.user.id);
  if (!involved) return res.status(403).json({ error: "Nur Beteiligte können einen Streitfall eröffnen." });
  const reason = String(req.body?.reason || "").trim();
  if (!reason) return res.status(400).json({ error: "Kurz beschreiben, worum es geht." });
  const all = marketStore.disputes();
  if (all.some((d) => d.projectId === p.id && d.status === "open")) {
    return res.status(400).json({ error: "Es läuft bereits ein Streitfall zu diesem Wettbewerb." });
  }
  const row = {
    id: nextId(all),
    projectId: p.id,
    openedByUserId: req.user.id,
    reason: reason.slice(0, 1000),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  all.push(row);
  marketStore.setDisputes(all);
  res.status(201).json({ ok: true, dispute: row });
});

/** Admin: offene Streitfälle. */
router.get("/admin/disputes", requireAdmin, requireAcceptedTerms, (_req, res) => {
  const all = marketStore.disputes().filter((d) => d.status === "open");
  res.json(all.map((d) => ({
    ...d,
    openedByName: userName(d.openedByUserId),
    projectTitle: marketStore.projects().find((p) => p.id === d.projectId)?.title || "",
    submissions: marketStore.submissions().filter((s) => s.projectId === d.projectId).map((s) => enrichSubmission(s)),
  })));
});

/** Admin entscheidet: Begründung + optional Gewinner-Einreichung. */
router.post("/disputes/:id/resolve", requireAdmin, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.disputes();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (all[idx].status !== "open") return res.status(400).json({ error: "Bereits entschieden." });
  const decision = String(req.body?.decision || "").trim();
  if (!decision) return res.status(400).json({ error: "Entscheidung begründen." });
  all[idx].status = "resolved";
  all[idx].decision = decision.slice(0, 1000);
  all[idx].resolvedAt = new Date().toISOString();
  all[idx].resolvedByUserId = req.user.id;
  marketStore.setDisputes(all);
  res.json({ ok: true, dispute: all[idx] });
});

export default router;

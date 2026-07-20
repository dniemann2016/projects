import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore, profilePublic } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { enrichBid, syncProjectAfterParticipant } from "../lib/marketHelpers.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

function userName(id) {
  return store.collection("users").find((u) => u.id === id)?.name || "Nutzer";
}

function nextId(col) {
  const items = col();
  return items.length ? Math.max(...items.map((x) => x.id)) + 1 : 1;
}

function enrichParticipant(part) {
  const u = store.collection("users").find((x) => x.id === part.userId);
  const prof = marketStore.profiles().find((p) => p.userId === part.userId);
  return {
    ...part,
    name: u?.name || "Nutzer",
    headline: prof?.headline || "",
    skills: prof?.skills || [],
    rating: prof?.rating ?? null,
  };
}

/** Beteiligte eines Projekts */
router.get("/participants/project/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const me = req.user.id;
  const isOwner = p.ownerId === me;
  const isMember = marketStore.participants().some((x) => x.projectId === projectId && x.userId === me && x.status === "active");
  if (!isOwner && !isMember && p.assignedTo !== me) return res.status(403).json({ error: "Kein Zugriff." });
  const list = marketStore.participants()
    .filter((x) => x.projectId === projectId && x.status === "active")
    .map(enrichParticipant);
  res.json({ projectId, participants: list });
});

router.post("/participants/:id/remove", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.participants();
  const idx = all.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const part = all[idx];
  const p = marketStore.projects().find((x) => x.id === part.projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  all[idx].status = "removed";
  all[idx].removedAt = new Date().toISOString();
  marketStore.setParticipants(all);
  const bids = marketStore.bids();
  const bidx = bids.findIndex((b) => b.id === part.bidId);
  if (bidx !== -1) {
    bids[bidx].status = "removed";
    marketStore.setBids(bids);
  }
  res.json({ ok: true });
});

/** Auftraggeber lädt Person(en) ein */
router.get("/invites/mine", (req, res) => {
  const uid = req.user.id;
  const all = marketStore.invites();
  const map = (i) => ({
    ...i,
    fromName: userName(i.fromUserId),
    toName: userName(i.toUserId),
    projectTitle: marketStore.projects().find((p) => p.id === i.projectId)?.title || "",
  });
  res.json({
    received: all.filter((i) => i.toUserId === uid && i.status === "pending").map(map),
    sent: all.filter((i) => i.fromUserId === uid).map(map),
  });
});

router.post("/invites", (req, res) => {
  const { projectId, userId, userIds, message } = req.body || {};
  const pid = Number(projectId);
  const p = marketStore.projects().find((x) => x.id === pid);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  // Auch „In Prüfung“: Auftraggeber soll sofort Personen einladen können.
  if (!["pending_review", "open", "assigned"].includes(p.status)) {
    return res.status(400).json({ error: "Projekt nimmt keine Einladungen an." });
  }
  const targets = [...(userIds || []), userId].filter(Boolean).map(Number);
  if (!targets.length) return res.status(400).json({ error: "Mindestens eine Person wählen." });
  const invites = marketStore.invites();
  const created = [];
  let nextInviteId = nextId(() => invites);
  for (const tid of targets) {
    if (tid === req.user.id) continue;
    if (invites.some((i) => i.projectId === pid && i.toUserId === tid && i.status === "pending")) continue;
    const row = {
      id: nextInviteId++,
      projectId: pid,
      fromUserId: req.user.id,
      toUserId: tid,
      message: message ? String(message).slice(0, 300) : null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    invites.push(row);
    created.push(row);
  }
  marketStore.setInvites(invites);
  res.status(201).json({ ok: true, invites: created });
});

router.post("/invites/:id/accept", (req, res) => {
  const id = Number(req.params.id);
  const invites = marketStore.invites();
  const idx = invites.findIndex((i) => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (invites[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Nur der Eingeladene." });
  invites[idx].status = "accepted";
  invites[idx].respondedAt = new Date().toISOString();
  marketStore.setInvites(invites);
  addParticipant(invites[idx].projectId, req.user.id, null);
  res.json({ ok: true, projectId: invites[idx].projectId });
});

router.post("/invites/:id/decline", (req, res) => {
  const id = Number(req.params.id);
  const invites = marketStore.invites();
  const idx = invites.findIndex((i) => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (invites[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Kein Zugriff." });
  invites[idx].status = "declined";
  marketStore.setInvites(invites);
  res.json({ ok: true });
});

function addParticipant(projectId, userId, bidId) {
  const parts = marketStore.participants();
  if (parts.some((p) => p.projectId === projectId && p.userId === userId && p.status === "active")) return;
  parts.push({
    id: nextId(() => parts),
    projectId,
    userId,
    bidId,
    status: "active",
    joinedAt: new Date().toISOString(),
  });
  marketStore.setParticipants(parts);
  const projects = marketStore.projects();
  const pidx = projects.findIndex((p) => p.id === projectId);
  if (pidx !== -1) {
    syncProjectAfterParticipant(projects[pidx]);
    if (!projects[pidx].assignedTo) projects[pidx].assignedTo = userId;
    projects[pidx].assignedAt = projects[pidx].assignedAt || new Date().toISOString();
    marketStore.setProjects(projects);
  }
}

/** Vorschläge & Kooperations-Anfragen */
router.get("/suggestions/mine", (req, res) => {
  const uid = req.user.id;
  const all = marketStore.suggestions();
  const map = (s) => ({
    ...s,
    fromName: userName(s.fromUserId),
    toName: userName(s.toUserId),
    projectTitle: marketStore.projects().find((p) => p.id === s.projectId)?.title || "",
  });
  res.json({
    incoming: all.filter((s) => s.toUserId === uid && s.status === "pending").map(map),
    outgoing: all.filter((s) => s.fromUserId === uid).map(map),
    forOwner: all.filter((s) => {
      const p = marketStore.projects().find((x) => x.id === s.projectId);
      return p?.ownerId === uid && s.status === "awaiting_owner";
    }).map(map),
  });
});

router.post("/suggestions/person", (req, res) => {
  const { projectId, suggestedUserId, message, bidId } = req.body || {};
  const pid = Number(projectId);
  const sid = Number(suggestedUserId);
  if (!pid || !sid) return res.status(400).json({ error: "Projekt und Person nötig." });
  const p = marketStore.projects().find((x) => x.id === pid);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const suggestions = marketStore.suggestions();
  const row = {
    id: nextId(() => suggestions),
    type: "person_on_bid",
    projectId: pid,
    fromUserId: req.user.id,
    toUserId: sid,
    bidId: bidId ? Number(bidId) : null,
    message: message ? String(message).slice(0, 300) : null,
    status: "awaiting_owner",
    createdAt: new Date().toISOString(),
  };
  suggestions.push(row);
  marketStore.setSuggestions(suggestions);
  res.status(201).json({ ok: true, suggestion: row });
});

router.post("/suggestions/project", (req, res) => {
  const { projectId, toUserId, message } = req.body || {};
  const pid = Number(projectId);
  const tid = Number(toUserId);
  if (!pid || !tid) return res.status(400).json({ error: "Projekt und Person nötig." });
  const suggestions = marketStore.suggestions();
  const row = {
    id: nextId(() => suggestions),
    type: "project_to_person",
    projectId: pid,
    fromUserId: req.user.id,
    toUserId: tid,
    message: message ? String(message).slice(0, 300) : null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  suggestions.push(row);
  marketStore.setSuggestions(suggestions);
  res.status(201).json({ ok: true });
});

router.post("/suggestions/cowork", (req, res) => {
  const { projectId, withUserId, message } = req.body || {};
  const pid = Number(projectId);
  const wid = Number(withUserId);
  if (!pid || !wid) return res.status(400).json({ error: "Projekt und Partner nötig." });
  const suggestions = marketStore.suggestions();
  const row = {
    id: nextId(() => suggestions),
    type: "cowork_request",
    projectId: pid,
    fromUserId: req.user.id,
    toUserId: wid,
    message: message ? String(message).slice(0, 300) : null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  suggestions.push(row);
  marketStore.setSuggestions(suggestions);
  res.status(201).json({ ok: true });
});

router.post("/suggestions/:id/accept", (req, res) => {
  const id = Number(req.params.id);
  const suggestions = marketStore.suggestions();
  const idx = suggestions.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const s = suggestions[idx];
  if (s.toUserId !== req.user.id) return res.status(403).json({ error: "Nur der Empfänger kann zustimmen." });
  if (s.status !== "pending") return res.status(400).json({ error: "Anfrage nicht offen." });

  suggestions[idx].status = "accepted";
  suggestions[idx].respondedAt = new Date().toISOString();

  if (s.type === "project_to_person" || s.type === "cowork_request") {
    suggestions[idx].status = "awaiting_owner";
    const ownerRow = {
      id: nextId(() => suggestions),
      type: "dual_application",
      projectId: s.projectId,
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      coUserId: s.type === "cowork_request" ? s.fromUserId : s.toUserId,
      message: s.message,
      status: "awaiting_owner",
      parentId: s.id,
      createdAt: new Date().toISOString(),
    };
    suggestions.push(ownerRow);
  }
  marketStore.setSuggestions(suggestions);
  res.json({ ok: true, message: "Zusage gesendet — der Projekt-Ersteller wird informiert." });
});

router.post("/suggestions/:id/owner-accept", (req, res) => {
  const id = Number(req.params.id);
  const suggestions = marketStore.suggestions();
  const idx = suggestions.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const s = suggestions[idx];
  const p = marketStore.projects().find((x) => x.id === s.projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  suggestions[idx].status = "accepted";
  const users = [s.fromUserId, s.toUserId, s.coUserId].filter(Boolean);
  for (const uid of [...new Set(users)]) addParticipant(s.projectId, uid, null);
  marketStore.setSuggestions(suggestions);
  res.json({ ok: true });
});

router.post("/suggestions/:id/decline", (req, res) => {
  const id = Number(req.params.id);
  const suggestions = marketStore.suggestions();
  const idx = suggestions.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  suggestions[idx].status = "declined";
  marketStore.setSuggestions(suggestions);
  res.json({ ok: true });
});

/** Aufgaben (getrennt von Nachrichten) */
router.get("/tasks/mine", (req, res) => {
  const uid = req.user.id;
  const tasks = marketStore.tasks()
    .filter((t) => t.assigneeUserId === uid)
    .map((t) => ({
      ...t,
      fromName: userName(t.fromUserId),
      projectTitle: marketStore.projects().find((p) => p.id === t.projectId)?.title || "",
    }));
  res.json(tasks);
});

router.get("/tasks/project/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const me = req.user.id;
  const isOwner = p.ownerId === me;
  const isMember = marketStore.participants().some((x) => x.projectId === projectId && x.userId === me && x.status === "active");
  if (!isOwner && !isMember && p.assignedTo !== me) return res.status(403).json({ error: "Kein Zugriff." });
  const tasks = marketStore.tasks()
    .filter((t) => t.projectId === projectId)
    .map((t) => ({ ...t, assigneeName: userName(t.assigneeUserId) }));
  res.json(tasks);
});

router.post("/tasks", (req, res) => {
  const { projectId, assigneeUserId, title, description, outcome, dueDate } = req.body || {};
  const pid = Number(projectId);
  const aid = Number(assigneeUserId);
  const p = marketStore.projects().find((x) => x.id === pid);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const me = req.user.id;
  const isOwner = p.ownerId === me;
  const isMember = marketStore.participants().some((x) => x.projectId === pid && x.userId === me && x.status === "active");
  if (!isOwner && !isMember) return res.status(403).json({ error: "Nur Beteiligte können Aufgaben anlegen." });
  if (!isOwner && p.taskMode === "owner") {
    return res.status(403).json({ error: "Bei diesem Projekt verteilt nur der Auftraggeber Aufgaben." });
  }
  if (!title?.trim()) return res.status(400).json({ error: "Titel ist Pflicht." });
  let isAssigneeMember = marketStore.participants().some((x) => x.projectId === pid && x.userId === aid && x.status === "active");
  // Auftraggeber darf Team-Mitglieder direkt einbinden + Aufgabe zuweisen.
  if (!isAssigneeMember && p.assignedTo !== aid) {
    if (!isOwner) return res.status(400).json({ error: "Person ist nicht am Projekt beteiligt." });
    addParticipant(pid, aid, null);
    isAssigneeMember = true;
  }
  const tasks = marketStore.tasks();
  const task = {
    id: nextId(() => tasks),
    projectId: pid,
    fromUserId: me,
    assigneeUserId: aid,
    title: String(title).trim().slice(0, 120),
    outcome: outcome ? String(outcome).slice(0, 500) : (description ? String(description).slice(0, 500) : ""),
    description: description ? String(description).slice(0, 2000) : "",
    dueDate: dueDate || null,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  marketStore.setTasks(tasks);
  res.status(201).json(task);
});

router.post("/tasks/:id/reassign", (req, res) => {
  const id = Number(req.params.id);
  const aid = Number(req.body?.assigneeUserId);
  const tasks = marketStore.tasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const task = tasks[idx];
  const p = marketStore.projects().find((x) => x.id === task.projectId);
  const me = req.user.id;
  const isOwner = p?.ownerId === me;
  const isMember = marketStore.participants().some((x) => x.projectId === task.projectId && x.userId === me && x.status === "active");
  if (!isOwner && !isMember) return res.status(403).json({ error: "Kein Zugriff." });
  if (!isOwner && p?.taskMode === "owner" && task.assigneeUserId !== me) {
    return res.status(403).json({ error: "Bei diesem Projekt verteilt nur der Auftraggeber Aufgaben um." });
  }
  if (!aid) return res.status(400).json({ error: "assigneeUserId fehlt." });
  tasks[idx].assigneeUserId = aid;
  marketStore.setTasks(tasks);
  res.json(tasks[idx]);
});

router.post("/tasks/:id/done", (req, res) => {
  const id = Number(req.params.id);
  const tasks = marketStore.tasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (tasks[idx].assigneeUserId !== req.user.id && tasks[idx].fromUserId !== req.user.id) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  tasks[idx].status = "done";
  tasks[idx].completedAt = new Date().toISOString();
  marketStore.setTasks(tasks);
  res.json(tasks[idx]);
});

export default router;

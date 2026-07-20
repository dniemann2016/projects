import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore, teamPublic } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { createDefaultMilestones, syncProjectAfterParticipant } from "../lib/marketHelpers.js";
import { holdEscrowForProject } from "../lib/marketEscrow.js";

const router = Router();

function membersForTeam(teamId) {
  return marketStore.teamMembers()
    .filter((m) => m.teamId === teamId && m.status === "active")
    .map((m) => {
      const u = store.collection("users").find((x) => x.id === m.userId);
      const prof = marketStore.profiles().find((p) => p.userId === m.userId);
      return {
        userId: m.userId,
        name: u?.name || "Nutzer",
        role: m.role,
        headline: prof?.headline || "",
        workMode: prof?.workMode || "both",
      };
    });
}

router.get("/", (_req, res) => {
  const teams = marketStore.teams().filter((t) => t.public !== false);
  res.json(teams.map((t) => teamPublic(t, membersForTeam(t.id).length)));
});

router.get("/mine", requireUser, requireAcceptedTerms, (req, res) => {
  const memberOf = marketStore.teamMembers()
    .filter((m) => m.userId === req.user.id && m.status === "active")
    .map((m) => m.teamId);
  const teams = marketStore.teams().filter((t) => t.ownerId === req.user.id || memberOf.includes(t.id));
  res.json(teams.map((t) => ({
    ...teamPublic(t, membersForTeam(t.id).length),
    members: membersForTeam(t.id),
    isOwner: t.ownerId === req.user.id,
  })));
});

/** Team-Anfragen (Einladungen / Beitrittswünsche) — PDF Team-System */
router.get("/requests/mine", requireUser, requireAcceptedTerms, (req, res) => {
  const uid = req.user.id;
  const all = marketStore.teamRequests();
  const map = (r) => {
    const t = marketStore.teams().find((x) => x.id === r.teamId);
    const from = store.collection("users").find((u) => u.id === r.fromUserId);
    const proj = r.projectId ? marketStore.projects().find((p) => p.id === r.projectId) : null;
    return {
      ...r,
      teamName: t?.name || "",
      fromName: from?.name || "Nutzer",
      projectTitle: proj?.title || null,
      projectBudgetCents: proj?.budgetCents || null,
      members: r.teamId ? membersForTeam(r.teamId) : [],
    };
  };
  res.json({
    received: all.filter((r) => r.toUserId === uid && r.status === "pending").map(map),
    sent: all.filter((r) => r.fromUserId === uid).map(map),
  });
});

router.post("/requests/:id/accept", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.teamRequests();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: "Anfrage nicht gefunden." });
  const row = rows[idx];
  const t = marketStore.teams().find((x) => x.id === row.teamId);
  if (row.type === "join_request") {
    if (!t || t.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Team-Owner kann Beitrittsanfragen annehmen." });
  } else if (row.toUserId !== req.user.id) {
    return res.status(403).json({ error: "Nur der Eingeladene kann annehmen." });
  }
  if (row.status !== "pending") return res.status(400).json({ error: "Anfrage bereits beantwortet." });
  rows[idx].status = "accepted";
  rows[idx].respondedAt = new Date().toISOString();
  marketStore.setTeamRequests(rows);

  // Team für Projekt anfragen: Person dem Projekt zuweisen (nicht nur Team-Mitglied)
  if (row.type === "project_team" && row.projectId) {
    const projects = marketStore.projects();
    const pidx = projects.findIndex((p) => p.id === row.projectId);
    if (pidx === -1) return res.status(404).json({ error: "Projekt nicht gefunden." });
    const parts = marketStore.participants();
    const uid = req.user.id;
    if (!parts.some((x) => x.projectId === row.projectId && x.userId === uid && x.status === "active")) {
      parts.push({
        id: parts.length ? Math.max(...parts.map((p) => p.id)) + 1 : 1,
        projectId: row.projectId,
        userId: uid,
        teamId: row.teamId,
        status: "active",
        joinedAt: new Date().toISOString(),
      });
      marketStore.setParticipants(parts);
    }
    syncProjectAfterParticipant(projects[pidx]);
    if (!projects[pidx].assignedTo) projects[pidx].assignedTo = uid;
    projects[pidx].assignedTeamId = row.teamId;
    projects[pidx].assignedAt = projects[pidx].assignedAt || new Date().toISOString();
    if (!(projects[pidx].escrowHeldCents > 0) && projects[pidx].budgetCents > 0) {
      holdEscrowForProject(projects[pidx], projects[pidx].budgetCents);
    }
    if (!marketStore.milestones().some((m) => m.projectId === row.projectId)) {
      const ms = createDefaultMilestones(row.projectId, projects[pidx].budgetCents);
      marketStore.setMilestones([...marketStore.milestones(), ...ms]);
    }
    marketStore.setProjects(projects);
    return res.json({ ok: true, teamId: row.teamId, projectId: row.projectId, staffed: true });
  }

  const newMemberId = row.type === "join_request" ? row.fromUserId : req.user.id;
  const members = marketStore.teamMembers();
  if (!members.some((m) => m.teamId === row.teamId && m.userId === newMemberId && m.status === "active")) {
    members.push({
      id: marketStore.nextTeamMemberId(),
      teamId: row.teamId,
      userId: newMemberId,
      role: row.roleLabel || "member",
      roleLabel: row.roleLabel || null,
      shareBps: row.shareBps || null,
      status: "active",
      accepted: true,
      joinedAt: new Date().toISOString(),
    });
    marketStore.setTeamMembers(members);
  }
  res.json({ ok: true, teamId: row.teamId });
});

router.post("/requests/:id/decline", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.teamRequests();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const row = rows[idx];
  const canDecline = row.toUserId === req.user.id
    || (row.type === "join_request" && marketStore.teams().find((t) => t.id === row.teamId)?.ownerId === req.user.id);
  if (!canDecline) return res.status(403).json({ error: "Kein Zugriff." });
  rows[idx].status = "declined";
  rows[idx].respondedAt = new Date().toISOString();
  marketStore.setTeamRequests(rows);
  res.json({ ok: true });
});

/** Festes Team für ein Projekt anfragen (Weg 1c) */
router.post("/:id/request-project", requireUser, requireAcceptedTerms, (req, res) => {
  const teamId = Number(req.params.id);
  const projectId = Number(req.body?.projectId);
  const t = marketStore.teams().find((x) => x.id === teamId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!t || !p) return res.status(404).json({ error: "Team oder Projekt nicht gefunden." });
  if (p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber kann Teams anfragen." });
  const memberIds = marketStore.teamMembers()
    .filter((m) => m.teamId === teamId && m.status === "active")
    .map((m) => m.userId);
  const rows = marketStore.teamRequests();
  const created = [];
  for (const uid of memberIds) {
    if (rows.some((r) => r.teamId === teamId && r.projectId === projectId && r.toUserId === uid && r.status === "pending")) continue;
    const row = {
      id: marketStore.nextTeamRequestId(),
      teamId,
      projectId,
      fromUserId: req.user.id,
      toUserId: uid,
      type: "project_team",
      message: req.body?.message || `Anfrage für „${p.title}"`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    rows.push(row);
    created.push(row);
  }
  marketStore.setTeamRequests(rows);
  res.status(201).json({ ok: true, requests: created.length });
});

/** Auftraggeber baut aus den Projekt-Beteiligten ein festes Team — alle erhalten eine Anfrage. */
router.post("/from-project", requireUser, requireAcceptedTerms, (req, res) => {
  const projectId = Number(req.body?.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });
  const participantIds = marketStore.participants()
    .filter((x) => x.projectId === projectId && x.status === "active")
    .map((x) => x.userId)
    .filter((uid) => uid !== req.user.id);
  if (participantIds.length < 2) {
    return res.status(400).json({ error: "Mindestens 2 Beteiligte nötig, um ein Team zu bauen." });
  }
  const name = String(req.body?.name || "").trim() || `Team ${p.title}`.slice(0, 60);
  const teams = marketStore.teams();
  const team = {
    id: marketStore.nextTeamId(),
    name: name.slice(0, 60),
    tagline: `Zusammen gefunden über „${p.title}"`.slice(0, 120),
    description: null,
    ownerId: req.user.id,
    categories: p.category ? [p.category] : [],
    public: true,
    preset: false,
    kind: "permanent",
    openToJoin: false,
    fromProjectId: projectId,
    createdAt: new Date().toISOString(),
  };
  teams.push(team);
  marketStore.setTeams(teams);
  const members = marketStore.teamMembers();
  members.push({
    id: marketStore.nextTeamMemberId(),
    teamId: team.id,
    userId: req.user.id,
    role: "owner",
    status: "active",
    joinedAt: new Date().toISOString(),
  });
  marketStore.setTeamMembers(members);
  // Alle Beteiligten bekommen eine Einladung — jede Person entscheidet selbst.
  const rows = marketStore.teamRequests();
  for (const uid of participantIds) {
    rows.push({
      id: marketStore.nextTeamRequestId(),
      teamId: team.id,
      fromUserId: req.user.id,
      toUserId: uid,
      type: "invite",
      message: `Wollen wir als festes Team weitermachen? (aus „${p.title}")`,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  }
  marketStore.setTeamRequests(rows);
  res.status(201).json({ ok: true, teamId: team.id, invited: participantIds.length });
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const t = marketStore.teams().find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Team nicht gefunden." });
  res.json({
    ...teamPublic(t, membersForTeam(id).length),
    description: t.description,
    members: membersForTeam(id),
    categories: t.categories || [],
  });
});

router.post("/", requireUser, requireAcceptedTerms, (req, res) => {
  const { name, tagline, description, categories } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Teamname ist Pflicht." });
  const teams = marketStore.teams();
  const team = {
    id: marketStore.nextTeamId(),
    name: String(name).trim().slice(0, 60),
    tagline: tagline ? String(tagline).slice(0, 120) : null,
    description: description ? String(description).slice(0, 2000) : null,
    ownerId: req.user.id,
    categories: Array.isArray(categories) ? categories.slice(0, 5) : [],
    public: true,
    preset: false,
    kind: "permanent",
    splitMode: ["equal", "shares", "private"].includes(req.body?.splitMode) ? req.body.splitMode : "equal",
    openToJoin: req.body?.openToJoin === false ? false : true,
    createdAt: new Date().toISOString(),
  };
  teams.push(team);
  marketStore.setTeams(teams);
  const members = marketStore.teamMembers();
  members.push({
    id: marketStore.nextTeamMemberId(),
    teamId: team.id,
    userId: req.user.id,
    role: "owner",
    status: "active",
    joinedAt: new Date().toISOString(),
  });
  marketStore.setTeamMembers(members);
  res.status(201).json(teamPublic(team, 1));
});

router.post("/:id/join", requireUser, requireAcceptedTerms, (req, res) => {
  const teamId = Number(req.params.id);
  const t = marketStore.teams().find((x) => x.id === teamId);
  if (!t) return res.status(404).json({ error: "Team nicht gefunden." });
  const members = marketStore.teamMembers();
  if (members.some((m) => m.teamId === teamId && m.userId === req.user.id && m.status === "active")) {
    return res.status(400).json({ error: "Du bist bereits im Team." });
  }
  if (!t.openToJoin) {
    const rows = marketStore.teamRequests();
    if (rows.some((r) => r.teamId === teamId && r.type === "join_request" && r.fromUserId === req.user.id && r.status === "pending")) {
      return res.status(400).json({ error: "Beitrittsanfrage bereits gesendet." });
    }
    const row = {
      id: marketStore.nextTeamRequestId(),
      teamId,
      fromUserId: req.user.id,
      toUserId: t.ownerId,
      type: "join_request",
      message: req.body?.message || null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    rows.push(row);
    marketStore.setTeamRequests(rows);
    return res.status(201).json({ ok: true, pending: true, requestId: row.id });
  }
  members.push({
    id: marketStore.nextTeamMemberId(),
    teamId,
    userId: req.user.id,
    role: "member",
    status: "active",
    joinedAt: new Date().toISOString(),
  });
  marketStore.setTeamMembers(members);
  res.json({ ok: true });
});

router.post("/:id/leave", requireUser, requireAcceptedTerms, (req, res) => {
  const teamId = Number(req.params.id);
  const t = marketStore.teams().find((x) => x.id === teamId);
  if (!t) return res.status(404).json({ error: "Nicht gefunden." });
  if (t.ownerId === req.user.id) return res.status(400).json({ error: "Owner kann Team nicht verlassen — Team löschen oder Owner übertragen." });
  const members = marketStore.teamMembers();
  const idx = members.findIndex((m) => m.teamId === teamId && m.userId === req.user.id);
  if (idx === -1) return res.status(400).json({ error: "Kein Mitglied." });
  members[idx].status = "left";
  marketStore.setTeamMembers(members);
  res.json({ ok: true });
});

/** Team-Owner: Fachleute suchen, die noch nicht im Team sind. */
router.get("/:id/members/search", requireUser, requireAcceptedTerms, (req, res) => {
  const teamId = Number(req.params.id);
  const t = marketStore.teams().find((x) => x.id === teamId);
  if (!t) return res.status(404).json({ error: "Team nicht gefunden." });
  if (t.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Team-Owner kann Mitglieder suchen." });

  const q = (req.query.q || "").trim().toLowerCase();
  const memberIds = new Set(
    marketStore.teamMembers()
      .filter((m) => m.teamId === teamId && m.status === "active")
      .map((m) => m.userId)
  );
  const users = store.collection("users");
  let profiles = marketStore.profiles().filter((p) => p.public !== false && !memberIds.has(p.userId));
  if (q) {
    profiles = profiles.filter((p) => {
      const u = users.find((x) => x.id === p.userId);
      const hay = [u?.name, p.headline, p.bio, ...(p.skills || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  res.json(profiles.slice(0, 24).map((p) => {
    const u = users.find((x) => x.id === p.userId);
    return {
      userId: p.userId,
      name: u?.name || "Nutzer",
      headline: p.headline || "",
      skills: (p.skills || []).slice(0, 6),
      workMode: p.workMode || "both",
      rating: p.rating ?? null,
      location: p.location || null,
    };
  }));
});

/** Team-Owner: Mitglied hinzufügen. */
router.post("/:id/members", requireUser, requireAcceptedTerms, (req, res) => {
  const teamId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  const t = marketStore.teams().find((x) => x.id === teamId);
  if (!t) return res.status(404).json({ error: "Team nicht gefunden." });
  if (t.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Team-Owner kann Mitglieder hinzufügen." });
  if (!userId) return res.status(400).json({ error: "userId fehlt." });
  if (userId === req.user.id) return res.status(400).json({ error: "Du bist bereits Owner." });
  if (!marketStore.profiles().some((p) => p.userId === userId && p.public !== false)) {
    return res.status(404).json({ error: "Profil nicht gefunden oder nicht öffentlich." });
  }

  const members = marketStore.teamMembers();
  const active = members.find((m) => m.teamId === teamId && m.userId === userId && m.status === "active");
  if (active) return res.status(400).json({ error: "Person ist bereits im Team." });

  const direct = req.body?.direct === true;
  if (!direct) {
    const rows = marketStore.teamRequests();
    if (rows.some((r) => r.teamId === teamId && r.toUserId === userId && r.status === "pending")) {
      return res.status(400).json({ error: "Einladung bereits offen." });
    }
    const row = {
      id: marketStore.nextTeamRequestId(),
      teamId,
      fromUserId: req.user.id,
      toUserId: userId,
      type: "membership",
      roleLabel: req.body?.roleLabel || null,
      shareBps: req.body?.shareBps || null,
      message: req.body?.message || `Einladung ins Team „${t.name}"`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    rows.push(row);
    marketStore.setTeamRequests(rows);
    return res.status(201).json({ ok: true, pending: true, requestId: row.id });
  }

  const idx = members.findIndex((m) => m.teamId === teamId && m.userId === userId);
  if (idx !== -1) {
    members[idx].status = "active";
    members[idx].role = "member";
    members[idx].joinedAt = new Date().toISOString();
  } else {
    members.push({
      id: marketStore.nextTeamMemberId(),
      teamId,
      userId,
      role: "member",
      status: "active",
      joinedAt: new Date().toISOString(),
    });
  }
  marketStore.setTeamMembers(members);
  res.status(201).json({ ok: true, members: membersForTeam(teamId) });
});

/** Team-Owner: Mitglied entfernen. */
router.post("/:id/members/:userId/remove", requireUser, requireAcceptedTerms, (req, res) => {
  const teamId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const t = marketStore.teams().find((x) => x.id === teamId);
  if (!t) return res.status(404).json({ error: "Team nicht gefunden." });
  if (t.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Team-Owner." });
  if (userId === t.ownerId) return res.status(400).json({ error: "Owner kann nicht entfernt werden." });

  const members = marketStore.teamMembers();
  const idx = members.findIndex((m) => m.teamId === teamId && m.userId === userId && m.status === "active");
  if (idx === -1) return res.status(404).json({ error: "Mitglied nicht gefunden." });
  members[idx].status = "left";
  marketStore.setTeamMembers(members);
  res.json({ ok: true, members: membersForTeam(teamId) });
});

export default router;

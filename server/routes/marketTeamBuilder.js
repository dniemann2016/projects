import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { computePassScore } from "../lib/marketHelpers.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

const DEFAULT_ROLES = ["Führung", "Finanzen", "Vertrieb", "Recht"];

function getBuild(projectId) {
  let builds = marketStore.teamBuilds();
  let b = builds.find((x) => x.projectId === projectId);
  if (!b) {
    b = {
      id: builds.length ? Math.max(...builds.map((x) => x.id)) + 1 : 1,
      projectId,
      ownerId: null,
      roles: DEFAULT_ROLES.map((name) => ({ name, userId: null, status: "open" })),
      createdAt: new Date().toISOString(),
    };
    builds.push(b);
    marketStore.setTeamBuilds(builds);
  }
  return b;
}

router.get("/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (p.ownerId !== req.user.id) return res.status(403).json({ error: "Nur der Auftraggeber." });

  const build = getBuild(projectId);
  const filled = build.roles.filter((r) => r.userId).map((r) => r.userId);
  const teamPass = filled.length
    ? Math.round(filled.reduce((s, uid) => {
        const prof = marketStore.profiles().find((pr) => pr.userId === uid);
        if (!prof) return s;
        return s + computePassScore(p, prof, { teamMemberIds: filled.filter((id) => id !== uid) }).score;
      }, 0) / filled.length)
    : 0;

  const profiles = marketStore.profiles()
    .filter((pr) => pr.public !== false && pr.userId !== req.user.id)
    .map((pr) => {
      const u = store.collection("users").find((x) => x.id === pr.userId);
      const { score, reasons } = computePassScore(p, pr, { teamMemberIds: filled });
      return {
        userId: pr.userId,
        name: u?.name || "Fachmensch",
        headline: pr.headline,
        location: pr.location,
        rating: pr.rating,
        verified: pr.verified,
        workMode: pr.workMode,
        passScore: score,
        passReasons: reasons,
        hourlyRateCents: pr.hourlyRateCents,
      };
    })
    .sort((a, b) => b.passScore - a.passScore);

  res.json({
    projectId,
    projectTitle: p.title,
    roles: build.roles,
    teamPassScore: teamPass,
    suggestions: profiles.slice(0, 12),
  });
});

router.post("/:projectId/assign", (req, res) => {
  const projectId = Number(req.params.projectId);
  const { roleName, userId } = req.body || {};
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p || p.ownerId !== req.user.id) return res.status(403).json({ error: "Kein Zugriff." });

  const builds = marketStore.teamBuilds();
  const idx = builds.findIndex((b) => b.projectId === projectId);
  if (idx === -1) return res.status(404).json({ error: "Team-Bau nicht initialisiert." });
  const role = builds[idx].roles.find((r) => r.name === roleName);
  if (!role) return res.status(400).json({ error: "Rolle nicht gefunden." });

  role.userId = Number(userId);
  role.status = "invited";
  role.invitedAt = new Date().toISOString();
  marketStore.setTeamBuilds(builds);
  res.json(builds[idx]);
});

router.post("/:projectId/confirm", (req, res) => {
  const projectId = Number(req.params.projectId);
  const { roleName } = req.body || {};
  const builds = marketStore.teamBuilds();
  const idx = builds.findIndex((b) => b.projectId === projectId);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const role = builds[idx].roles.find((r) => r.name === roleName);
  if (!role || role.userId !== req.user.id) return res.status(403).json({ error: "Keine Einladung." });
  role.status = "confirmed";
  marketStore.setTeamBuilds(builds);
  res.json({ ok: true });
});

export default router;

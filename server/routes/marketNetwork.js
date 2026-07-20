import { Router } from "express";
import { marketStore, projectPublic, profilePublic, teamPublic } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { currentUser } from "../lib/currentUser.js";

const router = Router();

/** Netzwerkkarte: Knoten (Personen, Teams, Projekte) + Kanten. */
router.get("/", (_req, res) => {
  const users = store.collection("users");
  const profiles = marketStore.profiles().filter((p) => p.public !== false);
  const teams = marketStore.teams().filter((t) => t.public !== false);
  const projects = marketStore.projects().filter((p) => p.status === "open");
  const members = marketStore.teamMembers().filter((m) => m.status === "active");
  const connections = marketStore.connections();

  const nodes = [];
  const edges = [];
  const seen = new Set();

  function addNode(id, type, label, meta = {}) {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, type, label, ...meta });
  }

  for (const p of profiles) {
    const u = users.find((x) => x.id === p.userId);
    addNode(`user-${p.userId}`, "person", u?.name || "Fachmensch", {
      userId: p.userId,
      workMode: p.workMode,
      headline: p.headline,
      x: p.mapX,
      y: p.mapY,
    });
  }

  for (const t of teams) {
    addNode(`team-${t.id}`, "team", t.name, {
      teamId: t.id,
      tagline: t.tagline,
      preset: t.preset,
      x: t.mapX,
      y: t.mapY,
    });
  }

  for (const pr of projects.slice(0, 6)) {
    addNode(`project-${pr.id}`, "project", pr.title.slice(0, 40), {
      projectId: pr.id,
      budgetCents: pr.budgetCents,
      x: pr.mapX,
      y: pr.mapY,
    });
  }

  for (const m of members) {
    edges.push({
      id: `tm-${m.id}`,
      from: `user-${m.userId}`,
      to: `team-${m.teamId}`,
      type: "membership",
      label: m.role,
    });
  }

  for (const c of connections) {
    const from = c.fromTeamId ? `team-${c.fromTeamId}` : `user-${c.fromUserId}`;
    const to = c.toTeamId ? `team-${c.toTeamId}` : `user-${c.toUserId}`;
    if (seen.has(from) && seen.has(to)) {
      edges.push({
        id: `conn-${c.id}`,
        from,
        to,
        type: c.type,
        label: c.label || c.type,
      });
    }
  }

  for (const r of marketStore.networkRequests().filter((x) => x.status === "accepted")) {
    const from = `user-${r.fromUserId}`;
    const to = `user-${r.toUserId}`;
    if (seen.has(from) && seen.has(to)) {
      edges.push({
        id: `net-${r.id}`,
        from,
        to,
        type: "network",
        label: "Organon",
      });
    }
  }

  res.json({ nodes, edges });
});

router.get("/discover", (req, res) => {
  const user = currentUser(req);
  const users = store.collection("users");
  const projects = marketStore.projects()
    .filter((p) => p.status === "open" || (user && p.ownerId === user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(projectPublic);

  const teams = marketStore.teams()
    .filter((t) => t.public !== false)
    .slice(0, 6)
    .map((t) => {
      const count = marketStore.teamMembers().filter((m) => m.teamId === t.id && m.status === "active").length;
      return teamPublic(t, count);
    });

  const profiles = marketStore.profiles()
    .filter((p) => p.public !== false)
    .slice(0, 10)
    .map((p) => profilePublic(p, users.find((u) => u.id === p.userId)?.name));

  const offers = marketStore.offers()
    .filter((o) => o.status === "active")
    .slice(0, 8)
    .map((o) => {
      const seller = users.find((u) => u.id === o.sellerUserId);
      const prof = marketStore.profiles().find((p) => p.userId === o.sellerUserId);
      return {
        id: o.id,
        title: o.title,
        subtitle: o.subtitle,
        category: o.category,
        sellerName: seller?.name,
        rating: o.rating,
        reviewCount: o.reviewCount,
        priceFromCents: o.tiers?.[0]?.priceCents,
        verified: Boolean(prof?.verified),
      };
    });

  res.json({ projects, teams, profiles, offers });
});

export default router;

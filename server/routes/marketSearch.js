import { Router } from "express";
import { currentUser } from "../lib/currentUser.js";
import { marketStore, profilePublic } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { enrichProjectListItem, enrichTalentProfile, enrichTalentTeam } from "../lib/marketHelpers.js";

const router = Router();

/** Projekte mit Filter: category, hiringMode, staffing, payModel, q, proofs, rank, minRating */
router.get("/projects", (req, res) => {
  const user = currentUser(req);
  const {
    category, hiringMode, staffing, q, for: forType, workMode, earlyBonus, minBudget, payModel,
    minRating, rank, hasProof, skill,
  } = req.query;

  let items = marketStore.projects().filter(
    (p) => p.status === "open" || p.status === "assigned" || (user && p.ownerId === user.id)
  );

  if (category) items = items.filter((p) => p.category === category);
  if (hiringMode) items = items.filter((p) => (p.hiringMode || (p.teamRecommended ? "team" : "solo")) === hiringMode);
  if (forType === "solo") items = items.filter((p) => ["solo", "both"].includes(p.hiringMode || (p.teamRecommended ? "team" : "solo")));
  if (forType === "team") items = items.filter((p) => ["team", "both"].includes(p.hiringMode || (p.teamRecommended ? "team" : "solo")));

  if (payModel) {
    items = items.filter((p) => (p.payModel || "fixed") === payModel);
  }

  items = items.map(enrichProjectListItem);

  if (staffing) {
    items = items.filter((p) => p.staffingStatus === staffing);
  }

  if (workMode === "remote") {
    items = items.filter((p) => p.workMode === "remote" || !p.location || /remote|fern/i.test(p.location || ""));
  }

  if (earlyBonus === "1") {
    items = items.filter((p) => (p.earlyBonusCents || 0) > 0);
  }

  if (minBudget) {
    const min = Number(minBudget);
    if (min > 0) items = items.filter((p) => (p.budgetCents || 0) >= min);
  }

  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) =>
      p.title?.toLowerCase().includes(needle) ||
      p.location?.toLowerCase().includes(needle) ||
      p.staffingLabel?.toLowerCase().includes(needle)
    );
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

/** Talente: Personen + Teams — category, workMode, q, kind, minRating, rank, hasProof, skill */
router.get("/talent", (req, res) => {
  const {
    category, workMode, q, kind = "all", minRating, rank, hasProof, skill, teamReady,
  } = req.query;
  const users = store.collection("users");
  const needle = q?.trim().toLowerCase() || "";

  let people = marketStore.profiles().filter((p) => p.public !== false);
  if (category) people = people.filter((p) => p.categories?.includes(category));
  if (workMode) people = people.filter((p) => p.workMode === workMode || p.workMode === "both");
  if (teamReady === "1") people = people.filter((p) => p.workMode === "team" || p.workMode === "both");
  if (minRating) {
    const min = Number(minRating);
    if (min > 0) people = people.filter((p) => (p.rating || 0) >= min);
  }
  if (rank) {
    const ranks = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
    const need = ranks[rank] || 0;
    people = people.filter((p) => (ranks[p.rank] || 0) >= need);
  }
  if (hasProof === "1") {
    const sampleUsers = new Set(marketStore.workSamples().map((s) => s.userId));
    people = people.filter((p) => sampleUsers.has(p.userId) || (p.completedCount || 0) > 0 || p.verified);
  }
  const skillNeedle = skill?.trim().toLowerCase() || "";
  if (skillNeedle) {
    people = people.filter((p) => {
      const samples = marketStore.workSamples().filter((s) => s.userId === p.userId);
      const hay = [p.headline, ...(p.skills || []), ...samples.flatMap((s) => [s.title, ...(s.skillTags || [])])].join(" ").toLowerCase();
      return hay.includes(skillNeedle);
    });
  }
  if (needle) {
    people = people.filter((p) => {
      const u = users.find((x) => x.id === p.userId);
      const hay = [u?.name, p.headline, p.bio, ...(p.skills || [])].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }
  const personItems = people.map((p) => enrichTalentProfile(p, users.find((u) => u.id === p.userId)?.name));

  let teams = marketStore.teams().filter((t) => t.public !== false);
  if (category) teams = teams.filter((t) => t.categories?.includes(category));
  if (needle) {
    teams = teams.filter((t) =>
      [t.name, t.tagline, t.description, ...(t.categories || [])].join(" ").toLowerCase().includes(needle)
    );
  }
  const teamItems = teams.map(enrichTalentTeam);

  let results = [];
  if (kind === "person") results = personItems;
  else if (kind === "team") results = teamItems;
  else results = [...personItems, ...teamItems];

  res.json(results);
});

export default router;

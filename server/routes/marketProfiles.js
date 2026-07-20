import { Router } from "express";
import { requireUser, requireAcceptedTerms, currentUser } from "../lib/currentUser.js";
import { marketStore, profilePublic } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { enrichProjectListItem } from "../lib/marketHelpers.js";

const router = Router();

router.get("/", (req, res) => {
  const { workMode, category } = req.query;
  let items = marketStore.profiles().filter((p) => p.public !== false);
  if (workMode) items = items.filter((p) => p.workMode === workMode || p.workMode === "both");
  if (category) items = items.filter((p) => p.categories?.includes(category));
  const users = store.collection("users");
  res.json(items.map((p) => {
    const u = users.find((x) => x.id === p.userId);
    return profilePublic(p, u?.name);
  }));
});

router.get("/me", requireUser, requireAcceptedTerms, (req, res) => {
  let p = marketStore.profiles().find((x) => x.userId === req.user.id);
  if (!p) {
    p = {
      userId: req.user.id,
      headline: "",
      bio: "",
      skills: [],
      categories: [],
      location: null,
      hourlyRateCents: null,
      workMode: "both",
      availability: "open",
      public: true,
      createdAt: new Date().toISOString(),
    };
    const all = marketStore.profiles();
    all.push(p);
    marketStore.setProfiles(all);
  }
  res.json({ ...p, name: req.user.name });
});

router.patch("/me", requireUser, requireAcceptedTerms, (req, res) => {
  const all = marketStore.profiles();
  let idx = all.findIndex((x) => x.userId === req.user.id);
  const body = req.body || {};
  const workModes = ["solo", "team", "both"];
  const patch = {
    headline: body.headline != null ? String(body.headline).slice(0, 80) : undefined,
    bio: body.bio != null ? String(body.bio).slice(0, 2000) : undefined,
    skills: Array.isArray(body.skills) ? body.skills.map((s) => String(s).slice(0, 40)).slice(0, 12) : undefined,
    categories: Array.isArray(body.categories) ? body.categories.slice(0, 5) : undefined,
    location: body.location != null ? String(body.location).slice(0, 80) : undefined,
    hourlyRateCents: body.hourlyRateCents != null ? Math.max(0, Number(body.hourlyRateCents) || 0) : undefined,
    workMode: workModes.includes(body.workMode) ? body.workMode : undefined,
    viewMode: ["worker", "client"].includes(body.viewMode) ? body.viewMode : undefined,
    languages: Array.isArray(body.languages) ? body.languages.map((s) => String(s).slice(0, 20)).slice(0, 6) : undefined,
    availability: ["open", "busy"].includes(body.availability) ? body.availability : undefined,
    public: body.public != null ? Boolean(body.public) : undefined,
  };
  if (idx === -1) {
    all.push({
      userId: req.user.id,
      headline: patch.headline || "",
      bio: patch.bio || "",
      skills: patch.skills || [],
      categories: patch.categories || [],
      location: patch.location || null,
      hourlyRateCents: patch.hourlyRateCents ?? null,
      workMode: patch.workMode || "both",
      viewMode: patch.viewMode || "worker",
      languages: patch.languages || [],
      availability: patch.availability || "open",
      public: patch.public !== false,
      createdAt: new Date().toISOString(),
    });
    idx = all.length - 1;
  } else {
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) all[idx][k] = v;
    }
    all[idx].updatedAt = new Date().toISOString();
  }
  marketStore.setProfiles(all);
  res.json({ ...all[idx], name: req.user.name });
});

/** Projekte eines Nutzers (eigene oder öffentliche Besetzungsübersicht). */
router.get("/:userId/projects", (req, res) => {
  const userId = Number(req.params.userId);
  const viewer = currentUser(req);
  const isSelf = viewer?.id === userId;
  let items = marketStore.projects().filter((p) => p.ownerId === userId);
  if (!isSelf) items = items.filter((p) => p.status === "open" || p.status === "assigned");
  items = items.map(enrichProjectListItem).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

router.get("/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  const p = marketStore.profiles().find((x) => x.userId === userId);
  if (!p || p.public === false) return res.status(404).json({ error: "Profil nicht gefunden." });
  const u = store.collection("users").find((x) => x.id === userId);
  const teams = marketStore.teamMembers()
    .filter((m) => m.userId === userId && m.status === "active")
    .map((m) => marketStore.teams().find((t) => t.id === m.teamId))
    .filter(Boolean)
    .map((t) => ({ id: t.id, name: t.name, tagline: t.tagline }));
  res.json({ ...profilePublic(p, u?.name), teams });
});

export default router;

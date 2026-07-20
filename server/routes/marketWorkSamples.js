import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

router.get("/me", (req, res) => {
  const items = marketStore.workSamples()
    .filter((s) => s.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

router.post("/", (req, res) => {
  const { title, description, link, skillTags } = req.body || {};
  const t = String(title || "").trim();
  if (!t || t.length > 80) return res.status(400).json({ error: "Titel: 1–80 Zeichen." });
  const all = marketStore.workSamples();
  const sample = {
    id: all.length ? Math.max(...all.map((s) => s.id)) + 1 : 1,
    userId: req.user.id,
    title: t,
    description: String(description || "").slice(0, 500),
    link: link ? String(link).slice(0, 300) : null,
    skillTags: Array.isArray(skillTags) ? skillTags.map((s) => String(s).slice(0, 40)).slice(0, 8) : [],
    createdAt: new Date().toISOString(),
  };
  all.push(sample);
  marketStore.setWorkSamples(all);
  res.status(201).json(sample);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.workSamples();
  const idx = all.findIndex((s) => s.id === id && s.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  all.splice(idx, 1);
  marketStore.setWorkSamples(all);
  res.json({ ok: true });
});

export default router;

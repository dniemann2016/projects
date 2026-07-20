import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

router.get("/", (req, res) => {
  const items = marketStore.notifications()
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 80);
  const unread = items.filter((n) => !n.read).length;
  res.json({ items, unread });
});

router.post("/read-all", (req, res) => {
  const all = marketStore.notifications();
  for (const n of all) {
    if (n.userId === req.user.id) n.read = true;
  }
  marketStore.setNotifications(all);
  res.json({ ok: true });
});

router.post("/:id/read", (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.notifications();
  const idx = all.findIndex((n) => n.id === id && n.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  all[idx].read = true;
  marketStore.setNotifications(all);
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

function canChat(userId, project) {
  return project.ownerId === userId || project.assignedTo === userId;
}

router.get("/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (!canChat(req.user.id, p)) return res.status(403).json({ error: "Chat nur nach Annahme." });
  const msgs = marketStore.messages()
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(msgs);
});

router.post("/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = String(req.body?.body || "").trim();
  if (!body || body.length > 4000) {
    return res.status(400).json({ error: "Nachricht: 1–4000 Zeichen." });
  }
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  if (!canChat(req.user.id, p)) return res.status(403).json({ error: "Chat nur nach Annahme." });
  const msgs = marketStore.messages();
  const msg = {
    id: marketStore.nextMessageId(),
    projectId,
    senderId: req.user.id,
    body,
    createdAt: new Date().toISOString(),
  };
  msgs.push(msg);
  marketStore.setMessages(msgs);
  res.status(201).json(msg);
});

export default router;

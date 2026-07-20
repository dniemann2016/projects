import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { applyReviewToProfile } from "../lib/marketHelpers.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

const AXES = ["quality", "reliability", "communication", "value"];

/** Bewertungsstatus für abgeschlossenes Projekt. */
router.get("/project/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const me = req.user.id;
  const isOwner = p.ownerId === me;
  const isAssignee = p.assignedTo === me;
  if (!isOwner && !isAssignee) return res.status(403).json({ error: "Kein Zugriff." });
  if (p.status !== "completed") return res.status(400).json({ error: "Bewertung erst nach Abschluss." });

  const reviews = marketStore.reviews().filter((r) => r.projectId === projectId);
  const mine = reviews.find((r) => r.fromUserId === me);
  const otherId = isOwner ? p.assignedTo : p.ownerId;
  const theirs = reviews.find((r) => r.fromUserId === otherId);
  const other = store.collection("users").find((u) => u.id === otherId);

  res.json({
    projectId,
    otherName: other?.name || "Partner",
    myReview: mine || null,
    theirReview: theirs && mine ? theirs : null,
    canSubmit: !mine,
    pendingTheir: mine && !theirs,
    axes: AXES,
  });
});

router.post("/project/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
  const me = req.user.id;
  const isOwner = p.ownerId === me;
  const isAssignee = p.assignedTo === me;
  if (!isOwner && !isAssignee) return res.status(403).json({ error: "Kein Zugriff." });
  if (p.status !== "completed") return res.status(400).json({ error: "Bewertung erst nach Abschluss." });

  const toUserId = isOwner ? p.assignedTo : p.ownerId;
  const { quality, reliability, communication, value, comment } = req.body || {};
  const axes = { quality, reliability, communication, value };
  for (const k of AXES) {
    const v = Number(axes[k]);
    if (!v || v < 1 || v > 5) return res.status(400).json({ error: `Achse ${k}: 1–5 Sterne.` });
  }

  const reviews = marketStore.reviews();
  if (reviews.some((r) => r.projectId === projectId && r.fromUserId === me)) {
    return res.status(400).json({ error: "Bewertung bereits abgegeben — nicht änderbar." });
  }

  const review = {
    id: reviews.length ? Math.max(...reviews.map((r) => r.id)) + 1 : 1,
    projectId,
    fromUserId: me,
    toUserId,
    axes,
    comment: comment ? String(comment).slice(0, 500) : null,
    createdAt: new Date().toISOString(),
    visible: false,
  };
  reviews.push(review);

  // Verdeckte Bewertung: sichtbar wenn beide abgegeben
  const pair = reviews.filter((r) => r.projectId === projectId);
  if (pair.length >= 2) {
    for (const r of pair) r.visible = true;
    for (const r of pair) {
      if (r.toUserId === p.assignedTo) applyReviewToProfile(r.toUserId, r.axes, { asClient: false });
      if (r.toUserId === p.ownerId) applyReviewToProfile(r.toUserId, r.axes, { asClient: true });
    }
  }

  marketStore.setReviews(reviews);
  res.status(201).json({ ok: true, visible: review.visible });
});

export default router;

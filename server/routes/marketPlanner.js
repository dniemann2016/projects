import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { suggestRolesFromGoal } from "../lib/marketRolePlanner.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

router.post("/suggest", (req, res) => {
  const { goal, category, budgetCents } = req.body || {};
  if (!goal?.trim()) return res.status(400).json({ error: "Beschreibe dein Ziel in einem Satz." });
  res.json(suggestRolesFromGoal({ goal, category, budgetCents: Number(budgetCents) || null }));
});

export default router;

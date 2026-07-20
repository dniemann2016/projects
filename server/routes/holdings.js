import { Router } from "express";
import { store } from "../lib/store.js";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

router.get("/", (req, res) => {
  const items = store.collection("holdings").filter((h) => h.userId === req.user.id);
  res.json(items);
});

router.post("/", (req, res) => {
  const all = store.collection("holdings");
  const maxId = Math.max(0, ...all.map((h) => h.id));
  const body = req.body || {};
  const holding = {
    id: maxId + 1,
    userId: req.user.id,
    assetId: body.assetId || "",
    assetName: body.assetName || "Unbenannt",
    assetClass: body.assetClass || "etf",
    isin: body.isin || null,
    broker: body.broker || "",
    monthlyEUR: Number(body.monthlyEUR) || 0,
    swappedFromSubscriptionId: body.swappedFromSubscriptionId || null,
    swappedFromName: body.swappedFromName || "",
    matchType: body.matchType || "ähnlich",
    acquiredAt: body.acquiredAt || new Date().toISOString().slice(0, 10),
    note: body.note || "",
  };
  all.push(holding);
  store.setCollection("holdings", all);

  if (body.swappedFromSubscriptionId) {
    const subs = store.collection("subscriptions");
    const idx = subs.findIndex((s) => s.id === Number(body.swappedFromSubscriptionId) && s.userId === req.user.id);
    if (idx !== -1) {
      subs[idx].swappedTo = {
        assetId: holding.assetId,
        assetName: holding.assetName,
        isin: holding.isin,
        monthlyEUR: holding.monthlyEUR,
        at: holding.acquiredAt,
      };
      subs[idx].status = subs[idx].status === "switch" ? "switch" : "switch";
      store.setCollection("subscriptions", subs);
    }
  }

  res.status(201).json(holding);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const all = store.collection("holdings");
  store.setCollection("holdings", all.filter((h) => !(h.id === id && h.userId === req.user.id)));
  res.status(204).end();
});

export default router;

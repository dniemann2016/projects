import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { store } from "../lib/store.js";
import { PLANS } from "../lib/billingConfig.js";
import {
  billingPublicView,
  ensureBilling,
  saveUserBilling,
  activatePlan,
  consumePrompts,
} from "../lib/billingEngine.js";
import { createCustomer, createCheckoutSession, createPortalSession, verifyWebhook } from "../lib/stripeClient.js";
import { rateLimit } from "../lib/rateLimit.js";

const router = Router();
const PUBLIC_URL = process.env.PUBLIC_URL || "http://127.0.0.1:8787";

router.get("/plans", (_req, res) => {
  res.json(Object.values(PLANS));
});

router.get("/status", requireUser, requireAcceptedTerms, (req, res) => {
  res.json(billingPublicView(req.user));
});

router.patch("/settings", requireUser, requireAcceptedTerms, (req, res) => {
  const billing = ensureBilling(req.user);
  if (req.body.allowOverage !== undefined) billing.allowOverage = Boolean(req.body.allowOverage);
  saveUserBilling(req.user.id, billing);
  res.json(billingPublicView({ ...req.user, billing }));
});

router.post("/customer", requireUser, requireAcceptedTerms, async (req, res) => {
  try {
    const billing = ensureBilling(req.user);
    if (billing.stripeCustomerId) return res.json({ customerId: billing.stripeCustomerId });
    const email = (req.user.emails || []).find(Boolean);
    const customerId = await createCustomer(req.user.name, email);
    billing.stripeCustomerId = customerId;
    saveUserBilling(req.user.id, billing);
    res.json({ customerId });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/checkout", requireUser, requireAcceptedTerms, rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  try {
    const planId = req.body?.plan;
    const plan = PLANS[planId];
    if (!plan || plan.id === "free") return res.status(400).json({ error: "Ungültiger Plan." });
    const yearly = req.body?.interval === "year" && plan.envPriceYear;
    const priceId = process.env[yearly ? plan.envPriceYear : plan.envPrice];
    if (!priceId) return res.status(503).json({ error: `Stripe Price ID fehlt (${yearly ? plan.envPriceYear : plan.envPrice} in .env setzen).` });

    const billing = ensureBilling(req.user);
    if (!billing.stripeCustomerId) {
      const email = (req.user.emails || []).find(Boolean);
      billing.stripeCustomerId = await createCustomer(req.user.name, email);
      saveUserBilling(req.user.id, billing);
    }

    const mode = plan.recurring ? "subscription" : "payment";
    const url = await createCheckoutSession({
      customerId: billing.stripeCustomerId,
      priceId,
      mode,
      successUrl: `${PUBLIC_URL}/?checkout=success&plan=${planId}`,
      cancelUrl: `${PUBLIC_URL}/?checkout=cancel`,
      metadata: { userId: String(req.user.id), plan: planId },
    });
    res.json({ url });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/consume", requireUser, requireAcceptedTerms, rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  try {
    const action = req.body?.action;
    if (!action) return res.status(400).json({ error: "action fehlt." });
    const result = await consumePrompts(req.user, action);
    res.json({ ok: true, ...result, billing: billingPublicView({ ...req.user, billing: result.billing }) });
  } catch (err) {
    res.status(402).json({ error: err.message });
  }
});

/** Stripe Customer Portal öffnen — Abo verwalten/kündigen, Rechnungen (Screen 6). */
router.post("/portal", requireUser, requireAcceptedTerms, rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  try {
    const billing = ensureBilling(req.user);
    if (!billing.stripeCustomerId) return res.status(400).json({ error: "Kein Stripe-Konto verknüpft — zuerst einen Plan buchen." });
    const url = await createPortalSession(billing.stripeCustomerId, `${PUBLIC_URL}/?portal=return`);
    res.json({ url });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/** Stripe Webhook — Plan nur nach signierter, verifizierter Zahlung aktivieren. */
export function billingWebhookHandler(req, res) {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    const event = verifyWebhook(rawBody, req.headers["stripe-signature"]);
    if (!event) return res.status(400).json({ error: "Ungültige Webhook-Signatur." });
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = Number(session.metadata?.userId);
      const planId = session.metadata?.plan;
      if (userId && planId && PLANS[planId]) {
        const plan = PLANS[planId];
        let oneTimeExpires = null;
        if (plan.oneTime) {
          const exp = new Date();
          exp.setDate(exp.getDate() + (plan.validDays || 30));
          oneTimeExpires = exp.toISOString().slice(0, 10);
        }
        activatePlan(userId, planId, {
          subscriptionId: session.subscription || null,
          oneTimeExpires,
        });
        const users = store.collection("users");
        const idx = users.findIndex((u) => u.id === userId);
        if (idx !== -1) {
          users[idx].billing.stripeCustomerId = session.customer;
          store.setCollection("users", users);
        }
      }
    }
    if (event.type === "invoice.paid" && event.data.object?.subscription) {
      const subId = event.data.object.subscription;
      const users = store.collection("users");
      const user = users.find((u) => u.billing?.stripeSubscriptionId === subId);
      if (user?.billing?.plan && PLANS[user.billing.plan]) {
        activatePlan(user.id, user.billing.plan, { subscriptionId: subId });
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).json({ error: err.message });
  }
}

export default router;

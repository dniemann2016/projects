import { store } from "./store.js";
import { PLANS, actionCostEUR, defaultBilling } from "./billingConfig.js";
import { chargeOverageImmediately } from "./stripeClient.js";

export function ensureBilling(user) {
  if (!user.billing) user.billing = defaultBilling();
  return user.billing;
}

export function saveUserBilling(userId, billing) {
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  users[idx].billing = billing;
  store.setCollection("users", users);
}

export function resetWalletIfNeeded(billing) {
  const plan = PLANS[billing.plan] || PLANS.free;
  if (plan.oneTime && billing.oneTimeExpires) {
    if (new Date(billing.oneTimeExpires) < new Date()) {
      billing.plan = "free";
      billing.walletBalanceEUR = 0;
      billing.walletGrantedEUR = 0;
    }
    return billing;
  }
  if (plan.recurring) {
    const start = new Date(billing.walletPeriodStart || Date.now());
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    if (new Date() >= next) {
      billing.walletPeriodStart = new Date().toISOString().slice(0, 10);
      billing.walletBalanceEUR = plan.walletEUR;
      billing.walletGrantedEUR = plan.walletEUR;
    }
  }
  return billing;
}

export function activatePlan(userId, planId, { subscriptionId = null, oneTimeExpires = null } = {}) {
  const plan = PLANS[planId];
  if (!plan) throw new Error("Unbekannter Plan.");
  const users = store.collection("users");
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error("Nutzer nicht gefunden.");
  const billing = ensureBilling(users[idx]);
  billing.plan = planId;
  billing.walletBalanceEUR = plan.walletEUR;
  billing.walletGrantedEUR = plan.walletEUR;
  billing.walletPeriodStart = new Date().toISOString().slice(0, 10);
  billing.stripeSubscriptionId = subscriptionId;
  billing.oneTimeExpires = oneTimeExpires;
  users[idx].billing = billing;
  store.setCollection("users", users);
  return billing;
}

/** Verbraucht Prompt-Wallet. Overage wird VOR der KI-Aktion über Stripe abgebucht. */
export async function consumePrompts(user, action) {
  const costEUR = actionCostEUR(action);
  const meta = { action, costEUR, at: new Date().toISOString() };
  let billing = resetWalletIfNeeded(ensureBilling(user));
  const plan = PLANS[billing.plan] || PLANS.free;

  if (plan.id === "free" || costEUR <= 0) {
    throw new Error("KI braucht Plus, Pro oder Einmal-Check — bitte Abo abschließen.");
  }
  if (!billing.stripeCustomerId) {
    throw new Error("Stripe-Konto verknüpfen (Einstellungen → Abo & Zahlung).");
  }

  if (billing.walletBalanceEUR >= costEUR) {
    billing.walletBalanceEUR = Math.round((billing.walletBalanceEUR - costEUR) * 100) / 100;
    billing.promptLog.push({ ...meta, source: "wallet", overageEUR: 0 });
    saveUserBilling(user.id, billing);
    return { billing, charged: 0 };
  }

  if (!billing.allowOverage) {
    throw new Error(`Prompt-Wallet leer (${billing.walletBalanceEUR.toFixed(2)} € übrig, ${costEUR.toFixed(2)} € nötig). Overage aktivieren oder Plan upgraden.`);
  }

  const fromWallet = billing.walletBalanceEUR;
  const overageEUR = Math.round((costEUR - fromWallet) * 100) / 100;
  const invoiceId = await chargeOverageImmediately(
    billing.stripeCustomerId,
    overageEUR,
    `AboWandler KI-Overage: ${action} (${overageEUR.toFixed(2)} €)`
  );
  billing.walletBalanceEUR = 0;
  billing.promptLog.push({ ...meta, source: "overage", overageEUR, invoiceId });
  saveUserBilling(user.id, billing);
  return { billing, charged: overageEUR };
}

export function billingPublicView(user) {
  const billing = resetWalletIfNeeded(ensureBilling(user));
  const plan = PLANS[billing.plan] || PLANS.free;
  return {
    plan: plan.id,
    planLabel: plan.label,
    priceEUR: plan.priceEUR,
    walletBalanceEUR: billing.walletBalanceEUR,
    walletGrantedEUR: billing.walletGrantedEUR,
    allowOverage: billing.allowOverage,
    hasStripe: Boolean(billing.stripeCustomerId),
    oneTimeExpires: billing.oneTimeExpires,
    promptLog: (billing.promptLog || []).slice(-50).reverse(),
  };
}

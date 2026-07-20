import crypto from "node:crypto";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";

async function stripeRequest(method, path, form = {}) {
  if (!STRIPE_KEY) throw new Error("Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).");
  const opts = {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  };
  if (method === "POST") {
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = Object.entries(form)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe-Fehler (${res.status})`);
  return json;
}

export async function createCustomer(name, email) {
  const form = { name, description: `AboWandler ${name}` };
  if (email) form.email = email;
  const c = await stripeRequest("POST", "customers", form);
  return c.id;
}

export async function createCheckoutSession({ customerId, priceId, mode, successUrl, cancelUrl, metadata = {} }) {
  const form = {
    mode,
    customer: customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_collection: "always",
  };
  Object.entries(metadata).forEach(([k, v]) => {
    if (mode === "subscription") form[`subscription_data[metadata][${k}]`] = v;
    else form[`metadata[${k}]`] = v;
  });
  const session = await stripeRequest("POST", "checkout/sessions", form);
  return session.url;
}

/** Stripe Customer Portal (Produktplan Screen 6): Abo verwalten, Rechnung, Kündigung. */
export async function createPortalSession(customerId, returnUrl) {
  const session = await stripeRequest("POST", "billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function chargeOverageImmediately(customerId, amountEuro, description) {
  const cents = Math.max(50, Math.round(amountEuro * 100));
  await stripeRequest("POST", "invoiceitems", {
    customer: customerId,
    amount: String(cents),
    currency: "eur",
    description,
  });
  const invoice = await stripeRequest("POST", "invoices", {
    customer: customerId,
    auto_advance: "true",
    collection_method: "charge_automatically",
    pending_invoice_items_behavior: "include",
  });
  const paid = await stripeRequest("POST", `invoices/${invoice.id}/pay`, {});
  if (paid.status !== "paid") throw new Error(`Zahlung nicht bestätigt (${paid.status}). KI wurde nicht gestartet.`);
  return invoice.id;
}

/**
 * Stripe-Webhook-Signatur prüfen (HMAC-SHA256, v1-Schema).
 * Ohne gültige Signatur wird das Event verworfen — verhindert gefälschte
 * "Zahlung erfolgreich"-Events von Angreifern.
 */
export function verifyWebhook(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) {
    // Ohne Secret keine Verifikation möglich — nur in lokaler Entwicklung tolerieren.
    if (process.env.NODE_ENV === "production") return null;
    try { return JSON.parse(rawBody); } catch { return null; }
  }
  if (!signatureHeader) return null;
  try {
    const parts = Object.fromEntries(
      String(signatureHeader).split(",").map((p) => {
        const i = p.indexOf("=");
        return [p.slice(0, i), p.slice(i + 1)];
      })
    );
    if (!parts.t || !parts.v1) return null;
    // Replay-Schutz: Events älter als 5 Minuten ablehnen.
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return null;
    const payload = `${parts.t}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(parts.v1, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

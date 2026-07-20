import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { store } from "../lib/store.js";
import { requireUser, requireAdmin, requireAcceptedTerms } from "../lib/currentUser.js";
import { BUNDLED_DATA_DIR } from "../lib/paths.js";
import { hasApiKey } from "../lib/config.js";
import { brokerOffers } from "../lib/anthropic.js";
import { consumePrompts } from "../lib/billingEngine.js";
import { rateLimit } from "../lib/rateLimit.js";

const catalog = JSON.parse(fs.readFileSync(path.join(BUNDLED_DATA_DIR, "brokers.json"), "utf8"));

const router = Router();

function affiliateLinks() {
  const rows = store.collection("affiliateLinks");
  return Object.fromEntries(rows.map((r) => [r.brokerId, r.url]));
}

/** Broker-Liste inkl. Affiliate-Links (wenn vom Admin hinterlegt, sonst Default). */
router.get("/", requireUser, requireAcceptedTerms, (_req, res) => {
  const links = affiliateLinks();
  res.json(
    catalog.map((b) => ({
      ...b,
      url: links[b.id] || b.defaultUrl,
      isAffiliate: Boolean(links[b.id]),
    }))
  );
});

/** Admin: Affiliate-Link je Broker setzen — Provisionen laufen über diese URLs. */
router.put("/affiliate/:brokerId", requireAdmin, (req, res) => {
  const brokerId = String(req.params.brokerId);
  if (!catalog.some((b) => b.id === brokerId)) return res.status(404).json({ error: "Unbekannter Broker." });
  const url = String(req.body?.url || "").trim();
  if (url && !/^https:\/\//.test(url)) return res.status(400).json({ error: "Affiliate-Link muss mit https:// beginnen." });

  const rows = store.collection("affiliateLinks").filter((r) => r.brokerId !== brokerId);
  if (url) rows.push({ brokerId, url, updatedAt: new Date().toISOString().slice(0, 10) });
  store.setCollection("affiliateLinks", rows);
  res.json({ ok: true, links: affiliateLinks() });
});

/**
 * KI recherchiert aktuelle Broker-Angebote (Neukunden-Prämien, 0-€-Aktionen)
 * und kombiniert sie mit den hinterlegten Affiliate-Links.
 * Kostet Prompts — läuft über das Wallet + Stripe-Overage des Nutzers.
 */
router.post("/offers", requireUser, requireAcceptedTerms, rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
  if (!req.user.settings?.aiEnabled) {
    return res.status(403).json({ error: "KI ist deaktiviert (Einstellungen → KI-Funktionen)." });
  }
  const links = affiliateLinks();
  const withLinks = catalog.map((b) => ({ ...b, url: links[b.id] || b.defaultUrl, isAffiliate: Boolean(links[b.id]) }));

  if (!hasApiKey()) {
    // Fallback ohne KI: statische Highlights aus dem Katalog.
    return res.json({
      engine: "basis",
      offers: withLinks.map((b) => ({
        brokerId: b.id, name: b.name, url: b.url, isAffiliate: b.isAffiliate,
        offer: b.highlight, costs: b.sparplanCosts,
      })),
      note: "Ohne KI-Key: Katalog-Daten. Mit KI werden aktuelle Prämien-Aktionen recherchiert.",
    });
  }

  try {
    await consumePrompts(req.user, "ki-broker-offers");
  } catch (err) {
    return res.status(402).json({ error: err.message });
  }

  try {
    const monthly = Number(req.body?.monthly) || 50;
    const raw = await brokerOffers({ brokers: withLinks, monthly });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const known = new Map(withLinks.map((b) => [b.id, b]));
    const offers = (parsed.offers || [])
      .filter((o) => known.has(o.brokerId))
      .map((o) => {
        const b = known.get(o.brokerId);
        return { ...o, name: b.name, url: b.url, isAffiliate: b.isAffiliate };
      });
    res.json({ engine: "ki", offers, marktlage: parsed.marktlage || "", disclaimer: "Angebote ohne Gewähr — Konditionen beim Broker prüfen. Links können Affiliate-Links sein (Werbung)." });
  } catch (err) {
    console.error("Broker-Offers KI fehlgeschlagen:", err.message);
    res.status(502).json({ error: "KI-Recherche fehlgeschlagen. Bitte erneut versuchen." });
  }
});

export default router;

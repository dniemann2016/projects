import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore } from "../lib/marketStore.js";
import { store } from "../lib/store.js";
import { areNetworked } from "../lib/marketStore.js";

const router = Router();

function offerPublic(o) {
  const users = store.collection("users");
  const seller = users.find((u) => u.id === o.sellerUserId);
  const profile = marketStore.profiles().find((p) => p.userId === o.sellerUserId);
  return {
    id: o.id,
    sellerUserId: o.sellerUserId,
    sellerName: seller?.name || "Anbieter",
    sellerRating: profile?.rating ?? o.rating,
    sellerVerified: Boolean(profile?.verified),
    title: o.title,
    subtitle: o.subtitle,
    category: o.category,
    remote: o.remote !== false,
    rating: o.rating,
    reviewCount: o.reviewCount,
    rank: o.rank,
    process: o.process,
    tiers: o.tiers || [],
    status: o.status,
  };
}

router.get("/", (_req, res) => {
  const items = marketStore.offers().filter((o) => o.status === "active");
  res.json(items.map(offerPublic));
});

router.get("/:id", (req, res) => {
  const o = marketStore.offers().find((x) => x.id === Number(req.params.id));
  if (!o || o.status !== "active") return res.status(404).json({ error: "Angebot nicht gefunden." });
  res.json(offerPublic(o));
});

router.post("/:id/book", requireUser, requireAcceptedTerms, (req, res) => {
  const o = marketStore.offers().find((x) => x.id === Number(req.params.id));
  if (!o || o.status !== "active") return res.status(404).json({ error: "Angebot nicht gefunden." });
  const tierId = req.body?.tierId;
  const tier = (o.tiers || []).find((t) => t.id === tierId) || o.tiers?.[0];
  if (!tier) return res.status(400).json({ error: "Paket nicht gefunden." });
  const sellerId = o.sellerUserId;
  if (sellerId === req.user.id) return res.status(400).json({ error: "Eigenes Angebot nicht buchbar." });

  const bookings = marketStore.bookings();
  const booking = {
    id: bookings.length ? Math.max(...bookings.map((b) => b.id)) + 1 : 1,
    fromUserId: req.user.id,
    toUserId: sellerId,
    offerId: o.id,
    tierId: tier.id,
    message: `Buchungsanfrage: ${o.title} — Paket „${tier.name}" (${tier.priceCents / 100} €)`,
    slotLabel: req.body?.slotLabel || "Nach Absprache",
    status: areNetworked(req.user.id, sellerId) ? "pending" : "pending",
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  marketStore.setBookings(bookings);
  const seller = store.collection("users").find((u) => u.id === sellerId);
  res.status(201).json({
    ok: true,
    bookingId: booking.id,
    tierPriceCents: tier.priceCents,
    tierName: tier.name,
    message: areNetworked(req.user.id, sellerId)
      ? `Anfrage an ${seller?.name || "Anbieter"} gesendet — Bestätigung ausstehend.`
      : `Anfrage gespeichert. Vernetze dich zuerst mit ${seller?.name || "dem Anbieter"} im Netzwerk.`,
    needsNetwork: !areNetworked(req.user.id, sellerId),
    canPayNow: true,
  });
});

router.post("/", requireUser, requireAcceptedTerms, (req, res) => {
  const { title, subtitle, category, remote, tiers, process } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: "Titel ist Pflicht." });
  const all = marketStore.offers();
  const offer = {
    id: all.length ? Math.max(...all.map((o) => o.id)) + 1 : 1,
    sellerUserId: req.user.id,
    title: String(title).trim().slice(0, 80),
    subtitle: String(subtitle || "").slice(0, 120),
    category: category || "sonstiges",
    remote: remote !== false,
    process: String(process || "").slice(0, 500),
    tiers: Array.isArray(tiers) ? tiers.slice(0, 4).map((t, i) => ({
      id: t.id || `tier-${i + 1}`,
      name: String(t.name || `Paket ${i + 1}`).slice(0, 40),
      priceCents: Math.max(0, Number(t.priceCents) || 0),
      days: Math.max(1, Number(t.days) || 7),
    })) : [{ id: "tier-1", name: "Standard", priceCents: 50000, days: 14 }],
    status: "active",
    createdAt: new Date().toISOString(),
  };
  all.push(offer);
  marketStore.setOffers(all);
  res.status(201).json(offerPublic(offer));
});

router.patch("/:id", requireUser, requireAcceptedTerms, (req, res) => {
  const id = Number(req.params.id);
  const all = marketStore.offers();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (all[idx].sellerUserId !== req.user.id) return res.status(403).json({ error: "Nur der Anbieter." });
  const body = req.body || {};
  if (body.title != null) all[idx].title = String(body.title).slice(0, 80);
  if (body.subtitle != null) all[idx].subtitle = String(body.subtitle).slice(0, 120);
  if (body.process != null) all[idx].process = String(body.process).slice(0, 500);
  if (Array.isArray(body.tiers)) all[idx].tiers = body.tiers.slice(0, 4);
  all[idx].updatedAt = new Date().toISOString();
  marketStore.setOffers(all);
  res.json(offerPublic(all[idx]));
});

export default router;

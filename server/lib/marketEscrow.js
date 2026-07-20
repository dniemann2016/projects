/**
 * Treuhand-Schicht — Stripe Connect wenn konfiguriert, sonst Simulation.
 * Bei STRIPE_SECRET_KEY + STRIPE_CONNECT: echte Holds/Transfers einhängen.
 */
import { feeCents, formatEUR } from "./marketConstants.js";
import { marketStore } from "./marketStore.js";
import { store } from "./store.js";
import { notifyUser } from "./marketNotifications.js";

export function escrowMode() {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID) return "stripe";
  if (process.env.STRIPE_SECRET_KEY) return "stripe_partial";
  return "simulation";
}

function logEvent(type, data) {
  const events = marketStore.escrowEvents();
  events.push({
    id: events.length ? Math.max(...events.map((e) => e.id)) + 1 : 1,
    type,
    mode: escrowMode(),
    ...data,
    at: new Date().toISOString(),
  });
  marketStore.setEscrowEvents(events);
}

/** Geld bei Annahme / Projektstart in Treuhand buchen. */
export function holdEscrowForProject(project, amountCents) {
  const cents = amountCents || project.budgetCents || 0;
  logEvent("hold", { projectId: project.id, ownerId: project.ownerId, amountCents: cents });
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx].escrowHeldCents = cents;
    projects[idx].escrowStatus = "held";
    marketStore.setProjects(projects);
  }
  return { ok: true, amountCents: cents, mode: escrowMode() };
}

/** Team-Auszahlung nach split_mode aufteilen. */
export function computeTeamPayouts(projectId, grossCents) {
  const participants = marketStore.participants().filter(
    (x) => x.projectId === projectId && x.status === "active"
  );
  if (participants.length <= 1) {
    const uid = participants[0]?.userId;
    return uid ? [{ userId: uid, grossCents, netCents: grossCents }] : [];
  }

  const teamId = participants[0]?.teamId;
  const team = teamId ? marketStore.teams().find((t) => t.id === teamId) : null;
  const p = marketStore.projects().find((x) => x.id === projectId);
  const splitMode = p?.splitMode || team?.splitMode || "equal";
  const members = marketStore.teamMembers().filter(
    (m) => m.teamId === teamId && m.status === "active"
  );

  const activeIds = participants.map((part) => part.userId);

  if (splitMode === "private") {
    const coord = team?.ownerId || p?.ownerId || activeIds[0];
    return [{ userId: coord, grossCents, netCents: grossCents, note: "private_split" }];
  }

  if (splitMode === "custom" && Array.isArray(p?.splitAllocations) && p.splitAllocations.length) {
    const rows = p.splitAllocations.filter((a) => activeIds.includes(a.userId));
    if (rows.length) {
      const total = rows.reduce((s, r) => s + (r.amountCents || 0), 0);
      if (total > 0) {
        let remainder = grossCents;
        return rows.map((r, i) => {
          const amt = i === rows.length - 1
            ? remainder
            : Math.floor((grossCents * r.amountCents) / total);
          remainder -= amt;
          return { userId: r.userId, grossCents: amt, netCents: amt, label: r.label || null };
        });
      }
    }
  }

  if ((splitMode === "custom" || splitMode === "split_80_20") && p?.splitPreset === "80_20" && activeIds.length >= 2) {
    const leadShare = Math.floor(grossCents * 0.8);
    const rest = grossCents - leadShare;
    const supportEach = Math.floor(rest / (activeIds.length - 1));
    let remainder = rest - supportEach * (activeIds.length - 1);
    return activeIds.map((uid, i) => {
      if (i === 0) return { userId: uid, grossCents: leadShare, netCents: leadShare, label: "Lead 80 %" };
      const amt = supportEach + (i === 1 ? remainder : 0);
      return { userId: uid, grossCents: amt, netCents: amt, label: `Support ${Math.round((amt / grossCents) * 100)} %` };
    });
  }

  if (splitMode === "shares") {
    const shares = activeIds.map((uid) => {
      const mem = members.find((m) => m.userId === uid);
      const part = participants.find((p) => p.userId === uid);
      return { userId: uid, bps: mem?.shareBps || part?.shareBps || 0 };
    });
    let totalBps = shares.reduce((s, x) => s + x.bps, 0);
    if (totalBps <= 0) {
      const each = Math.floor(10000 / activeIds.length);
      shares.forEach((s, i) => { s.bps = i === 0 ? 10000 - each * (activeIds.length - 1) : each; });
      totalBps = 10000;
    }
    let remainder = grossCents;
    const out = shares.map((s, i) => {
      const amt = i === shares.length - 1
        ? remainder
        : Math.floor((grossCents * s.bps) / totalBps);
      remainder -= amt;
      return { userId: s.userId, grossCents: amt, shareBps: s.bps };
    });
    return out.map((r) => ({ ...r, netCents: r.grossCents }));
  }

  const each = Math.floor(grossCents / activeIds.length);
  let remainder = grossCents - each * activeIds.length;
  return activeIds.map((uid, i) => ({
    userId: uid,
    grossCents: each + (i === 0 ? remainder : 0),
    netCents: each + (i === 0 ? remainder : 0),
    shareBps: Math.floor(10000 / activeIds.length),
  }));
}

export function getProjectEscrowSummary(projectId) {
  const p = marketStore.projects().find((x) => x.id === projectId);
  if (!p) return null;
  const milestones = marketStore.milestones().filter((m) => m.projectId === projectId);
  const held = p.escrowHeldCents ?? milestones.filter((m) => m.status !== "released").reduce((s, m) => s + m.amountCents, 0);
  const released = milestones.filter((m) => m.status === "released").reduce((s, m) => s + m.amountCents, 0);
  const participants = marketStore.participants().filter((x) => x.projectId === projectId && x.status === "active");
  const users = store.collection("users");
  const preview = held > 0 ? computeTeamPayouts(projectId, held) : [];
  return {
    projectId,
    budgetCents: p.budgetCents,
    escrowHeldCents: held,
    escrowReleasedCents: released,
    escrowStatus: p.escrowStatus || (held > 0 ? "held" : "pending"),
    splitMode: p.splitMode || "equal",
    splitAllocations: p.splitAllocations || null,
    participants: participants.map((part) => ({
      userId: part.userId,
      name: users.find((u) => u.id === part.userId)?.name || `Nutzer #${part.userId}`,
      teamId: part.teamId || null,
    })),
    splitPreview: preview.map((row) => ({
      ...row,
      name: users.find((u) => u.id === row.userId)?.name || `Nutzer #${row.userId}`,
    })),
    mode: escrowMode(),
  };
}

export function setProjectSplitAllocations(projectId, ownerId, allocations, splitMode = "custom") {
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return { ok: false, error: "Projekt nicht gefunden." };
  if (projects[idx].ownerId !== ownerId) return { ok: false, error: "Nur der Auftraggeber." };
  const parts = marketStore.participants().filter((x) => x.projectId === projectId && x.status === "active");
  const activeIds = new Set(parts.map((p) => p.userId));
  const cleaned = (allocations || [])
    .filter((a) => activeIds.has(Number(a.userId)))
    .map((a) => ({
      userId: Number(a.userId),
      amountCents: Math.max(0, Number(a.amountCents) || 0),
      label: a.label ? String(a.label).slice(0, 60) : null,
    }));
  if (!cleaned.length && splitMode === "custom") return { ok: false, error: "Mindestens eine Zuweisung nötig." };
  projects[idx].splitMode = ["equal", "shares", "private", "custom"].includes(splitMode) ? splitMode : "custom";
  projects[idx].splitAllocations = splitMode === "custom" ? cleaned : null;
  projects[idx].splitUpdatedAt = new Date().toISOString();
  marketStore.setProjects(projects);
  return { ok: true, splitMode: projects[idx].splitMode, splitAllocations: projects[idx].splitAllocations };
}

export function fundProjectEscrow(projectId, ownerId, amountCents) {
  const payCheck = canPostProject(ownerId);
  if (!payCheck.ok) return { ok: false, error: "Zahlungsmittel hinterlegen — unter Konto → Zahlung." };
  const projects = marketStore.projects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return { ok: false, error: "Projekt nicht gefunden." };
  if (projects[idx].ownerId !== ownerId) return { ok: false, error: "Nur der Auftraggeber." };
  const cents = amountCents || projects[idx].budgetCents || 0;
  if (cents <= 0) return { ok: false, error: "Betrag muss größer als 0 sein." };
  holdEscrowForProject(projects[idx], cents);
  const updated = marketStore.projects().find((p) => p.id === projectId);
  return { ok: true, escrowHeldCents: updated.escrowHeldCents, amountCents: cents, mode: escrowMode() };
}

export function payOfferBooking(bookingId, payerId) {
  const payCheck = canPostProject(payerId);
  if (!payCheck.ok) return { ok: false, error: "Zahlungsmittel hinterlegen." };
  const bookings = marketStore.bookings();
  const idx = bookings.findIndex((b) => b.id === bookingId);
  if (idx === -1) return { ok: false, error: "Buchung nicht gefunden." };
  if (bookings[idx].fromUserId !== payerId) return { ok: false, error: "Nur der Auftraggeber kann zahlen." };
  const offer = marketStore.offers().find((o) => o.id === bookings[idx].offerId);
  if (!offer) return { ok: false, error: "Angebot nicht gefunden." };
  const tier = (offer.tiers || []).find((t) => t.id === bookings[idx].tierId) || offer.tiers?.[0];
  const cents = tier?.priceCents || 0;
  bookings[idx].paymentStatus = "held";
  bookings[idx].escrowHeldCents = cents;
  bookings[idx].paidAt = new Date().toISOString();
  bookings[idx].status = bookings[idx].status === "pending" ? "paid" : bookings[idx].status;
  marketStore.setBookings(bookings);
  logEvent("offer_hold", { bookingId, offerId: offer.id, payerId, payeeId: offer.sellerUserId, amountCents: cents });
  notifyUser(offer.sellerUserId, {
    type: "payment_received",
    title: "Zahlung eingegangen (Treuhand)",
    body: `${formatEUR(cents)} für „${offer.title}" — in Treuhand bis Leistung.`,
  });
  return { ok: true, escrowHeldCents: cents, bookingId, mode: escrowMode() };
}

export function releaseOfferBooking(bookingId, ownerId) {
  const bookings = marketStore.bookings();
  const idx = bookings.findIndex((b) => b.id === bookingId);
  if (idx === -1) return { ok: false, error: "Buchung nicht gefunden." };
  if (bookings[idx].fromUserId !== ownerId) return { ok: false, error: "Nur der Zahler kann freigeben." };
  if (bookings[idx].paymentStatus !== "held") return { ok: false, error: "Keine Treuhand-Zahlung vorhanden." };
  const cents = bookings[idx].escrowHeldCents || 0;
  const sellerId = bookings[idx].toUserId;
  const fee = feeCents(cents, { hasTeam: false });
  const net = cents - fee;
  recordPayout({
    bookingId,
    offerId: bookings[idx].offerId,
    userId: sellerId,
    grossCents: cents,
    feeCents: fee,
    netCents: net,
    status: escrowMode() === "simulation" ? "simulated" : "pending_transfer",
  });
  bookings[idx].paymentStatus = "released";
  bookings[idx].releasedAt = new Date().toISOString();
  bookings[idx].status = "completed";
  marketStore.setBookings(bookings);
  logEvent("offer_release", { bookingId, sellerId, grossCents: cents, netCents: net });
  notifyUser(sellerId, {
    type: "payout",
    title: "Auszahlung für Leistungsangebot",
    body: `${formatEUR(net)} freigegeben.`,
  });
  return { ok: true, netCents: net, bookingId };
}

function rankFeeDiscount(userId) {
  const prof = marketStore.profiles().find((p) => p.userId === userId);
  const rank = prof?.rank || "";
  if (rank === "platinum") return 0.5;
  if (rank === "gold") return 0.75;
  return 1;
}

/** Meilenstein freigeben — Gebühr abziehen, Team splitten, Auszahlung protokollieren. */
export function releaseMilestoneFunds(milestone, project, { finalizeEarly = false } = {}) {
  const gross = milestone.amountCents;
  const hasTeam = marketStore.participants().filter(
    (x) => x.projectId === project.id && x.status === "active"
  ).length > 1;

  const payouts = computeTeamPayouts(project.id, gross);
  const records = [];

  for (const row of payouts) {
    const discount = rankFeeDiscount(row.userId);
    const fee = Math.floor(feeCents(row.grossCents, { hasTeam }) * discount);
    const net = row.grossCents - fee;
    records.push({
      userId: row.userId,
      grossCents: row.grossCents,
      feeCents: fee,
      netCents: net,
      shareBps: row.shareBps || null,
    });
    recordPayout({
      projectId: project.id,
      milestoneId: milestone.id,
      userId: row.userId,
      grossCents: row.grossCents,
      feeCents: fee,
      netCents: net,
      status: escrowMode() === "simulation" ? "simulated" : "pending_transfer",
    });
    notifyUser(row.userId, {
      type: "payout",
      title: "Auszahlung freigegeben",
      body: `${formatEUR(net)} für „${milestone.name}"${finalizeEarly ? " (Finalize Early)" : ""}.`,
      linkProjectId: project.id,
    });
  }

  logEvent("release", {
    projectId: project.id,
    milestoneId: milestone.id,
    grossCents: gross,
    finalizeEarly,
    payouts: records,
  });

  if (finalizeEarly) {
    updateOwnerClientMetrics(project.ownerId, { finalizeEarly: true });
  }

  notifyUser(project.ownerId, {
    type: "milestone_released",
    title: finalizeEarly ? "Finalize Early — freigegeben" : "Meilenstein freigegeben",
    body: `„${milestone.name}" — ${formatEUR(gross)} aus Treuhand.`,
    linkProjectId: project.id,
  });

  return { ok: true, payouts: records, mode: escrowMode() };
}

function recordPayout(data) {
  const all = marketStore.payouts();
  all.push({
    id: all.length ? Math.max(...all.map((p) => p.id)) + 1 : 1,
    ...data,
    createdAt: new Date().toISOString(),
  });
  marketStore.setPayouts(all);
}

export function updateOwnerClientMetrics(ownerId, { finalizeEarly = false, approvalDays = null } = {}) {
  const profiles = marketStore.profiles();
  let idx = profiles.findIndex((p) => p.userId === ownerId);
  if (idx === -1) {
    profiles.push({ userId: ownerId, createdAt: new Date().toISOString() });
    idx = profiles.length - 1;
  }
  const p = profiles[idx];
  if (!p.clientMetrics) p.clientMetrics = { projectsPosted: 0, avgApprovalDays: null, fairAcceptPercent: 100, finalizeEarlyCount: 0 };
  if (finalizeEarly) p.clientMetrics.finalizeEarlyCount = (p.clientMetrics.finalizeEarlyCount || 0) + 1;
  if (approvalDays != null) {
    const prev = p.clientMetrics.avgApprovalDays;
    const n = p.clientMetrics.approvalCount || 0;
    p.clientMetrics.avgApprovalDays = prev == null ? approvalDays : Math.round(((prev * n) + approvalDays) / (n + 1) * 10) / 10;
    p.clientMetrics.approvalCount = n + 1;
  }
  marketStore.setProfiles(profiles);
}

/** 7-Tage-Regel: eingereichte Meilensteine automatisch freigeben. */
export function processAutoReleases() {
  const now = Date.now();
  const milestones = marketStore.milestones();
  let changed = 0;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (m.status !== "submitted" || !m.reviewDeadline) continue;
    if (new Date(m.reviewDeadline).getTime() > now) continue;
    const p = marketStore.projects().find((x) => x.id === m.projectId);
    if (!p) continue;
    milestones[i].status = "released";
    milestones[i].releasedAt = new Date().toISOString();
    milestones[i].autoReleased = true;
    releaseMilestoneFunds(milestones[i], p, { finalizeEarly: false });
    notifyUser(p.ownerId, {
      type: "milestone_auto",
      title: "Automatische Freigabe",
      body: `7 Tage verstrichen — „${m.name}" wurde freigegeben.`,
      linkProjectId: p.id,
    });
    changed++;
  }
  if (changed) marketStore.setMilestones(milestones);
  return changed;
}

export function canBid(userId) {
  const prof = marketStore.profiles().find((p) => p.userId === userId);
  const samples = marketStore.workSamples().filter((s) => s.userId === userId);
  const payout = marketStore.payoutAccounts().find((a) => a.userId === userId);
  const payoutOk = payout?.status === "active" || payout?.status === "simulated" || escrowMode() === "simulation";
  const sampleOk = samples.length >= 1 || prof?.verified || escrowMode() === "simulation";
  return { ok: payoutOk && sampleOk, payoutOk, sampleOk, sampleCount: samples.length };
}

export function canPostProject(userId) {
  const pay = marketStore.paymentMethods().find((a) => a.userId === userId);
  const ok = pay?.status === "active" || pay?.status === "simulated" || escrowMode() === "simulation";
  return { ok, hasPaymentMethod: Boolean(pay) };
}

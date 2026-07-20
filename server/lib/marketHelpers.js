import { store } from "./store.js";
import { marketStore, profilePublic, projectPublic } from "./marketStore.js";

export function getProjectStaffing(project) {
  const participants = marketStore.participants().filter(
    (x) => x.projectId === project.id && x.status === "active"
  );
  const filled = participants.length;
  const hiringMode = project.hiringMode || (project.teamRecommended ? "team" : "solo");
  const slots = project.teamSlots || (hiringMode === "solo" ? 1 : Math.max(4, filled + 1));
  const openSlots = Math.max(0, slots - filled);
  let status = "open";
  if (filled >= slots) status = "full";
  else if (filled > 0) status = "partial";
  const labels = {
    open: "Offen · noch unbesetzt",
    partial: `Teilbesetzt · ${filled}/${slots} · ${openSlots} frei`,
    full: `Besetzt · ${filled} Person${filled === 1 ? "" : "en"}`,
  };
  return { filled, slots, openSlots, status, label: labels[status], participantIds: participants.map((p) => p.userId) };
}

/** Projekt nimmt noch Bewerbungen / weitere Team-Mitglieder an */
export function projectAcceptsApplications(project) {
  if (!project) return false;
  if (["pending_review", "rejected", "completed"].includes(project.status)) return false;
  return getProjectStaffing(project).openSlots > 0;
}

/** Status nach neuer Teilnehmer-Zuweisung (Solo → assigned, Team → open bis voll) */
export function syncProjectAfterParticipant(project) {
  const staffing = getProjectStaffing(project);
  if (staffing.filled >= staffing.slots && staffing.slots > 0) {
    project.status = "assigned";
  } else if (staffing.filled > 0 && !["completed", "pending_review", "rejected"].includes(project.status)) {
    project.status = "open";
  }
  return project;
}

export function enrichProjectListItem(p) {
  const staffing = getProjectStaffing(p);
  const hiringMode = p.hiringMode || (p.teamRecommended ? "team" : "solo");
  return {
    ...projectPublic(p),
    payModel: p.payModel || "fixed",
    taskMode: p.taskMode || "team",
    hiringMode,
    teamSlots: staffing.slots,
    staffingStatus: staffing.status,
    staffingLabel: staffing.label,
    teamFilled: staffing.filled,
    teamOpenSlots: staffing.openSlots,
    bidCount: marketStore.bids().filter((b) => b.projectId === p.id && b.status !== "rejected").length,
  };
}

export function enrichTalentProfile(p, name) {
  const pub = marketStore.profiles().find((x) => x.userId === p.userId) || p;
  const offers = marketStore.offers().filter((o) => o.sellerUserId === p.userId && o.status === "active");
  return {
    ...profilePublic(pub, name),
    kind: "person",
    offerCount: offers.length,
    priceFromCents: pub.hourlyRateCents || offers[0]?.tiers?.[0]?.priceCents || null,
    topSkills: (pub.skills || []).slice(0, 5),
  };
}

export function enrichTalentTeam(t) {
  const members = marketStore.teamMembers().filter((m) => m.teamId === t.id && m.status === "active");
  const profiles = members.map((m) => marketStore.profiles().find((p) => p.userId === m.userId)).filter(Boolean);
  const skills = [...new Set(profiles.flatMap((p) => p.skills || []))].slice(0, 8);
  return {
    id: t.id,
    kind: "team",
    name: t.name,
    tagline: t.tagline,
    categories: t.categories || [],
    memberCount: members.length,
    teamRating: t.teamRating ?? null,
    teamDayRateCents: t.teamDayRateCents ?? null,
    preset: Boolean(t.preset),
    skills,
    openToJoin: t.openToJoin !== false,
  };
}

export function enrichBid(b) {
  const bidder = store.collection("users").find((u) => u.id === b.bidderId);
  const profile = marketStore.profiles().find((p) => p.userId === b.bidderId);
  let teamName = null;
  if (b.teamId) {
    const team = marketStore.teams().find((t) => t.id === b.teamId);
    teamName = team?.name || null;
  }
  return {
    ...b,
    bidderName: bidder?.name || "Nutzer",
    headline: profile?.headline || "",
    location: profile?.location || "",
    workMode: profile?.workMode || "both",
    rating: profile?.rating ?? null,
    completedCount: profile?.completedCount ?? 0,
    verified: Boolean(profile?.verified),
    teamName,
    proposedCents: b.priceCents,
  };
}

/** Team-Passung 0–100 (deterministisch, erklärbar). */
export function computePassScore(project, profile, { teamMemberIds = [] } = {}) {
  const reasons = [];
  let score = 50;

  const loc = (project.location || "").toLowerCase();
  const profLoc = (profile.location || "").toLowerCase();
  const remoteOk = project.workMode === "remote" || !project.workMode;
  const needsOnsite = project.workMode === "onsite" || project.workMode === "hybrid";

  if (remoteOk || profLoc.includes("remote") || profLoc.includes("fern")) {
    score += 15;
    reasons.push({ ok: true, text: "Fernfähig / passt zum Projekt" });
  } else if (needsOnsite && loc && profLoc && (profLoc.includes(loc.split(" ")[0]) || loc.includes(profLoc.split(" ")[0]))) {
    score += 20;
    reasons.push({ ok: true, text: "Im Projektumkreis" });
  } else if (needsOnsite) {
    score -= 15;
    reasons.push({ ok: false, text: "Außerhalb Umkreis / Vor-Ort nötig" });
  }

  const wm = profile.workMode || "both";
  if (project.teamRecommended && wm === "solo") {
    score -= 10;
    reasons.push({ ok: false, text: "Team empfohlen — arbeitet lieber solo" });
  } else if (wm === "team" || wm === "both") {
    score += 10;
    reasons.push({ ok: true, text: "Teambereit" });
  }

  if (profile.rating) {
    score += Math.round((profile.rating - 4) * 10);
    reasons.push({ ok: profile.rating >= 4.5, text: `★ ${profile.rating} Bewertung` });
  }

  // Gemeinsame Vergangenheit mit Teammitgliedern
  for (const otherId of teamMemberIds) {
    const conn = marketStore.connections().find(
      (c) =>
        (c.fromUserId === profile.userId && c.toUserId === otherId) ||
        (c.toUserId === profile.userId && c.fromUserId === otherId)
    );
    if (conn) {
      score += 8;
      reasons.push({ ok: true, text: `Kennt Teammitglied (${conn.label || "Vergangenheit"})` });
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function createDefaultMilestones(projectId, budgetCents) {
  const existing = marketStore.milestones();
  let nextId = existing.length ? Math.max(...existing.map((m) => m.id)) + 1 : 1;
  const splits = [0.2, 0.3, 0.3, 0.2];
  const labels = ["M1 · Konzept", "M2 · Umsetzung", "M3 · Test", "M4 · Abnahme"];
  const now = new Date().toISOString();
  return splits.map((pct, i) => ({
    id: nextId + i,
    projectId,
    name: labels[i],
    amountCents: Math.round(budgetCents * pct),
    status: i === 0 ? "held" : "held",
    submittedAt: null,
    releasedAt: null,
    reviewDeadline: null,
    createdAt: now,
  }));
}

export function getMilestonesForProject(projectId) {
  return marketStore.milestones().filter((m) => m.projectId === projectId);
}

export function applyReviewToProfile(userId, axes, { asClient = false } = {}) {
  const profiles = marketStore.profiles();
  const idx = profiles.findIndex((p) => p.userId === userId);
  if (idx === -1) return;
  const vals = Object.values(axes).filter((v) => typeof v === "number");
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const p = profiles[idx];
  if (asClient) {
    if (!p.clientMetrics) p.clientMetrics = { projectsPosted: 0, fairAcceptPercent: 100, workerRating: null };
    const prev = p.clientMetrics.workerRating || avg;
    const n = p.clientMetrics.workerReviewCount || 0;
    p.clientMetrics.workerRating = Math.round(((prev * n) + avg) / (n + 1) * 10) / 10;
    p.clientMetrics.workerReviewCount = n + 1;
  } else {
    const prev = p.rating || avg;
    const count = p.completedCount || 0;
    p.rating = Math.round(((prev * count) + avg) / (count + 1) * 10) / 10;
    p.completedCount = count + 1;
  }
  p.updatedAt = new Date().toISOString();
  marketStore.setProfiles(profiles);
}

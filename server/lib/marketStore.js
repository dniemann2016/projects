import { store } from "./store.js";

const COL = {
  projects: "em_projects",
  bids: "em_bids",
  nda: "em_nda",
  messages: "em_messages",
  milestones: "em_milestones",
  reviews: "em_reviews",
  profiles: "em_profiles",
  teams: "em_teams",
  teamMembers: "em_team_members",
  connections: "em_connections",
  offers: "em_offers",
  verifications: "em_verifications",
  networkRequests: "em_network_requests",
  delegations: "em_delegations",
  bookings: "em_bookings",
  teamBuilds: "em_team_builds",
  participants: "em_participants",
  invites: "em_invites",
  suggestions: "em_suggestions",
  tasks: "em_tasks",
  teamRequests: "em_team_requests",
  submissions: "em_submissions",
  disputes: "em_disputes",
  notifications: "em_notifications",
  workSamples: "em_work_samples",
  payoutAccounts: "em_payout_accounts",
  paymentMethods: "em_payment_methods",
  escrowEvents: "em_escrow_events",
  payouts: "em_payouts",
};

function nextId(items) {
  return Math.max(0, ...items.map((x) => x.id)) + 1;
}

export const marketStore = {
  projects() { return store.collection(COL.projects); },
  setProjects(items) { store.setCollection(COL.projects, items); },
  bids() { return store.collection(COL.bids); },
  setBids(items) { store.setCollection(COL.bids, items); },
  nda() { return store.collection(COL.nda); },
  setNda(items) { store.setCollection(COL.nda, items); },
  messages() { return store.collection(COL.messages); },
  setMessages(items) { store.setCollection(COL.messages, items); },
  milestones() { return store.collection(COL.milestones); },
  setMilestones(items) { store.setCollection(COL.milestones, items); },
  reviews() { return store.collection(COL.reviews); },
  setReviews(items) { store.setCollection(COL.reviews, items); },
  profiles() { return store.collection(COL.profiles); },
  setProfiles(items) { store.setCollection(COL.profiles, items); },
  teams() { return store.collection(COL.teams); },
  setTeams(items) { store.setCollection(COL.teams, items); },
  teamMembers() { return store.collection(COL.teamMembers); },
  setTeamMembers(items) { store.setCollection(COL.teamMembers, items); },
  connections() { return store.collection(COL.connections); },
  setConnections(items) { store.setCollection(COL.connections, items); },
  networkRequests() { return store.collection(COL.networkRequests); },
  setNetworkRequests(items) { store.setCollection(COL.networkRequests, items); },
  delegations() { return store.collection(COL.delegations); },
  setDelegations(items) { store.setCollection(COL.delegations, items); },
  bookings() { return store.collection(COL.bookings); },
  setBookings(items) { store.setCollection(COL.bookings, items); },
  offers() { return store.collection(COL.offers); },
  setOffers(items) { store.setCollection(COL.offers, items); },
  verifications() { return store.collection(COL.verifications); },
  setVerifications(items) { store.setCollection(COL.verifications, items); },
  teamBuilds() { return store.collection(COL.teamBuilds); },
  setTeamBuilds(items) { store.setCollection(COL.teamBuilds, items); },
  participants() { return store.collection(COL.participants); },
  setParticipants(items) { store.setCollection(COL.participants, items); },
  invites() { return store.collection(COL.invites); },
  setInvites(items) { store.setCollection(COL.invites, items); },
  suggestions() { return store.collection(COL.suggestions); },
  setSuggestions(items) { store.setCollection(COL.suggestions, items); },
  tasks() { return store.collection(COL.tasks); },
  setTasks(items) { store.setCollection(COL.tasks, items); },
  teamRequests() { return store.collection(COL.teamRequests); },
  setTeamRequests(items) { store.setCollection(COL.teamRequests, items); },
  submissions() { return store.collection(COL.submissions); },
  setSubmissions(items) { store.setCollection(COL.submissions, items); },
  disputes() { return store.collection(COL.disputes); },
  setDisputes(items) { store.setCollection(COL.disputes, items); },
  notifications() { return store.collection(COL.notifications); },
  setNotifications(items) { store.setCollection(COL.notifications, items); },
  workSamples() { return store.collection(COL.workSamples); },
  setWorkSamples(items) { store.setCollection(COL.workSamples, items); },
  payoutAccounts() { return store.collection(COL.payoutAccounts); },
  setPayoutAccounts(items) { store.setCollection(COL.payoutAccounts, items); },
  paymentMethods() { return store.collection(COL.paymentMethods); },
  setPaymentMethods(items) { store.setCollection(COL.paymentMethods, items); },
  escrowEvents() { return store.collection(COL.escrowEvents); },
  setEscrowEvents(items) { store.setCollection(COL.escrowEvents, items); },
  payouts() { return store.collection(COL.payouts); },
  setPayouts(items) { store.setCollection(COL.payouts, items); },
  nextProjectId() { return nextId(this.projects()); },
  nextBidId() { return nextId(this.bids()); },
  nextMessageId() { return nextId(this.messages()); },
  nextTeamId() { return nextId(this.teams()); },
  nextTeamMemberId() { return nextId(this.teamMembers()); },
  nextTeamRequestId() { return nextId(this.teamRequests()); },
  nextNetworkRequestId() { return nextId(this.networkRequests()); },
  nextDelegationId() { return nextId(this.delegations()); },
  nextBookingId() { return nextId(this.bookings()); },
};

export function projectPublic(p) {
  if (!p) return null;
  const { description, ...rest } = p;
  const out = { ...rest };
  if (p.ndaLevel > 0 && p.publicSummary) out.publicSummary = p.publicSummary;
  out.ideaProtected = p.ndaLevel >= 3;
  out.realizationOnly = p.ndaLevel > 0;
  out.heroEmoji = p.heroEmoji || defaultEmoji(p.category, p.payModel);
  out.heroAccent = p.heroAccent || defaultAccent(p.category, p.payModel);
  out.heroTheme = p.heroTheme || "light";
  out.eyebrowTag = p.eyebrowTag || null;
  return out;
}

function defaultEmoji(cat, pay) {
  if (pay === "contest") return "🏆";
  if (pay === "success") return "📈";
  if (pay === "time") return "⏱️";
  return {
    software: "💻", design: "🎨", management: "📊", recht: "⚖️",
    handwerk: "🔧", wissenschaft: "🔬", sonstiges: "✨",
  }[cat] || "✨";
}

function defaultAccent(cat) {
  return {
    software: "#0071e3", design: "#ff375f", management: "#1d1d1f",
    recht: "#5e5ce6", handwerk: "#34c759", wissenschaft: "#30b0c7", sonstiges: "#8e8e93",
  }[cat] || "#0071e3";
}

export function profilePublic(p, name) {
  const v = marketStore.verifications().find((x) => x.userId === p.userId);
  return {
    userId: p.userId,
    name: name || "Fachmensch",
    headline: p.headline,
    bio: p.bio?.slice(0, 500),
    skills: p.skills || [],
    categories: p.categories || [],
    location: p.location,
    hourlyRateCents: p.hourlyRateCents,
    workMode: p.workMode,
    availability: p.availability,
    rating: p.rating || null,
    completedCount: p.completedCount || 0,
    onTimePercent: p.onTimePercent ?? null,
    responseHours: p.responseHours ?? null,
    verified: Boolean(p.verified) || v?.status === "verified",
    verificationTier: p.verificationTier || (v?.status === "verified" ? "full" : null),
    verificationStatus: v?.status || (p.verified ? "verified" : "none"),
    rank: p.rank || null,
    badges: p.badges || [],
    viewMode: p.viewMode || "worker",
    languages: p.languages || [],
    clientMetrics: p.clientMetrics || null,
    workSampleCount: marketStore.workSamples().filter((s) => s.userId === p.userId).length,
    contestWins: marketStore.submissions().filter((s) => s.userId === p.userId && s.status === "winner").length,
  };
}

export function teamPublic(t, memberCount = 0) {
  return {
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    description: t.description?.slice(0, 400),
    ownerId: t.ownerId,
    kind: t.kind || "permanent",
    categories: t.categories || [],
    memberCount,
    preset: Boolean(t.preset),
    openToJoin: t.openToJoin !== false,
    heroEmoji: t.heroEmoji || (t.preset ? "🤝" : "👥"),
    heroAccent: t.heroAccent || "#0071e3",
    heroTheme: t.heroTheme || (t.preset ? "dark" : "light"),
    teamRating: t.teamRating ?? null,
    sharedProjects: t.sharedProjects ?? 0,
    avgDaysEarly: t.avgDaysEarly ?? null,
    teamDayRateCents: t.teamDayRateCents ?? null,
  };
}

export function hasNda(userId, projectId) {
  return marketStore.nda().some((n) => n.userId === userId && n.projectId === projectId);
}

function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function areNetworked(userId, otherId) {
  if (userId === otherId) return true;
  return marketStore.networkRequests().some(
    (r) => r.status === "accepted" && pairKey(r.fromUserId, r.toUserId) === pairKey(userId, otherId)
  );
}

/** none | pending_out | pending_in | connected | rejected */
export function connectionStatus(userId, otherId) {
  if (userId === otherId) return "self";
  const rows = marketStore.networkRequests().filter(
    (r) => pairKey(r.fromUserId, r.toUserId) === pairKey(userId, otherId)
  );
  const accepted = rows.find((r) => r.status === "accepted");
  if (accepted) return "connected";
  const pending = rows.find((r) => r.status === "pending");
  if (pending) return pending.fromUserId === userId ? "pending_out" : "pending_in";
  return "none";
}

export function seedMarketIfEmpty() {
  const now = new Date().toISOString();

  if (marketStore.projects().length === 0) {
    marketStore.setProjects([
      {
        id: 1, ownerId: 1,
        title: "Buchungssystem für Arztpraxen – MVP in 10 Wochen",
        description: "Wir brauchen ein MVP für Online-Terminbuchung in Arztpraxen: Kalender, Erinnerungen, DSGVO-konforme Einwilligungen.",
        category: "software", budgetCents: 2800000, budgetType: "fixed",
        location: "Remote", durationLabel: "10 Wochen", ndaLevel: 2,
        successFee: null, teamRecommended: false, status: "open",
        assignedTo: null, createdAt: now, mapX: 0.72, mapY: 0.35,
      },
      {
        id: 2, ownerId: 1,
        title: "Sanierung Handwerksbetrieb – Geschäftsführung auf Zeit",
        description: "Mittelständischer Handwerksbetrieb (~40 MA) sucht erfahrenen Interim-GF für 6 Monate.",
        category: "management", budgetCents: 12000000, budgetType: "fixed",
        location: "Raum Stuttgart", durationLabel: "6 Monate", ndaLevel: 1,
        successFee: "+15 % Kosteneinsparung Jahr 1", teamRecommended: true,
        status: "open", assignedTo: null, createdAt: now, mapX: 0.55, mapY: 0.62,
      },
      {
        id: 3, ownerId: 1,
        title: "Rasen mähen & Heckenschnitt – Einfamilienhaus",
        description: "Garten ~400 m², einmalige Pflege vor Verkauf.",
        category: "handwerk", budgetCents: 18000, budgetType: "fixed",
        location: "Gröbenzell", durationLabel: "1 Tag", ndaLevel: 0,
        successFee: null, teamRecommended: false, status: "open",
        assignedTo: null, createdAt: now, mapX: 0.28, mapY: 0.48,
      },
      {
        id: 4, ownerId: 1,
        title: "Corporate Design Relaunch – Tech-Startup",
        description: "Logo, Farbsystem, Typografie, Social-Templates für Series-A-Startup.",
        category: "design", budgetCents: 850000, budgetType: "fixed",
        location: "München", durationLabel: "4 Wochen", ndaLevel: 1,
        successFee: null, teamRecommended: true, status: "open",
        assignedTo: null, createdAt: now, mapX: 0.82, mapY: 0.58,
      },
    ]);
  }

  if (marketStore.profiles().length === 0) {
    const users = store.collection("users");
    const extras = [
      { id: 3, name: "Lisa K.", role: "user", createdAt: "2026-07-01", emails: [""], settings: { aiEnabled: false } },
      { id: 4, name: "Marco Design", role: "user", createdAt: "2026-07-01", emails: [""], settings: { aiEnabled: false } },
      { id: 5, name: "Dr. Weber", role: "user", createdAt: "2026-07-01", emails: [""], settings: { aiEnabled: false } },
    ];
    for (const u of extras) {
      if (!users.some((x) => x.id === u.id)) users.push(u);
    }
    store.setCollection("users", users);
    marketStore.setProfiles([
      {
        userId: 1, headline: "Interim-GF & Strategie", bio: "20 Jahre Mittelstand, Turnaround-Spezialist.",
        skills: ["Management", "Sanierung", "Vertrieb"], categories: ["management"],
        location: "Stuttgart", hourlyRateCents: 18000, workMode: "both",
        availability: "open", public: true, rating: 4.9, completedCount: 12,
        mapX: 0.42, mapY: 0.28, createdAt: now,
      },
      {
        userId: 2, headline: "Full-Stack & Health-Tech", bio: "React, Node, DSGVO-konforme Praxis-Software.",
        skills: ["React", "Node.js", "DSGVO"], categories: ["software"],
        location: "Remote", hourlyRateCents: 12000, workMode: "team",
        availability: "open", public: true, rating: 4.8, completedCount: 8,
        mapX: 0.65, mapY: 0.22, createdAt: now,
      },
      {
        userId: 3, headline: "Garten- & Landschaftspflege", bio: "Solo oder mit Partner — schnell, sauber, fair.",
        skills: ["Rasen", "Heckenschnitt", "Entsorgung"], categories: ["handwerk"],
        location: "Gröbenzell", hourlyRateCents: 4500, workMode: "solo",
        availability: "open", public: true, rating: 5.0, completedCount: 34,
        mapX: 0.22, mapY: 0.55, createdAt: now,
      },
      {
        userId: 4, headline: "Brand & UI Design", bio: "Apple-inspirierte Interfaces, Design Systems.",
        skills: ["Figma", "Branding", "Motion"], categories: ["design"],
        location: "München", hourlyRateCents: 9500, workMode: "both",
        availability: "open", public: true, rating: 4.7, completedCount: 19,
        mapX: 0.78, mapY: 0.42, createdAt: now,
      },
      {
        userId: 5, headline: "Steuerrecht & GmbH", bio: "Beratung für Gründer und Mittelstand.",
        skills: ["Steuer", "GmbH", "Verträge"], categories: ["recht"],
        location: "Frankfurt", hourlyRateCents: 25000, workMode: "solo",
        availability: "busy", public: true, rating: 4.9, completedCount: 41,
        mapX: 0.35, mapY: 0.72, createdAt: now,
      },
    ]);
  }

  if (marketStore.teams().length === 0) {
    marketStore.setTeams([
      {
        id: 1, name: "HealthCode Collective", tagline: "Software für Medizin & Praxen",
        description: "Festes Team aus Entwicklung, UX und Compliance — Projekte ab 4 Wochen.",
        ownerId: 2, categories: ["software"], public: true, preset: true, openToJoin: true,
        mapX: 0.58, mapY: 0.38, createdAt: now,
      },
      {
        id: 2, name: "Turnaround Unit", tagline: "Interim-Management im Mittelstand",
        description: "GF auf Zeit, Controlling, Einkauf — erfahrenes Kernteam.",
        ownerId: 1, categories: ["management"], public: true, preset: true, openToJoin: false,
        mapX: 0.48, mapY: 0.52, createdAt: now,
      },
      {
        id: 3, name: "Studio Nord", tagline: "Design & Motion für Tech",
        description: "Branding, Web, Animation — arbeiten nur im Team.",
        ownerId: 4, categories: ["design"], public: true, preset: true, openToJoin: true,
        mapX: 0.75, mapY: 0.48, createdAt: now,
      },
    ]);
    marketStore.setTeamMembers([
      { id: 1, teamId: 1, userId: 2, role: "owner", status: "active", joinedAt: now },
      { id: 2, teamId: 1, userId: 4, role: "member", status: "active", joinedAt: now },
      { id: 3, teamId: 2, userId: 1, role: "owner", status: "active", joinedAt: now },
      { id: 4, teamId: 2, userId: 5, role: "member", status: "active", joinedAt: now },
      { id: 5, teamId: 3, userId: 4, role: "owner", status: "active", joinedAt: now },
      { id: 6, teamId: 3, userId: 2, role: "member", status: "active", joinedAt: now },
    ]);
    marketStore.setConnections([
      { id: 1, fromUserId: 1, toUserId: 2, type: "collaborated", label: "2 Projekte", createdAt: now },
      { id: 2, fromUserId: 2, toUserId: 4, type: "collaborated", label: "Design+Dev", createdAt: now },
      { id: 3, fromTeamId: 1, toTeamId: 2, type: "partner", label: "Empfehlung", createdAt: now },
      { id: 4, fromUserId: 3, toUserId: 1, type: "referred", label: "Empfohlen", createdAt: now },
    ]);
  }

  if (marketStore.networkRequests().length === 0) {
    marketStore.setNetworkRequests([
      { id: 1, fromUserId: 1, toUserId: 2, message: "Lass uns bei Health-Projekten zusammenarbeiten.", status: "accepted", createdAt: now, respondedAt: now },
      { id: 2, fromUserId: 4, toUserId: 1, message: "Design-Support für Turnaround?", status: "pending", createdAt: now },
      { id: 3, fromUserId: 3, toUserId: 2, message: "Kann ich dich für Garten-Jobs empfehlen?", status: "pending", createdAt: now },
    ]);
    marketStore.setDelegations([
      { id: 1, fromUserId: 1, toUserId: 2, title: "API-Schnittstelle prüfen", description: "Bitte OpenAPI-Docs für Praxis-MVP durchsehen.", projectId: 1, status: "active", createdAt: now, acceptedAt: now },
    ]);
    marketStore.setBookings([
      { id: 1, fromUserId: 2, toUserId: 1, message: "2h Strategie-Call nächste Woche?", slotLabel: "Di 14:00", projectId: 2, status: "pending", createdAt: now },
    ]);
  }
}

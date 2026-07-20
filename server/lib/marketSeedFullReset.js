/**
 * Vollständiger Demo-Reset (Seed v9) — frische Nutzer, Profile, Teams, Projekte.
 * Nur für lokale Demo: demoPassword im Klartext für Admin-Einsicht.
 */
import { store } from "./store.js";
import { marketStore } from "./marketStore.js";
import { hashPassword } from "./auth.js";
import { acceptTermsForUser } from "./legal.js";
import { defaultBilling } from "./billingConfig.js";

export const DEMO_SEED_VERSION = 11;

const TERMS = acceptTermsForUser();
const now = new Date().toISOString();

function u(id, loginName, name, role, demoPassword, email = "") {
  return {
    id,
    loginName,
    name,
    role,
    createdAt: now.slice(0, 10),
    emails: [email || `${loginName}@demo.local`],
    settings: { aiEnabled: false },
    billing: defaultBilling(),
    passwordHash: demoPassword ? hashPassword(demoPassword) : null,
    demoPassword: demoPassword || null,
    twoFactorEnabled: role === "admin",
    ...TERMS,
  };
}

function profile(userId, data) {
  return { userId, public: true, workMode: "both", availability: "open", createdAt: now, ...data };
}

export function runMarketFullReset() {
  const users = [
    u(1, "davidhammon", "David Hammon", "admin", "Orion447!", "david.hammon@outlook.de"),
    u(2, "maria_dev", "Maria Schneider", "user", "Demo2026!", "maria@demo.de"),
    u(3, "jonas_w", "Jonas Weber", "user", "Demo2026!", "jonas@demo.de"),
    u(4, "lena_design", "Lena Brandt", "user", "Demo2026!", "lena@demo.de"),
    u(5, "ali_tech", "Ali Tekin", "user", "Demo2026!", "ali@demo.de"),
    u(6, "martina_k", "Martina Koch", "user", "Demo2026!", "martina@demo.de"),
    u(7, "dr_ohme", "Dr. Felix Ohme", "user", "Demo2026!", "felix@demo.de"),
    u(8, "sophie_h", "Sophie Hartmann", "user", "Demo2026!", "sophie@demo.de"),
    u(9, "tim_garten", "Tim Gärtner", "user", "Demo2026!", "tim@demo.de"),
    u(10, "nina_recht", "Nina Berger", "user", "Demo2026!", "nina@demo.de"),
    u(11, "paul_ui", "Paul Richter", "user", "Demo2026!", "paul@demo.de"),
    u(12, "julia_data", "Julia Stein", "user", "Demo2026!", "julia@demo.de"),
    u(13, "max_hand", "Max Fischer", "user", "Demo2026!", "max@demo.de"),
    u(14, "eva_team", "Eva Schulz", "user", "Demo2026!", "eva@demo.de"),
    u(15, "leon_sf", "Leon Hoffmann", "user", "Demo2026!", "leon@demo.de"),
    u(16, "anna_wiss", "Anna Krüger", "user", "Demo2026!", "anna@demo.de"),
    u(17, "ben_controll", "Ben Wagner", "user", "Demo2026!", "ben@demo.de"),
    u(18, "clara_mkt", "Clara Müller", "user", "Demo2026!", "clara@demo.de"),
    u(19, "felix_auto", "Felix Autodidakt", "user", "Demo2026!", "felix.a@demo.de"),
    u(20, "team_lead", "Sandra Teamlead", "user", "Demo2026!", "sandra@demo.de"),
  ];
  store.setCollection("users", users);
  store.setCollection("sessions", []);

  const profiles = [
    profile(1, { headline: "Auftraggeber & Plattform-Admin", rank: "platinum", bio: "Vergebe Projekte, Teams, Wettbewerbe.", skills: ["Management", "Strategie"], categories: ["management"], location: "Gröbenzell", hourlyRateCents: 20000, workMode: "both", viewMode: "client", rating: 4.9, completedCount: 15, verified: true, clientMetrics: { projectsPosted: 12, avgApprovalDays: 1.8, fairAcceptPercent: 97, finalizeEarlyCount: 8 } }),
    profile(2, { headline: "Full-Stack · Health-Tech", rank: "gold", bio: "React, Node, Praxis-Software, 8 Jahre.", skills: ["React", "Node.js", "PostgreSQL", "DSGVO"], categories: ["software"], location: "Remote · Köln", hourlyRateCents: 9500, workMode: "team", rating: 4.8, completedCount: 28, verified: true, badges: ["Teamspieler", "Schnell-Lieferer"] }),
    profile(3, { headline: "Interim-GF Turnaround", rank: "gold", bio: "Mittelstand, Sanierung, Vor-Ort.", skills: ["Führung", "Sanierung", "Einkauf"], categories: ["management"], location: "Stuttgart · 80 km", hourlyRateCents: 18000, workMode: "both", rating: 4.9, completedCount: 11, verified: true }),
    profile(4, { headline: "Brand & UI · Apple-Stil", rank: "gold", bio: "Figma, Design Systems, Motion.", skills: ["Figma", "Branding", "UI"], categories: ["design"], location: "München", hourlyRateCents: 9000, workMode: "both", rating: 4.7, completedCount: 22, verified: true }),
    profile(5, { headline: "DevOps & Cloud", rank: "silver", bio: "AWS, CI/CD, Skalierung.", skills: ["AWS", "Docker", "Kubernetes"], categories: ["software"], location: "Berlin · Remote", hourlyRateCents: 11000, workMode: "solo", rating: 4.6, completedCount: 14 }),
    profile(6, { headline: "Garten & Landschaft", rank: "silver", bio: "Solo oder Duo — schnell, sauber.", skills: ["Rasen", "Hecken", "Entsorgung"], categories: ["handwerk"], location: "Gröbenzell · 40 km", hourlyRateCents: 4200, workMode: "solo", rating: 5.0, completedCount: 41 }),
    profile(7, { headline: "Steuer & GmbH-Gründung", rank: "platinum", bio: "Gründerberatung, Verträge.", skills: ["Steuer", "GmbH", "Verträge"], categories: ["recht"], location: "Frankfurt", hourlyRateCents: 24000, workMode: "solo", rating: 4.9, completedCount: 38, verified: true }),
    profile(8, { headline: "Wissenschaft · Datenanalyse", rank: "gold", bio: "PhD Statistik, R, Python.", skills: ["Python", "Statistik", "Forschung"], categories: ["wissenschaft"], location: "Heidelberg", hourlyRateCents: 8500, workMode: "both", rating: 4.8, completedCount: 9 }),
    profile(9, { headline: "Handwerk Allrounder", rank: "bronze", bio: "Renovierung, Maler, kleine Jobs.", skills: ["Maler", "Renovierung"], categories: ["handwerk"], location: "Augsburg", hourlyRateCents: 3800, workMode: "solo", rating: 4.5, completedCount: 19 }),
    profile(10, { headline: "Arbeitsrecht interim", rank: "gold", bio: "Kündigungen, Betriebsrat, Compliance.", skills: ["Arbeitsrecht", "Compliance"], categories: ["recht"], location: "Hamburg", hourlyRateCents: 22000, workMode: "solo", rating: 4.8, completedCount: 17, verified: true }),
    profile(11, { headline: "Mobile Apps iOS/Android", rank: "silver", bio: "Swift, Kotlin, Flutter.", skills: ["Swift", "Flutter", "Mobile"], categories: ["software"], location: "Remote", hourlyRateCents: 10000, workMode: "team", rating: 4.6, completedCount: 12 }),
    profile(12, { headline: "Data Engineer", rank: "gold", bio: "ETL, dbt, Snowflake.", skills: ["SQL", "dbt", "Python"], categories: ["software"], location: "Remote", hourlyRateCents: 12000, workMode: "both", rating: 4.7, completedCount: 16 }),
    profile(13, { headline: "Elektro & Smart Home", rank: "bronze", bio: "Installation, KNX, Solar.", skills: ["Elektro", "KNX"], categories: ["handwerk"], location: "Nürnberg · 50 km", hourlyRateCents: 5500, workMode: "solo", rating: 4.4, completedCount: 27 }),
    profile(14, { headline: "Team-Koordinatorin", rank: "gold", bio: "Agile, Scrum, verteilte Teams.", skills: ["Scrum", "PM", "Teams"], categories: ["management"], location: "Remote", hourlyRateCents: 13000, workMode: "team", rating: 4.8, completedCount: 20 }),
    profile(15, { headline: "Salesforce Entwickler", rank: "silver", bio: "Apex, Flows, Integrationen.", skills: ["Salesforce", "Apex"], categories: ["software"], location: "Düsseldorf", hourlyRateCents: 10500, workMode: "solo", rating: 4.5, completedCount: 8 }),
    profile(16, { headline: "Medizinische Studien", rank: "gold", bio: "Clinical, Bioinformatik.", skills: ["Studien", "Bioinfo"], categories: ["wissenschaft"], location: "Freiburg", hourlyRateCents: 9000, workMode: "both", rating: 4.7, completedCount: 6 }),
    profile(17, { headline: "Controlling & FP&A", rank: "silver", bio: "Excel, SAP, Reporting.", skills: ["Controlling", "SAP"], categories: ["management"], location: "Stuttgart", hourlyRateCents: 14000, workMode: "solo", rating: 4.6, completedCount: 13 }),
    profile(18, { headline: "Content & SEO", rank: "bronze", bio: "Texte, Landingpages, Ads.", skills: ["SEO", "Copywriting"], categories: ["sonstiges"], location: "Remote", hourlyRateCents: 6500, workMode: "both", rating: 4.3, completedCount: 31 }),
    profile(19, { headline: "Autodidakt KI-Prompting", rank: "bronze", bio: "Kein Zertifikat — 40 Projekte belegt.", skills: ["KI", "Prompting", "Automation"], categories: ["software"], location: "Remote", hourlyRateCents: 7000, workMode: "solo", rating: 4.9, completedCount: 40, badges: ["Wettbewerbs-Sieger"] }),
    profile(20, { headline: "Team-Bündnis Lead", rank: "gold", bio: "Eingespieltes Remote-Team.", skills: ["Leadership", "Dev", "Design"], categories: ["software"], location: "Remote", hourlyRateCents: 15000, workMode: "team", rating: 4.85, completedCount: 24 }),
  ];
  marketStore.setProfiles(profiles);

  // Bilder werden als CSS-Verläufe + Emoji dargestellt (Karte im Apple-Store-Stil).
  const projects = [
    { id: 1, ownerId: 1, title: "Praxis-Buchungssystem MVP", description: "Online-Termine, DSGVO, Erinnerungen — vollständige Spezifikation nach NDA.", publicSummary: "• Software · Praxis\n• 28.000 € Festpreis\n• Team empfohlen\n• Remote", category: "software", budgetCents: 2800000, payModel: "fixed", taskMode: "owner", hiringMode: "team", teamSlots: 4, teamRecommended: true, status: "open", ndaLevel: 3, location: "Remote", durationLabel: "10 Wochen", workMode: "remote", splitMode: "shares", heroEmoji: "🩺", heroAccent: "#0071e3", heroTheme: "dark", eyebrowTag: "Neu · Health-Tech", ctaLabel: "Details ansehen", createdAt: now },
    { id: 2, ownerId: 1, title: "Turnaround Handwerksbetrieb", description: "Interim-GF 6 Monate, volle Details nach Vertraulichkeit.", publicSummary: "• Management · Erfolgsbasiert\n• Basis + 15 % Ersparnis\n• Vor Ort Stuttgart", category: "management", budgetCents: 12000000, payModel: "success", successFee: "+15 % nachweisbare Kosteneinsparung Jahr 1", taskMode: "owner", hiringMode: "solo", teamSlots: 1, status: "open", ndaLevel: 1, location: "Stuttgart", durationLabel: "6 Monate", heroEmoji: "🏭", heroAccent: "#8e8e93", heroTheme: "light", eyebrowTag: "Interim · Erfolg", ctaLabel: "Alles auf Pro.", createdAt: now },
    { id: 3, ownerId: 1, title: "Garten-Pflege Einfamilienhaus", description: "400 m², einmalig vor Verkauf.", publicSummary: "• Handwerk · 180 €\n• Solo · sofort", category: "handwerk", budgetCents: 18000, payModel: "fixed", hiringMode: "solo", teamSlots: 1, status: "open", ndaLevel: 0, location: "Gröbenzell", durationLabel: "1 Tag", heroEmoji: "🌳", heroAccent: "#34c759", heroTheme: "light", eyebrowTag: "Sofort verfügbar", createdAt: now },
    { id: 4, ownerId: 1, title: "Corporate Design Relaunch", description: "Logo, System, Social — Startup Series A.", publicSummary: "• Design · Team\n• 8.500 €", category: "design", budgetCents: 850000, payModel: "fixed", taskMode: "team", hiringMode: "both", teamSlots: 3, teamRecommended: true, status: "open", ndaLevel: 1, location: "München", durationLabel: "4 Wochen", heroEmoji: "🎨", heroAccent: "#ff375f", heroTheme: "dark", eyebrowTag: "Neu vorgestellt", splitMode: "custom", splitAllocations: [{ userId: 4, amountCents: 680000, label: "Lead Design" }, { userId: 11, amountCents: 170000, label: "Support" }], createdAt: now },
    { id: 5, ownerId: 1, title: "Logo-Wettbewerb KI-Startup", description: "Offener Wettbewerb — beste Arbeit gewinnt.", publicSummary: "• Wettbewerb · 2.500 €\n• Jeder kann mitmachen", category: "design", budgetCents: 250000, payModel: "contest", winnerCriteria: "best_by_deadline", contestDeadline: new Date(Date.now() + 21 * 86400000).toISOString(), hiringMode: "solo", teamSlots: 1, status: "open", ndaLevel: 0, location: "Remote", durationLabel: "3 Wochen", workMode: "remote", heroEmoji: "🏆", heroAccent: "#ff9500", heroTheme: "dark", eyebrowTag: "Wettbewerb", createdAt: now },
    { id: 6, ownerId: 1, title: "Vereinsportal inkl. Spenden", description: "WordPress oder Headless — 3 Rollen.", publicSummary: "• Software · Teilbesetzt\n• 2 Plätze frei", category: "software", budgetCents: 650000, payModel: "fixed", hiringMode: "team", teamSlots: 4, teamRecommended: true, status: "open", ndaLevel: 1, location: "Remote", durationLabel: "6 Wochen", taskMode: "team", heroEmoji: "🤝", heroAccent: "#5e5ce6", heroTheme: "light", eyebrowTag: "2 Plätze frei", createdAt: now },
    { id: 7, ownerId: 1, title: "Interim CFO 3 Monate", description: "Zeitvergütung, monatliche Meilensteine.", publicSummary: "• Management · Auf Zeit\n• 18.000 €/Monat", category: "management", budgetCents: 5400000, payModel: "time", hiringMode: "solo", teamSlots: 1, status: "open", ndaLevel: 2, location: "Frankfurt", durationLabel: "3 Monate", heroEmoji: "📊", heroAccent: "#1d1d1f", heroTheme: "dark", eyebrowTag: "Solo · Auf Zeit", createdAt: now },
    { id: 8, ownerId: 1, title: "Daten-Pipeline Migration", description: "Legacy → Snowflake, Team 3 Personen.", publicSummary: "• Software · Team · 45.000 €", category: "software", budgetCents: 4500000, payModel: "fixed", hiringMode: "team", teamSlots: 3, taskMode: "team", splitMode: "custom", splitAllocations: [{ userId: 12, amountCents: 3600000, label: "Lead 80 %" }, { userId: 8, amountCents: 900000, label: "Support 20 %" }], status: "open", ndaLevel: 2, location: "Remote", durationLabel: "8 Wochen", heroEmoji: "❄️", heroAccent: "#64d2ff", heroTheme: "dark", eyebrowTag: "80 / 20 Split", createdAt: now },
    { id: 9, ownerId: 1, title: "Mobile App Fitness-Coach", description: "Flutter, Backend, App Store Launch.", publicSummary: "• Software · Solo oder Team", category: "software", budgetCents: 3200000, payModel: "fixed", hiringMode: "both", teamSlots: 2, status: "assigned", assignedTo: 2, escrowHeldCents: 3200000, assignedAt: now, ndaLevel: 1, location: "Remote", durationLabel: "12 Wochen", heroEmoji: "📱", heroAccent: "#af52de", heroTheme: "dark", eyebrowTag: "Läuft", createdAt: now },
    { id: 10, ownerId: 1, title: "Steuerliche Due Diligence", description: "GmbH-Kauf abgeschlossen — Demo für Bewertungen.", publicSummary: "• Recht · 6.000 € · erledigt", category: "recht", budgetCents: 600000, payModel: "fixed", hiringMode: "solo", teamSlots: 1, status: "completed", assignedTo: 7, assignedAt: now, completedAt: now, ndaLevel: 2, location: "Remote", durationLabel: "2 Wochen", heroEmoji: "📑", heroAccent: "#8e8e93", heroTheme: "light", eyebrowTag: "Abgeschlossen", createdAt: now },
    { id: 11, ownerId: 1, title: "Studie klinische Auswertung", description: "Statistik, Bericht, Englisch.", publicSummary: "• Wissenschaft · 4.200 €", category: "wissenschaft", budgetCents: 420000, payModel: "fixed", status: "open", ndaLevel: 3, location: "Remote", durationLabel: "3 Wochen", heroEmoji: "🔬", heroAccent: "#30b0c7", heroTheme: "light", eyebrowTag: "GEHEIME IDEE · NDA 3", createdAt: now },
    { id: 12, ownerId: 1, title: "Elektro Smart-Home Nachrüstung", description: "KNX, 120 m² Wohnung.", publicSummary: "• Handwerk · Vor Ort", category: "handwerk", budgetCents: 890000, payModel: "fixed", status: "open", ndaLevel: 0, location: "Nürnberg", durationLabel: "2 Wochen", heroEmoji: "💡", heroAccent: "#ffcc00", heroTheme: "light", eyebrowTag: "Vor Ort", createdAt: now },
    { id: 13, ownerId: 2, title: "API-Dokumentation OpenAPI", description: "Bestehendes System dokumentieren.", publicSummary: "• Software · 1.200 € · Solo", category: "software", budgetCents: 120000, payModel: "fixed", status: "open", ndaLevel: 0, location: "Remote", durationLabel: "1 Woche", heroEmoji: "📚", heroAccent: "#0071e3", heroTheme: "light", eyebrowTag: "Klein · schnell", createdAt: now },
    { id: 14, ownerId: 1, title: "Pitch-Deck Wettbewerb", description: "Schnellste gute Präsentation gewinnt.", publicSummary: "• Wettbewerb · 800 €", category: "design", budgetCents: 80000, payModel: "contest", winnerCriteria: "fastest", status: "open", ndaLevel: 0, location: "Remote", durationLabel: "5 Tage", heroEmoji: "⚡", heroAccent: "#ff9500", heroTheme: "dark", eyebrowTag: "Speed-Wettbewerb", createdAt: now },
    { id: 15, ownerId: 1, title: "SEO-Relaunch Online-Shop", description: "Erfolgsbasiert: +20 % organischer Traffic.", publicSummary: "• Erfolg · 2.000 € + 10 % Mehrumsatz", category: "sonstiges", budgetCents: 200000, payModel: "success", successFee: "+10 % Mehrumsatz 6 Monate", status: "open", ndaLevel: 0, location: "Remote", durationLabel: "6 Monate", heroEmoji: "📈", heroAccent: "#34c759", heroTheme: "light", eyebrowTag: "Erfolgsbasiert", createdAt: now },
  ];
  marketStore.setProjects(projects);

  const teams = [
    { id: 1, name: "HealthCode Collective", tagline: "Medizin-Software eingespielt", description: "Dev + UX + Compliance — 31 Praxis-Portale.", ownerId: 2, categories: ["software"], public: true, preset: true, kind: "permanent", splitMode: "shares", teamRating: 4.85, openToJoin: true, createdAt: now },
    { id: 2, name: "Turnaround Unit", tagline: "Interim Management", description: "GF, Controlling, Einkauf.", ownerId: 3, categories: ["management"], public: true, preset: true, kind: "permanent", splitMode: "shares", teamRating: 4.9, openToJoin: false, createdAt: now },
    { id: 3, name: "Studio Nord", tagline: "Design & Motion", description: "Branding für Tech-Startups.", ownerId: 4, categories: ["design"], public: true, preset: true, kind: "permanent", splitMode: "equal", teamRating: 4.75, openToJoin: true, createdAt: now },
    { id: 4, name: "Cloud Sprint Squad", tagline: "DevOps + Backend", description: "2-Wochen-Sprints, AWS.", ownerId: 5, categories: ["software"], public: true, preset: false, kind: "permanent", splitMode: "equal", openToJoin: true, createdAt: now },
    { id: 5, name: "Recht & Compliance Duo", tagline: "Steuer + Arbeitsrecht", description: "Gründer-Paket.", ownerId: 7, categories: ["recht"], public: true, preset: true, kind: "permanent", splitMode: "shares", openToJoin: false, createdAt: now },
    { id: 6, name: "Data Forge", tagline: "Analytics & ML", description: "Julia + Leon + extern.", ownerId: 12, categories: ["software"], public: true, preset: false, kind: "permanent", splitMode: "shares", openToJoin: true, createdAt: now },
    { id: 7, name: "Handwerk Express", tagline: "Garten + Elektro + Maler", description: "Schnelle lokale Jobs.", ownerId: 6, categories: ["handwerk"], public: true, preset: true, kind: "permanent", splitMode: "equal", openToJoin: true, createdAt: now },
    { id: 8, name: "Remote Product Trio", tagline: "PM · Dev · Design", description: "Fest zusammen — Sandra führt.", ownerId: 20, categories: ["software"], public: true, preset: true, kind: "permanent", splitMode: "shares", teamRating: 4.88, openToJoin: false, createdAt: now },
  ];
  marketStore.setTeams(teams);

  marketStore.setTeamMembers([
    { id: 1, teamId: 1, userId: 2, role: "owner", shareBps: 3500, status: "active", joinedAt: now },
    { id: 2, teamId: 1, userId: 4, role: "member", shareBps: 2500, status: "active", joinedAt: now },
    { id: 3, teamId: 1, userId: 11, role: "member", shareBps: 2000, status: "active", joinedAt: now },
    { id: 4, teamId: 1, userId: 8, role: "member", shareBps: 2000, status: "active", joinedAt: now },
    { id: 5, teamId: 2, userId: 3, role: "owner", shareBps: 5000, status: "active", joinedAt: now },
    { id: 6, teamId: 2, userId: 17, role: "member", shareBps: 2500, status: "active", joinedAt: now },
    { id: 7, teamId: 2, userId: 7, role: "member", shareBps: 2500, status: "active", joinedAt: now },
    { id: 8, teamId: 3, userId: 4, role: "owner", shareBps: 4000, status: "active", joinedAt: now },
    { id: 9, teamId: 3, userId: 11, role: "member", shareBps: 3000, status: "active", joinedAt: now },
    { id: 10, teamId: 3, userId: 18, role: "member", shareBps: 3000, status: "active", joinedAt: now },
    { id: 11, teamId: 4, userId: 5, role: "owner", shareBps: 5000, status: "active", joinedAt: now },
    { id: 12, teamId: 4, userId: 12, role: "member", shareBps: 5000, status: "active", joinedAt: now },
    { id: 13, teamId: 5, userId: 7, role: "owner", shareBps: 5500, status: "active", joinedAt: now },
    { id: 14, teamId: 5, userId: 10, role: "member", shareBps: 4500, status: "active", joinedAt: now },
    { id: 15, teamId: 6, userId: 12, role: "owner", shareBps: 4000, status: "active", joinedAt: now },
    { id: 16, teamId: 6, userId: 8, role: "member", shareBps: 3000, status: "active", joinedAt: now },
    { id: 17, teamId: 6, userId: 15, role: "member", shareBps: 3000, status: "active", joinedAt: now },
    { id: 18, teamId: 7, userId: 6, role: "owner", shareBps: 3333, status: "active", joinedAt: now },
    { id: 19, teamId: 7, userId: 9, role: "member", shareBps: 3333, status: "active", joinedAt: now },
    { id: 20, teamId: 7, userId: 13, role: "member", shareBps: 3334, status: "active", joinedAt: now },
    { id: 21, teamId: 8, userId: 20, role: "owner", shareBps: 3500, status: "active", joinedAt: now },
    { id: 22, teamId: 8, userId: 2, role: "member", shareBps: 2500, status: "active", joinedAt: now },
    { id: 23, teamId: 8, userId: 4, role: "member", shareBps: 2000, status: "active", joinedAt: now },
    { id: 24, teamId: 8, userId: 14, role: "member", shareBps: 2000, status: "active", joinedAt: now },
  ]);

  marketStore.setParticipants([
    { id: 1, projectId: 6, userId: 2, status: "active", joinedAt: now },
    { id: 2, projectId: 6, userId: 4, status: "active", joinedAt: now },
    { id: 3, projectId: 9, userId: 2, status: "active", joinedAt: now, teamId: 1 },
  ]);

  marketStore.setBids([
    { id: 1, projectId: 1, bidderId: 2, message: "HealthCode kann MVP in 10 Wochen — Team steht.", priceCents: 2750000, status: "sent", createdAt: now },
    { id: 2, projectId: 1, bidderId: 3, message: "Interim plus Dev-Koordination — Turnaround Unit.", priceCents: 2800000, status: "sent", createdAt: now },
    { id: 3, projectId: 3, bidderId: 6, message: "Kann morgen — inkl. Entsorgung.", priceCents: 17500, status: "sent", createdAt: now },
    { id: 4, projectId: 4, bidderId: 4, message: "Studio Nord — 3 Personen, Design System inkl.", priceCents: 820000, teamId: 3, status: "sent", createdAt: now },
    { id: 5, projectId: 6, bidderId: 7, message: "Rechtliche AGB für Spenden — parallel.", priceCents: null, status: "sent", createdAt: now },
    { id: 6, projectId: 8, bidderId: 12, message: "Data Forge übernimmt Migration.", priceCents: 4400000, teamId: 6, status: "sent", createdAt: now },
  ]);

  marketStore.setTasks([
    { id: 1, projectId: 9, fromUserId: 1, assigneeUserId: 2, title: "Wireframes Startseite", description: "Figma-Link bis Freitag", outcome: "Figma-Link im Chat", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), status: "open", createdAt: now },
    { id: 2, projectId: 6, fromUserId: 1, assigneeUserId: 4, title: "Design System Tokens", description: "Farben, Typo", outcome: "Figma-Bibliothek", dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), status: "open", createdAt: now },
    { id: 3, projectId: 6, fromUserId: 1, assigneeUserId: 2, title: "API Entwurf Spenden", description: "OpenAPI Draft", outcome: "YAML-Datei", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: "open", createdAt: now },
  ]);

  const offers = [
    { id: 1, sellerUserId: 2, title: "Praxis-Software Paket", subtitle: "Termine + DSGVO", category: "software", status: "active", tiers: [{ id: "t1", name: "Basis", priceCents: 450000, days: 14 }, { id: "t2", name: "Plus", priceCents: 850000, days: 28 }], createdAt: now },
    { id: 2, sellerUserId: 4, title: "Brand Sprint", subtitle: "Logo + Guidelines", category: "design", status: "active", tiers: [{ id: "t1", name: "Standard", priceCents: 250000, days: 7 }], createdAt: now },
    { id: 3, sellerUserId: 7, title: "GmbH-Gründung", subtitle: "Komplett begleitet", category: "recht", status: "active", tiers: [{ id: "t1", name: "Fix", priceCents: 180000, days: 21 }], createdAt: now },
    { id: 4, sellerUserId: 6, title: "Garten Komplett", subtitle: "Bis 500 m²", category: "handwerk", status: "active", tiers: [{ id: "t1", name: "Standard", priceCents: 35000, days: 1 }], createdAt: now },
    { id: 5, sellerUserId: 12, title: "Data Audit", subtitle: "Bestand + Roadmap", category: "software", status: "active", tiers: [{ id: "t1", name: "Workshop", priceCents: 120000, days: 3 }], createdAt: now },
    { id: 6, sellerUserId: 10, title: "Arbeitsvertrag Check", subtitle: "Bis 10 Seiten", category: "recht", status: "active", tiers: [{ id: "t1", name: "Express", priceCents: 45000, days: 2 }], createdAt: now },
    { id: 7, sellerUserId: 19, title: "KI-Automation Setup", subtitle: "n8n + GPT", category: "software", status: "active", tiers: [{ id: "t1", name: "Starter", priceCents: 80000, days: 5 }], createdAt: now },
    { id: 8, sellerUserId: 3, title: "Interim 1 Woche", subtitle: "Analyse + Plan", category: "management", status: "active", tiers: [{ id: "t1", name: "Woche", priceCents: 450000, days: 5 }], createdAt: now },
  ];
  marketStore.setOffers(offers);

  const samples = [];
  let sid = 1;
  for (const uid of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 19, 20]) {
    samples.push({ id: sid++, userId: uid, title: `Referenzprojekt #${sid}`, description: "Abgeschlossene Demo-Arbeit — Nachweis.", link: "https://example.com/portfolio", skillTags: ["Umsetzung", "Qualität"], createdAt: now });
  }
  marketStore.setWorkSamples(samples);

  marketStore.setPayoutAccounts(users.filter((x) => x.id > 1).map((x, i) => ({ userId: x.id, status: "simulated", label: "Demo-Auszahlung", createdAt: now })));
  marketStore.setPaymentMethods([{ userId: 1, status: "simulated", label: "Demo-Karte ·••• 4242", brand: "visa", createdAt: now }]);

  marketStore.setTeamRequests([
    { id: 1, teamId: 1, fromUserId: 1, toUserId: 11, type: "invite", roleLabel: "Mobile Dev", shareBps: 2000, message: "Projekt Praxis-MVP — Mobile Anteil?", status: "pending", projectId: 1, createdAt: now },
    { id: 2, teamId: 8, fromUserId: 1, toUserId: 20, type: "project_team", message: "Remote Product Trio für Daten-Pipeline?", status: "pending", projectId: 8, createdAt: now },
  ]);

  marketStore.setInvites([
    { id: 1, projectId: 8, fromUserId: 1, toUserId: 12, message: "Data Forge für Migration — Einladung", status: "pending", createdAt: now },
  ]);

  marketStore.setConnections([
    { id: 1, fromUserId: 1, toUserId: 2, type: "collaborated", label: "3 Projekte", createdAt: now },
    { id: 2, fromUserId: 2, toUserId: 4, type: "collaborated", label: "HealthCode", createdAt: now },
    { id: 3, fromUserId: 3, toUserId: 17, type: "collaborated", label: "Turnaround", createdAt: now },
  ]);

  marketStore.setBids(marketStore.bids());
  marketStore.setNda([]);
  marketStore.setMessages([
    { id: 1, projectId: 9, senderId: 1, body: "Willkommen — bitte Wireframes bis Freitag.", createdAt: now },
    { id: 2, projectId: 9, senderId: 2, body: "Wireframes kommen Donnerstag, Meilenstein M2 eingereicht.", createdAt: now },
  ]);
  marketStore.setMilestones([
    { id: 1, projectId: 9, name: "M1 · Konzept", amountCents: 640000, status: "released", submittedAt: now, releasedAt: now, createdAt: now },
    { id: 2, projectId: 9, name: "M2 · Umsetzung", amountCents: 960000, status: "submitted", submittedAt: now, reviewDeadline: now, createdAt: now },
    { id: 3, projectId: 9, name: "M3 · Test", amountCents: 960000, status: "held", createdAt: now },
    { id: 4, projectId: 9, name: "M4 · Abnahme", amountCents: 640000, status: "held", createdAt: now },
  ]);
  marketStore.setReviews([]);
  marketStore.setVerifications([]);
  marketStore.setNetworkRequests([
    { id: 1, fromUserId: 1, toUserId: 2, message: "Lass uns weiter an Praxis-Themen arbeiten.", status: "accepted", createdAt: now, respondedAt: now },
    { id: 2, fromUserId: 4, toUserId: 1, message: "Design für Turnaround?", status: "pending", createdAt: now },
  ]);
  marketStore.setDelegations([
    { id: 1, fromUserId: 1, toUserId: 2, title: "API-Schnittstelle prüfen", description: "OpenAPI-Docs für Praxis-MVP.", projectId: 1, status: "active", createdAt: now, acceptedAt: now },
    { id: 2, fromUserId: 1, toUserId: 1, teamId: 2, title: "Lieferantenliste prüfen", description: "Turnaround Unit: Top-10-Lieferanten bewerten.", projectId: 2, status: "active", createdAt: now, acceptedAt: now },
  ]);
  marketStore.setBookings([]);
  marketStore.setTeamBuilds([
    {
      id: 1, projectId: 2, ownerId: 1,
      roles: [
        { name: "Führung", userId: 3, status: "confirmed" },
        { name: "Finanzen", userId: 17, status: "invited" },
        { name: "Vertrieb", userId: null, status: "open" },
        { name: "Recht", userId: 7, status: "confirmed" },
      ],
      createdAt: now,
    },
  ]);
  marketStore.setSuggestions([]);
  marketStore.setSubmissions([]);
  marketStore.setDisputes([]);
  marketStore.setNotifications([]);
  marketStore.setEscrowEvents([]);
  marketStore.setPayouts([]);

  store.setCollection("em_meta", [{ seedVersion: DEMO_SEED_VERSION, seededAt: now, resetNote: "Full mock v9" }]);
}

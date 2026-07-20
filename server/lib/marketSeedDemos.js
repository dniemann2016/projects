import { store } from "./store.js";
import { marketStore } from "./marketStore.js";
import { runMarketFullReset, DEMO_SEED_VERSION } from "./marketSeedFullReset.js";

function upsertUsers(extras) {
  const users = store.collection("users");
  for (const u of extras) {
    if (!users.some((x) => x.id === u.id)) users.push(u);
  }
  store.setCollection("users", users);
}

function upsertById(getCol, setCol, items) {
  const all = getCol();
  const map = new Map(all.map((x) => [x.id, x]));
  for (const item of items) map.set(item.id, { ...map.get(item.id), ...item });
  setCol([...map.values()]);
}

function upsertProfiles(items) {
  const all = marketStore.profiles();
  const map = new Map(all.map((p) => [p.userId, p]));
  for (const item of items) map.set(item.userId, { ...map.get(item.userId), ...item });
  marketStore.setProfiles([...map.values()]);
}

/** Reichhaltige Demo-Daten — Teams, Profile, Projekte, Leistungsangebote. */
export function seedMarketDemosV2() {
  const meta = store.collection("em_meta")[0] || {};
  const runV9 = !meta?.seedVersion || meta.seedVersion < DEMO_SEED_VERSION;
  if (runV9) {
    runMarketFullReset();
    return;
  }
  const now = new Date().toISOString();
  const runV2 = meta.seedVersion < 2;
  const runV3 = meta.seedVersion < 3;
  const runV4 = meta.seedVersion < 4;
  const runV5 = meta.seedVersion < 5;
  const runV6 = meta.seedVersion < 6;
  const runV7 = meta.seedVersion < 7;
  const runV8 = meta.seedVersion < 8;
  if (!runV2 && !runV3 && !runV4 && !runV5 && !runV6 && !runV7 && !runV8) return;
  upsertUsers([
    { id: 6, name: "Jonas W.", role: "user", createdAt: now, emails: [""], settings: { aiEnabled: false } },
    { id: 7, name: "Lena B.", role: "user", createdAt: now, emails: [""], settings: { aiEnabled: false } },
    { id: 8, name: "Martina K.", role: "user", createdAt: now, emails: [""], settings: { aiEnabled: false } },
    { id: 9, name: "Ali T.", role: "user", createdAt: now, emails: [""], settings: { aiEnabled: false } },
    { id: 10, name: "Dr. Ohme", role: "user", createdAt: now, emails: [""], settings: { aiEnabled: false } },
  ]);

  upsertProfiles([
    {
      userId: 1, headline: "Interim-GF & Turnaround", rank: "gold",
      bio: "20 Jahre Mittelstand. Zwei Betriebe dieser Größe durch die Krise geführt. Vor-Ort kein Problem.",
      skills: ["Sanierung", "Führung", "Einkauf", "Vertrieb"], categories: ["management"],
      location: "Stuttgart · 75 km Umkreis", hourlyRateCents: 18000, workMode: "both",
      availability: "ab 01.09.", public: true, rating: 4.9, completedCount: 11,
      onTimePercent: 98, responseHours: 2, verified: true, verificationTier: "full",
      badges: ["Schnell-Lieferer", "Wiederkehrer", "Teamspieler"],
      mapX: 0.42, mapY: 0.28, createdAt: now,
    },
    {
      userId: 2, headline: "Apps & Datenbanken · 6 Jahre Praxis", rank: "gold",
      bio: "Entwicklung von Apps und Datenbanken — selbst beigebracht, 6 Jahre Praxis. React, Node, DSGVO.",
      skills: ["React", "Node.js", "PostgreSQL", "DSGVO"], categories: ["software"],
      location: "Remote · Köln", hourlyRateCents: 8500, workMode: "team",
      availability: "ab 18.07. · 25 Std./Woche", public: true, rating: 4.8, completedCount: 23,
      onTimePercent: 98, responseHours: 2, verified: true, verificationTier: "full",
      badges: ["Schnell-Lieferer", "Punktlandung", "Teamspieler"],
      mapX: 0.65, mapY: 0.22, createdAt: now,
    },
    {
      userId: 3, headline: "Garten- & Landschaftspflege", rank: "silber",
      bio: "Solo oder mit Partner — schnell, sauber, fair. Rasen, Hecken, Entsorgung.",
      skills: ["Rasen", "Heckenschnitt", "Entsorgung"], categories: ["handwerk"],
      location: "Gröbenzell · 30 km", hourlyRateCents: 4500, workMode: "solo",
      availability: "sofort", public: true, rating: 5.0, completedCount: 34,
      onTimePercent: 100, responseHours: 4, verified: false, verificationTier: null,
      badges: ["Wiederkehrer"],
      mapX: 0.22, mapY: 0.55, createdAt: now,
    },
    {
      userId: 4, headline: "Brand & UI · Apple-inspiriert", rank: "gold",
      bio: "Corporate Design, Design Systems, Motion. Nur im Team oder mit Studio Nord.",
      skills: ["Figma", "Branding", "Webdesign"], categories: ["design"],
      location: "München · remote möglich", hourlyRateCents: 9500, workMode: "team",
      availability: "ab 15.08.", public: true, rating: 4.7, completedCount: 19,
      onTimePercent: 96, responseHours: 3, verified: true, verificationTier: "full",
      badges: ["Teamspieler"],
      mapX: 0.78, mapY: 0.42, createdAt: now,
    },
    {
      userId: 5, headline: "Arbeits- & Vertragsrecht", rank: "gold",
      bio: "Verträge, Datenschutz, Arbeitsrecht für Projekte und Teams.",
      skills: ["Arbeitsrecht", "Verträge", "DSGVO"], categories: ["recht"],
      location: "Stuttgart · 4 km", hourlyRateCents: 25000, workMode: "both",
      availability: "ab 01.09.", public: true, rating: 4.7, completedCount: 41,
      onTimePercent: 97, responseHours: 6, verified: true, verificationTier: "full",
      badges: ["Vertrauensperson"],
      mapX: 0.35, mapY: 0.72, createdAt: now,
    },
    {
      userId: 6, headline: "Full-Stack · Health-Tech MVP", rank: "gold",
      bio: "Terminportale, Praxissoftware, Schnittstellen. M2 oft vor Frist.",
      skills: ["TypeScript", "React", "APIs"], categories: ["software"],
      location: "Remote", hourlyRateCents: 9000, workMode: "both",
      availability: "25 Std./Woche", public: true, rating: 4.8, completedCount: 23,
      verified: true, verificationTier: "full", badges: ["Schnell-Lieferer", "Punktlandung"],
      mapX: 0.58, mapY: 0.18, createdAt: now,
    },
    {
      userId: 7, headline: "Websites für Vereine & Praxen", rank: "gold",
      bio: "Fertig in 14 Tagen. Impressum, Datenschutz, Übergabe mit Video-Leitfaden.",
      skills: ["Webdesign", "WordPress", "DSGVO"], categories: ["design", "software"],
      location: "Remote", hourlyRateCents: 7000, workMode: "solo",
      availability: "2 Slots frei", public: true, rating: 5.0, completedCount: 31,
      verified: true, verificationTier: "full", badges: ["Wiederkehrer", "Punktlandung"],
      mapX: 0.72, mapY: 0.65, createdAt: now,
    },
    {
      userId: 8, headline: "Sanierung & Führung · GOLD", rank: "gold",
      bio: "Zwei Betriebe durch die Krise geführt. Kassensturz, Lieferanten, Personal in 30 Tagen.",
      skills: ["Turnaround", "GF", "Controlling"], categories: ["management"],
      location: "Ludwigsburg · 18 km", hourlyRateCents: 20000, workMode: "both",
      availability: "sofort", public: true, rating: 4.9, completedCount: 11,
      verified: true, verificationTier: "full", badges: ["Schnell-Lieferer", "Wiederkehrer"],
      mapX: 0.50, mapY: 0.58, createdAt: now,
    },
    {
      userId: 9, headline: "Finanzen & Controlling", rank: "silber",
      bio: "Mahnwesen, Liquidität, Reporting für Mittelstand.",
      skills: ["Controlling", "Finanzen", "Excel"], categories: ["management"],
      location: "Stuttgart", hourlyRateCents: 14000, workMode: "team",
      availability: "ab 01.09.", public: true, rating: 4.6, completedCount: 7,
      verified: false, verificationTier: null, badges: [],
      mapX: 0.45, mapY: 0.48, createdAt: now,
    },
    {
      userId: 10, headline: "Wirtschaftsrecht · Verträge", rank: "silber",
      bio: "Vertragsgestaltung, AGB, Datenschutz für Projekte.",
      skills: ["Vertragsrecht", "DSGVO"], categories: ["recht"],
      location: "Hamburg · fern", hourlyRateCents: 22000, workMode: "team",
      availability: "nach Absprache", public: true, rating: 4.8, completedCount: 14,
      verified: false, verificationTier: null, badges: [],
      mapX: 0.30, mapY: 0.38, createdAt: now,
    },
  ]);

  upsertById(() => marketStore.projects(), marketStore.setProjects, [
    {
      id: 1, ownerId: 1,
      title: "Buchungssystem für Arztpraxen – MVP in 10 Wochen",
      description: "MVP für Online-Terminbuchung: Kalender, Erinnerungen, DSGVO-Einwilligungen. 4 Meilensteine. Frühbonus bei Abnahme vor Termin.",
      publicSummary: "• Software / Healthcare\n• MVP ~10 Wochen, Remote\n• Kalender & Erinnerungen\n• DSGVO-konform\n• Realisierung gesucht — Idee geschützt",
      category: "software", budgetCents: 2800000, location: "Remote", durationLabel: "10 Wochen",
      ndaLevel: 3, successFee: null, earlyBonusCents: 150000, teamRecommended: false, status: "open",
      workMode: "remote", mapX: 0.72, mapY: 0.35, createdAt: now,
    },
    {
      id: 2, ownerId: 1,
      title: "Sanierung Handwerksbetrieb – GF auf Zeit",
      description: "Interim-GF 6 Monate: Liquidität, Einkauf, Vertrieb. Teilweise vor Ort Stuttgart, 75 km Umkreis. Frühbonus +6.000 €.",
      category: "management", budgetCents: 12000000, location: "Stuttgart · 75 km", durationLabel: "6 Monate",
      ndaLevel: 1, successFee: "+10 % Kosteneinsparung Jahr 1", earlyBonusCents: 600000,
      teamRecommended: true, status: "open", workMode: "hybrid", mapX: 0.55, mapY: 0.62, createdAt: now,
    },
    {
      id: 3, ownerId: 1,
      title: "Rasen mähen & Heckenschnitt – Einfamilienhaus",
      description: "Garten ~400 m², einmalige Pflege vor Verkauf.",
      category: "handwerk", budgetCents: 18000, location: "Gröbenzell", durationLabel: "1 Tag",
      ndaLevel: 0, status: "open", workMode: "onsite", mapX: 0.28, mapY: 0.48, createdAt: now,
    },
    {
      id: 4, ownerId: 1,
      title: "Corporate Design Relaunch – Tech-Startup",
      description: "Logo, Farbsystem, Typografie, Social-Templates für Series-A.",
      category: "design", budgetCents: 850000, location: "München / Remote", durationLabel: "4 Wochen",
      ndaLevel: 1, teamRecommended: true, status: "open", workMode: "hybrid", mapX: 0.82, mapY: 0.58, createdAt: now,
    },
    {
      id: 5, ownerId: 1,
      title: "Lagerverwaltung für Werkstatt – Web-App",
      description: "Bestand, Bestellungen, Lieferanten — einfache Oberfläche für 15 Nutzer.",
      category: "software", budgetCents: 1450000, location: "Remote", durationLabel: "8 Wochen",
      ndaLevel: 1, status: "open", workMode: "remote", mapX: 0.68, mapY: 0.45, createdAt: now,
    },
    {
      id: 6, ownerId: 1,
      title: "Vereinsportal mit Terminbuchung",
      description: "Mitgliederbereich, News, Kalender für Sportverein (~800 Mitglieder).",
      category: "software", budgetCents: 69000, location: "Remote", durationLabel: "14 Tage",
      ndaLevel: 0, status: "open", workMode: "remote", mapX: 0.75, mapY: 0.30, createdAt: now,
    },
    {
      id: 7, ownerId: 1,
      title: "Steuerliche Due Diligence – GmbH-Kauf",
      description: "Kurzprüfung vor Übernahme einer GmbH (~20 MA). Remote mit 2 Vor-Ort-Tagen.",
      category: "recht", budgetCents: 450000, location: "Frankfurt", durationLabel: "3 Wochen",
      ndaLevel: 2, status: "open", workMode: "hybrid", mapX: 0.38, mapY: 0.68, createdAt: now,
    },
    {
      id: 8, ownerId: 1,
      title: "Büro-Umzug koordinieren – 120 Arbeitsplätze",
      description: "Planung, IT-Umzug, Möbel, Kommunikation. Projektleitung gesucht.",
      category: "management", budgetCents: 3200000, location: "München", durationLabel: "2 Monate",
      ndaLevel: 1, teamRecommended: true, status: "open", workMode: "onsite", mapX: 0.62, mapY: 0.72, createdAt: now,
    },
  ]);

  upsertById(() => marketStore.teams(), marketStore.setTeams, [
    {
      id: 1, name: "HealthCode Collective", tagline: "Software für Medizin & Praxen",
      description: "Festes Team: Entwicklung, UX, Compliance. Projekte ab 4 Wochen.",
      ownerId: 2, categories: ["software"], public: true, preset: true, openToJoin: true,
      teamRating: 4.9, sharedProjects: 7, avgDaysEarly: 3, teamDayRateCents: 290000,
      mapX: 0.58, mapY: 0.38, createdAt: now,
    },
    {
      id: 2, name: "Turnaround Unit", tagline: "Interim-Management im Mittelstand",
      description: "GF auf Zeit, Controlling, Einkauf — Kernteam mit 12 gemeinsamen Projekten.",
      ownerId: 1, categories: ["management"], public: true, preset: true, openToJoin: false,
      teamRating: 4.8, sharedProjects: 12, avgDaysEarly: 2, teamDayRateCents: 450000,
      mapX: 0.48, mapY: 0.52, createdAt: now,
    },
    {
      id: 3, name: "Studio Nord", tagline: "Design & Motion für Tech",
      description: "Branding, Web, Animation — arbeiten als eingespielte Einheit.",
      ownerId: 4, categories: ["design"], public: true, preset: true, openToJoin: true,
      teamRating: 4.9, sharedProjects: 5, avgDaysEarly: 1, teamDayRateCents: 180000,
      mapX: 0.75, mapY: 0.48, createdAt: now,
    },
    {
      id: 4, name: "Werkbank Vier", tagline: "EINGESPIELT · 7 gemeinsame Projekte",
      description: "Führung, Bau, Gestaltung, Recht — buchbar als Bündnis. Raum Köln/Bonn, auch bundesweit.",
      ownerId: 8, categories: ["management", "software", "design", "recht"], public: true, preset: true, openToJoin: false,
      teamRating: 4.9, sharedProjects: 7, avgDaysEarly: 3, teamDayRateCents: 290000,
      mapX: 0.52, mapY: 0.35, createdAt: now,
    },
    {
      id: 5, name: "Legal & Compliance Duo", tagline: "Verträge + Datenschutz",
      description: "Dr. Ohme + Partner für Projekt-Recht und DSGVO.",
      ownerId: 5, categories: ["recht"], public: true, preset: false, openToJoin: true,
      teamRating: 4.7, sharedProjects: 3, teamDayRateCents: 120000,
      mapX: 0.40, mapY: 0.62, createdAt: now,
    },
  ]);

  const members = marketStore.teamMembers();
  const memberUpserts = [
    { id: 1, teamId: 1, userId: 2, role: "owner", status: "active", joinedAt: now },
    { id: 2, teamId: 1, userId: 6, role: "member", status: "active", joinedAt: now },
    { id: 3, teamId: 2, userId: 1, role: "owner", status: "active", joinedAt: now },
    { id: 4, teamId: 2, userId: 8, role: "member", status: "active", joinedAt: now },
    { id: 5, teamId: 3, userId: 4, role: "owner", status: "active", joinedAt: now },
    { id: 6, teamId: 3, userId: 7, role: "member", status: "active", joinedAt: now },
    { id: 7, teamId: 4, userId: 8, role: "owner", status: "active", joinedAt: now },
    { id: 8, teamId: 4, userId: 2, role: "member", status: "active", joinedAt: now },
    { id: 9, teamId: 4, userId: 4, role: "member", status: "active", joinedAt: now },
    { id: 10, teamId: 4, userId: 5, role: "member", status: "active", joinedAt: now },
    { id: 11, teamId: 5, userId: 5, role: "owner", status: "active", joinedAt: now },
    { id: 12, teamId: 5, userId: 10, role: "member", status: "active", joinedAt: now },
  ];
  const mMap = new Map(members.map((m) => [m.id, m]));
  for (const m of memberUpserts) mMap.set(m.id, { ...mMap.get(m.id), ...m });
  marketStore.setTeamMembers([...mMap.values()]);

  marketStore.setOffers([
    {
      id: 1, sellerUserId: 7, title: "Vereins- oder Praxis-Website – fertig in 14 Tagen",
      subtitle: "Gestaltung, bis 6 Seiten, Impressum & Datenschutz, 2 Nachbesserungsrunden",
      category: "design", remote: true, rating: 5.0, reviewCount: 31, rank: "gold",
      process: "8 kurze Fragen → Entwurf Tag 5 → Änderungen → Fertig Tag 14 → Freigabe erst nach Abnahme",
      tiers: [
        { id: "basis", name: "Basis", priceCents: 69000, days: 14, features: ["6 Seiten", "2 Runden", "Video-Leitfaden"] },
        { id: "plus", name: "Plus", priceCents: 119000, days: 10, features: ["+ Terminbuchung", "+ mehrsprachig"] },
        { id: "rush", name: "Eilig", priceCents: 159000, days: 5, features: ["Plus-Umfang", "5 Werktage"] },
      ],
      status: "active", createdAt: now,
    },
    {
      id: 2, sellerUserId: 6, title: "Praxis-Terminportal MVP",
      subtitle: "Kalenderkern, Erinnerungen, DSGVO — klickbarer Stand Woche 3",
      category: "software", remote: true, rating: 4.8, reviewCount: 23, rank: "gold",
      process: "Datenmodell → Kalenderkern → Pilot mit 1 Praxis → Übergabe",
      tiers: [
        { id: "basis", name: "MVP", priceCents: 1800000, days: 70, features: ["4 Meilensteine", "Treuhand", "Dokumentation"] },
      ],
      status: "active", createdAt: now,
    },
    {
      id: 3, sellerUserId: 3, title: "Garten komplett pflegen – Einmalauftrag",
      subtitle: "Rasen, Hecke, Entsorgung — Material inklusive",
      category: "handwerk", remote: false, rating: 5.0, reviewCount: 34, rank: "silber",
      process: "Besichtigung (optional) → Termin → Erledigung am Tag → Abnahme vor Ort",
      tiers: [
        { id: "basis", name: "Standard", priceCents: 18000, days: 1, features: ["bis 400 m²", "Entsorgung"] },
        { id: "plus", name: "Groß", priceCents: 32000, days: 1, features: ["bis 800 m²", "Neupflanzung"] },
      ],
      status: "active", createdAt: now,
    },
    {
      id: 4, sellerUserId: 8, title: "Kassensturz & Stabilisierung – erste 30 Tage",
      subtitle: "Interim-Führung für Mittelstand in der Krise",
      category: "management", remote: false, rating: 4.9, reviewCount: 11, rank: "gold",
      process: "Woche 1 Kassensturz → Woche 2 Lieferanten → Woche 3 Personal → Bericht",
      tiers: [
        { id: "basis", name: "30-Tage-Paket", priceCents: 2800000, days: 30, features: ["Vor-Ort", "Bericht", "Treuhand"] },
      ],
      status: "active", createdAt: now,
    },
    {
      id: 5, sellerUserId: 4, title: "Logo + Brand Guidelines",
      subtitle: "Für Tech-Startups — inkl. Social-Templates",
      category: "design", remote: true, rating: 4.7, reviewCount: 19, rank: "gold",
      tiers: [
        { id: "basis", name: "Essential", priceCents: 450000, days: 21, features: ["Logo", "Farben", "Typo"] },
        { id: "plus", name: "Complete", priceCents: 850000, days: 28, features: ["+ Social", "+ Motion Snippets"] },
      ],
      status: "active", createdAt: now,
    },
    {
      id: 6, sellerUserId: 5, title: "Vertrags-Check für Freelance-Projekt",
      subtitle: "AGB, NDA, Werkvertrag — schriftliches Gutachten",
      category: "recht", remote: true, rating: 4.7, reviewCount: 41, rank: "gold",
      tiers: [
        { id: "basis", name: "Standard", priceCents: 89000, days: 5, features: ["bis 15 Seiten", "Schriftlich"] },
      ],
      status: "active", createdAt: now,
    },
  ]);

  // Demo-Verifizierungen für bereits verifizierte Profile
  if (runV2) {
    marketStore.setVerifications([
      { userId: 1, provider: "persona", status: "verified", sessionId: "demo-1", checks: { idDocument: true, liveness: true, video: true }, verifiedAt: now },
      { userId: 2, provider: "veriff", status: "verified", sessionId: "demo-2", checks: { idDocument: true, liveness: true, video: true }, verifiedAt: now },
      { userId: 6, provider: "persona", status: "verified", sessionId: "demo-6", checks: { idDocument: true, liveness: true, video: true }, verifiedAt: now },
      { userId: 7, provider: "onfido", status: "verified", sessionId: "demo-7", checks: { idDocument: true, liveness: true, video: true }, verifiedAt: now },
    ]);
  }

  if (runV3) {
    const bidMap = new Map(marketStore.bids().map((b) => [b.id, b]));
    for (const b of [
      {
        id: 1, projectId: 1, bidderId: 2, teamId: 1,
        message: "HealthCode Collective hat 3 Praxis-Portale gebaut. Erster Schritt: Datenmodell + Wireframes in Woche 1.",
        priceCents: 2650000, status: "sent", createdAt: now,
      },
      {
        id: 2, projectId: 1, bidderId: 6,
        message: "Solo oder mit Partner — MVP-Fokus auf Kalenderkern und DSGVO-Einwilligungen.",
        priceCents: 2750000, status: "sent", createdAt: now,
      },
      {
        id: 3, projectId: 2, bidderId: 8, teamId: 4,
        message: "Werkbank Vier: GF-Erfahrung + Controlling + Recht. Kassensturz in Woche 1.",
        priceCents: 11800000, status: "sent", createdAt: now,
      },
      {
        id: 4, projectId: 3, bidderId: 3,
        message: "Kann morgen kommen — Material und Entsorgung inklusive.",
        priceCents: 16500, status: "sent", createdAt: now,
      },
      {
        id: 5, projectId: 4, bidderId: 4, teamId: 3,
        message: "Studio Nord liefert Brand System inkl. Social-Templates.",
        priceCents: 820000, status: "sent", createdAt: now,
      },
    ]) bidMap.set(b.id, { ...bidMap.get(b.id), ...b });
    marketStore.setBids([...bidMap.values()]);

    const ndaRows = marketStore.nda();
    let ndaNext = ndaRows.length ? Math.max(...ndaRows.map((n) => n.id)) + 1 : 1;
    for (const row of [
      { projectId: 1, userId: 2, ndaLevel: 2, typedName: "Lisa K." },
      { projectId: 1, userId: 6, ndaLevel: 2, typedName: "Jonas W." },
      { projectId: 2, userId: 8, ndaLevel: 1, typedName: null },
    ]) {
      if (!ndaRows.some((n) => n.projectId === row.projectId && n.userId === row.userId)) {
        ndaRows.push({ ...row, id: ndaNext++, acceptedAt: now });
      }
    }
    marketStore.setNda(ndaRows);

    upsertById(() => marketStore.projects(), marketStore.setProjects, [
      {
        id: 9, ownerId: 1,
        title: "Demo: Vereins-Website — in Umsetzung",
        description: "Zugewiesenes Demo-Projekt mit Meilensteinen und Chat.",
        category: "design", budgetCents: 69000, location: "Remote", durationLabel: "14 Tage",
        ndaLevel: 0, status: "assigned", assignedTo: 7, assignedTeamId: null,
        escrowHeldCents: 69000, assignedAt: now, createdAt: now,
      },
      {
        id: 10, ownerId: 1,
        title: "Demo: Gartenpflege — abgeschlossen",
        description: "Abgeschlossenes Demo-Projekt für Bewertungstest.",
        category: "handwerk", budgetCents: 18000, location: "Gröbenzell", durationLabel: "1 Tag",
        ndaLevel: 0, status: "completed", assignedTo: 3, assignedAt: now, completedAt: now, createdAt: now,
      },
    ]);

    const existingMs = marketStore.milestones().filter((m) => m.projectId !== 9);
    let msNext = existingMs.length ? Math.max(...existingMs.map((m) => m.id)) + 1 : 1;
    existingMs.push(
      { id: msNext++, projectId: 9, name: "M1 · Konzept", amountCents: 13800, status: "released", submittedAt: now, releasedAt: now, createdAt: now },
      { id: msNext++, projectId: 9, name: "M2 · Umsetzung", amountCents: 20700, status: "submitted", submittedAt: now, reviewDeadline: now, createdAt: now },
      { id: msNext++, projectId: 9, name: "M3 · Test", amountCents: 20700, status: "held", createdAt: now },
      { id: msNext++, projectId: 9, name: "M4 · Abnahme", amountCents: 13800, status: "held", createdAt: now },
    );
    marketStore.setMilestones(existingMs);

    const msgs = marketStore.messages();
    if (!msgs.some((m) => m.projectId === 9)) {
      msgs.push(
        { id: msgs.length + 1, projectId: 9, senderId: 1, body: "Willkommen — bitte Entwurf bis Freitag.", createdAt: now },
        { id: msgs.length + 2, projectId: 9, senderId: 7, body: "Entwurf kommt Donnerstag, Meilenstein M2 eingereicht.", createdAt: now },
      );
      marketStore.setMessages(msgs);
    }

    marketStore.setTeamBuilds([
      {
        id: 1, projectId: 2, ownerId: 1,
        roles: [
          { name: "Führung", userId: 8, status: "confirmed" },
          { name: "Finanzen", userId: 9, status: "invited" },
          { name: "Vertrieb", userId: null, status: "open" },
          { name: "Recht", userId: 5, status: "confirmed" },
        ],
        createdAt: now,
      },
    ]);

    const dels = marketStore.delegations();
    if (!dels.some((d) => d.teamId === 2)) {
      dels.push({
        id: dels.length ? Math.max(...dels.map((d) => d.id)) + 1 : 2,
        fromUserId: 1, toUserId: 1, teamId: 2,
        title: "Lieferantenliste für Sanierung prüfen",
        description: "Turnaround Unit: bitte Top-10-Lieferanten bewerten.",
        projectId: 2, status: "active", createdAt: now, acceptedAt: now,
      });
      marketStore.setDelegations(dels);
    }
  }

  if (runV4) {
    const projects = marketStore.projects();
    const patch = (id, extra) => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx !== -1) projects[idx] = { ...projects[idx], ...extra };
    };
    patch(1, { hiringMode: "solo", teamSlots: 1 });
    patch(2, { hiringMode: "team", teamSlots: 4, teamRecommended: true });
    patch(3, { hiringMode: "solo", teamSlots: 1 });
    patch(4, { hiringMode: "team", teamSlots: 3, teamRecommended: true });
    patch(5, { hiringMode: "both", teamSlots: 2 });
    patch(6, { hiringMode: "solo", teamSlots: 1 });
    patch(7, { hiringMode: "both", teamSlots: 2 });
    patch(8, { hiringMode: "team", teamSlots: 5, teamRecommended: true });
    marketStore.setProjects(projects);

    const parts = marketStore.participants();
    const partUpserts = [
      { id: 1, projectId: 2, userId: 8, bidId: null, role: "Führung", status: "active", joinedAt: now },
      { id: 2, projectId: 2, userId: 5, bidId: null, role: "Recht", status: "active", joinedAt: now },
      { id: 3, projectId: 4, userId: 4, bidId: null, role: "Design", status: "active", joinedAt: now },
      { id: 4, projectId: 8, userId: 1, bidId: null, role: "Projektleitung", status: "active", joinedAt: now },
    ];
    const pMap = new Map(parts.map((p) => [p.id, p]));
    for (const p of partUpserts) pMap.set(p.id, { ...pMap.get(p.id), ...p });
    marketStore.setParticipants([...pMap.values()]);
  }

  if (runV5) {
    const projects = marketStore.projects();
    const patch = (id, extra) => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx !== -1) projects[idx] = { ...projects[idx], ...extra };
    };
    patch(1, {
      publicSummary: "• Software / Healthcare\n• MVP ~10 Wochen, Remote\n• Kalender & Erinnerungen\n• DSGVO-konform\n• Realisierung gesucht — Idee geschützt",
      ndaLevel: 3,
      status: "open",
      assignedTo: null,
      assignedAt: null,
      completedAt: null,
    });
    patch(2, {
      publicSummary: "• Management / Turnaround\n• Interim-GF 6 Monate\n• Stuttgart · hybrid\n• Team 4 Plätze · 2 besetzt",
      ndaLevel: 2,
    });
    patch(4, {
      publicSummary: "• Design / Branding\n• Tech-Startup Series-A\n• München / Remote\n• Team 3 Plätze · 1 besetzt",
    });
    patch(5, {
      publicSummary: "• Software / Werkstatt\n• Web-App Bestand & Bestellungen\n• Remote · 8 Wochen",
    });
    patch(7, {
      publicSummary: "• Recht / Due Diligence\n• GmbH-Kauf ~20 MA\n• Frankfurt · hybrid",
    });
    patch(8, {
      publicSummary: "• Management / Umzug\n• 120 Arbeitsplätze München\n• Team 5 Plätze · 1 besetzt",
    });

    const maxId = projects.length ? Math.max(...projects.map((p) => p.id)) : 10;
    const extraProjects = [
      {
        id: maxId + 1, ownerId: 2,
        title: "Demo: Solo-Projekt — React Dashboard",
        description: "Internes Controlling-Dashboard: KPIs, Export, Rollen. Solo-Entwickler gesucht.",
        publicSummary: "• Software · Solo\n• Dashboard · Remote\n• 6 Wochen",
        category: "software", budgetCents: 950000, location: "Remote", durationLabel: "6 Wochen",
        ndaLevel: 1, hiringMode: "solo", teamSlots: 1, status: "open", workMode: "remote", createdAt: now,
      },
      {
        id: maxId + 2, ownerId: 2,
        title: "Demo: Team-Projekt — App-Relaunch",
        description: "Kompletter Relaunch: Backend, Frontend, Design. Festes Team von 3–4 Personen.",
        publicSummary: "• Software + Design · Team\n• Relaunch · Remote/hybrid\n• 12 Wochen · 4 Plätze",
        category: "software", budgetCents: 4200000, location: "Köln / Remote", durationLabel: "12 Wochen",
        ndaLevel: 2, hiringMode: "team", teamSlots: 4, teamRecommended: true, status: "open", workMode: "hybrid", createdAt: now,
      },
      {
        id: maxId + 3, ownerId: 1,
        title: "Demo: Geheime Idee — KI-Prognose für Energie",
        description: "VERTRAULICH: Algorithmus zur Lastprognose für Windparks, Integration SCADA, MVP in 14 Wochen. Details nur nach Ideen-Schutz.",
        publicSummary: "• Software / Energie\n• MVP ~14 Wochen\n• Remote\n• Geheime Idee · Realisierung gesucht",
        category: "software", budgetCents: 3500000, location: "Remote", durationLabel: "14 Wochen",
        ndaLevel: 3, hiringMode: "both", teamSlots: 3, status: "open", workMode: "remote", createdAt: now,
      },
    ];
    for (const ep of extraProjects) {
      if (!projects.some((p) => p.id === ep.id)) projects.push(ep);
    }
    marketStore.setProjects(projects);

    const ndaRows = marketStore.nda();
    for (const row of ndaRows.filter((n) => n.projectId === 1)) {
      row.ndaLevel = 3;
      row.acceptIdeaTerms = true;
    }
    marketStore.setNda(ndaRows);

    const invites = marketStore.invites();
    if (!invites.some((i) => i.projectId === 6 && i.toUserId === 9)) {
      invites.push({
        id: invites.length ? Math.max(...invites.map((i) => i.id)) + 1 : 1,
        projectId: 6, fromUserId: 1, toUserId: 9,
        message: "Demo-Einladung: Vereinsportal — kannst du mitmachen?",
        status: "pending", createdAt: now,
      });
      marketStore.setInvites(invites);
    }

    const tasks = marketStore.tasks();
    if (!tasks.some((t) => t.projectId === 9)) {
      tasks.push({
        id: tasks.length ? Math.max(...tasks.map((t) => t.id)) + 1 : 1,
        projectId: 9, fromUserId: 1, assigneeUserId: 7,
        title: "Demo: Entwurf Startseite liefern",
        description: "Bitte bis Freitag ersten Entwurf im Chat verlinken.",
        status: "open", createdAt: now,
      });
      marketStore.setTasks(tasks);
    }

    const bidMap = new Map(marketStore.bids().map((b) => [b.id, b]));
    const bidNext = bidMap.size ? Math.max(...[...bidMap.keys()]) + 1 : 6;
    for (const b of [
      { id: bidNext, projectId: 6, bidderId: 7, message: "Demo-Bewerbung: Vereinsportale habe ich 31× gebaut.", priceCents: 65000, status: "sent", createdAt: now },
      { id: bidNext + 1, projectId: 8, bidderId: 9, message: "Controlling für Umzugs-Budget — kann Finanz-Teil übernehmen.", priceCents: null, status: "sent", createdAt: now },
    ]) {
      if (!bidMap.has(b.id) && !marketStore.bids().some((x) => x.projectId === b.projectId && x.bidderId === b.bidderId)) {
        bidMap.set(b.id, b);
      }
    }
    marketStore.setBids([...bidMap.values()]);
  }

  if (runV6) {
    const teams = marketStore.teams();
    for (const t of teams) {
      if (t.preset) t.kind = "permanent";
      else if (!t.kind) t.kind = "permanent";
    }
    marketStore.setTeams(teams);
    const tasks = marketStore.tasks();
    const demoTask = tasks.find((t) => t.projectId === 9);
    if (demoTask) {
      demoTask.outcome = "Entwurf Startseite als Link im Chat";
      demoTask.dueDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    }
    marketStore.setTasks(tasks);
  }

  if (runV7) {
    const projects = marketStore.projects();
    const maxId = projects.length ? Math.max(...projects.map((p) => p.id)) : 0;
    const contestProject = {
      id: maxId + 1,
      ownerId: 1,
      title: "Demo: Logo-Wettbewerb — Tech-Startup",
      description: "Öffentlicher Wettbewerb: Entwickelt ein Logo + Icon-Set für unser KI-Startup. Einreichung als PDF oder Figma-Link. Preisgeld in Treuhand.",
      publicSummary: "• Design · Wettbewerb\n• Preisgeld 2.500 €\n• Beste Arbeit gewinnt\n• Remote · jeder kann mitmachen",
      category: "design",
      budgetCents: 250000,
      payModel: "contest",
      winnerCriteria: "best_by_deadline",
      contestDeadline: new Date(Date.now() + 21 * 86400000).toISOString(),
      taskMode: "owner",
      location: "Remote",
      durationLabel: "3 Wochen",
      ndaLevel: 0,
      hiringMode: "solo",
      teamSlots: 1,
      teamRecommended: false,
      status: "open",
      workMode: "remote",
      createdAt: now,
    };
    if (!projects.some((p) => p.payModel === "contest")) {
      projects.push(contestProject);
      marketStore.setProjects(projects);
    }
    for (const p of projects) {
      if (!p.payModel) p.payModel = p.successFee && !p.budgetCents ? "success" : "fixed";
      if (!p.taskMode) p.taskMode = "team";
    }
    marketStore.setProjects(projects);
    const p2 = projects.find((x) => x.id === 2);
    if (p2 && !p2.payModel) {
      p2.payModel = "success";
    }
  }

  if (runV8) {
    const samples = marketStore.workSamples();
    for (const uid of [2, 3, 4, 6, 7]) {
      if (!samples.some((s) => s.userId === uid)) {
        samples.push({
          id: samples.length ? Math.max(...samples.map((s) => s.id)) + 1 : 1,
          userId: uid,
          title: "Referenzprojekt (Demo)",
          description: "Abgeschlossene Arbeit — Beleg fuer Faehigkeiten.",
          link: "https://example.com/demo",
          skillTags: ["Management", "Umsetzung"],
          createdAt: now,
        });
      }
    }
    marketStore.setWorkSamples(samples);
    const payouts = marketStore.payoutAccounts();
    for (const uid of [2, 3, 4, 6, 7, 8]) {
      if (!payouts.some((a) => a.userId === uid)) {
        payouts.push({ userId: uid, status: "simulated", label: "Demo-Auszahlung", createdAt: now });
      }
    }
    marketStore.setPayoutAccounts(payouts);
    const payments = marketStore.paymentMethods();
    if (!payments.some((a) => a.userId === 1)) {
      payments.push({ userId: 1, status: "simulated", label: "Demo-Karte", brand: "visa", createdAt: now });
    }
    marketStore.setPaymentMethods(payments);
    const profiles = marketStore.profiles();
    for (const p of profiles) {
      if (!p.viewMode) p.viewMode = "worker";
      if (p.userId === 1 && !p.clientMetrics) {
        p.clientMetrics = { projectsPosted: 5, avgApprovalDays: 2.1, fairAcceptPercent: 96, finalizeEarlyCount: 3, workerRating: 4.8 };
      }
    }
    marketStore.setProfiles(profiles);
    const teams = marketStore.teams();
    for (const t of teams) {
      if (!t.splitMode) t.splitMode = t.preset ? "shares" : "equal";
    }
    marketStore.setTeams(teams);
  }

  store.setCollection("em_meta", [{ seedVersion: DEMO_SEED_VERSION, seededAt: now }]);
}

#!/usr/bin/env node
/**
 * ExpertiseMarkt — Vollständiger Flow-Test (Erstellung + Annahme aller Wege).
 * Läuft 5× hintereinander zur Fünffach-Prüfung.
 */
const BASE = process.env.EM_API || "http://127.0.0.1:8794/api";
const TERMS_VERSION = "2026-07-10-em";
const RUNS = Number(process.env.EM_RUNS || 5);

const USERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Passwortlose Demo-Profile — im v10-Seed keine mehr. */
const PASSWORDLESS = new Set();
const DEMO_PW = "Demo2026!";
const ADMIN_PW = "Orion447!";
const tokenCache = {};

const LOGIN_BY_ID = {
  1: "davidhammon", 2: "maria_dev", 3: "jonas_w", 4: "lena_design", 5: "ali_tech",
  6: "martina_k", 7: "dr_ohme", 8: "sophie_h", 9: "tim_garten", 10: "nina_recht",
  11: "paul_ui", 12: "julia_data", 13: "max_hand", 14: "eva_team", 15: "leon_sf",
  16: "anna_wiss", 17: "ben_controll", 18: "clara_mkt", 19: "felix_auto", 20: "team_lead",
};

async function bootstrapAuth() {
  for (const uid of USERS) await loginToken(uid);
}

async function loginToken(userId) {
  if (tokenCache[userId]) return tokenCache[userId];
  const loginName = LOGIN_BY_ID[userId];
  const password = userId === 1 ? ADMIN_PW : DEMO_PW;
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginName, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Login user ${userId}: ${data.error || res.status}`);
  let token = data.token;
  if (data.twoFactorRequired) {
    const v = await fetch(`${BASE}/users/login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken: data.challengeToken, code: data.demoCode }),
    });
    const vd = await v.json().catch(() => ({}));
    if (!v.ok || !vd.token) throw new Error(`2FA user ${userId}: ${vd.error || v.status}`);
    token = vd.token;
  }
  if (!token) throw new Error(`No token for user ${userId}`);
  tokenCache[userId] = token;
  return token;
}

async function authHeaders(userId) {
  if (!userId) return {};
  if (PASSWORDLESS.has(userId)) return { "x-user-id": String(userId) };
  const token = await loginToken(userId);
  return { Authorization: `Bearer ${token}` };
}

async function acceptTerms(userId) {
  await req("/user/accept-terms", {
    userId, method: "POST",
    body: { termsAccepted: true, termsVersion: TERMS_VERSION },
  });
}

async function req(path, { userId, method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(await authHeaders(userId)),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function ensureNda(userId, projectId, { typedName = "Demo", acceptIdeaTerms = false } = {}) {
  const blind = await req(`/market/projects/${projectId}`, { userId });
  if (blind.canReadFull) return;
  await req(`/market/projects/${projectId}/nda`, {
    userId, method: "POST",
    body: { typedName, ...(acceptIdeaTerms ? { acceptIdeaTerms: true } : {}) },
  });
}

async function runSuite(runNum) {
  console.log(`\n═══ Durchlauf ${runNum}/${RUNS} ═══\n`);
  const tag = `R${runNum}-${Date.now()}`;

  await test("Admin: Login per Benutzername", async () => {
    const me = await req("/user/", { userId: 1 });
    assert(me.role === "admin", "Kein Admin-Konto");
  });

  await test("Admin: Nutzerliste mit Passwörtern", async () => {
    const users = await req("/market/admin/users", { userId: 1 });
    assert(users.length >= 20, `nur ${users.length} Nutzer`);
    const admin = users.find((u) => u.loginName === "davidhammon");
    assert(admin?.demoPassword === ADMIN_PW, "Admin-Passwort fehlt in Liste");
  });

  // ── Demo-Katalog ──
  await test("Demo: ≥8 Projekte", async () => {
    const items = await req("/market/projects");
    assert(items.length >= 8, `nur ${items.length} Projekte`);
  });

  await test("Demo: ≥10 Profile (Talente)", async () => {
    const t = await req("/market/search/talent?kind=person");
    assert(t.filter((x) => x.kind === "person" || x.userId).length >= 10, "zu wenig Profile");
  });

  await test("Demo: ≥5 Teams", async () => {
    const teams = await req("/market/teams");
    assert(teams.length >= 5, `nur ${teams.length} Teams`);
  });

  await test("Demo: ≥6 Leistungsangebote", async () => {
    const offers = await req("/market/offers");
    assert(offers.length >= 6, `nur ${offers.length} Angebote`);
  });

  await test("Demo: Teilbesetzte Team-Projekte", async () => {
    const partial = await req("/market/search/projects?staffing=partial");
    assert(partial.length >= 2, "keine teilbesetzten Projekte");
  });

  await test("Demo: Geheime Idee (NDA 3) mit Stichpunkten", async () => {
    const p = await req("/market/projects/1", { userId: 1 });
    assert(p.ndaLevel >= 3 || p.ideaProtected, "Projekt 1 nicht Ideen-geschützt");
    const blind = await req("/market/projects/1", { userId: 10 });
    assert(!blind.canReadFull, "User 10 sollte Volltext nicht sehen");
    assert(blind.publicSummary, "Stichpunkte fehlen");
  });

  // ── Projekt erstellen (alle NDA-Stufen) + Admin-Freigabe ──
  let createdId = null;
  await test("Erstellen: Projekt Stufe 1 + Stichpunkte", async () => {
    const p = await req("/market/projects", {
      userId: 1, method: "POST",
      body: {
        title: `Test Solo ${tag}`,
        description: "Vollständige Beschreibung für Integrationstest — Realisierung.",
        publicSummary: "• Test\n• Solo\n• Remote",
        category: "software",
        budgetCents: 500000,
        location: "Remote",
        durationLabel: "4 Wochen",
        ndaLevel: 1,
        hiringMode: "solo",
        teamSlots: 1,
      },
    });
    assert(p.id, "keine Projekt-ID");
    createdId = p.id;
    assert(p.status === "pending_review", "sollte pending_review sein");
  });

  await test("Erstellen: Admin-Freigabe", async () => {
    assert(createdId, "kein Projekt erstellt");
    const p = await req(`/market/projects/${createdId}/review`, {
      userId: 1, method: "POST", body: { approve: true },
    });
    assert(p.status === "open", "nicht open nach Freigabe");
  });

  await test("Erstellen: Geheime Idee (NDA 3)", async () => {
    const p = await req("/market/projects", {
      userId: 2, method: "POST",
      body: {
        title: `Test Idee ${tag}`,
        description: "Geheime Algorithmus-Details — nur nach Schutz sichtbar.",
        publicSummary: "• Energie / KI\n• MVP\n• Remote",
        category: "software",
        budgetCents: 1000000,
        ndaLevel: 3,
        hiringMode: "both",
        teamSlots: 3,
      },
    });
    await req(`/market/projects/${p.id}/review`, { userId: 1, method: "POST", body: { approve: true } });
  });

  // ── Solo-Bewerbung + Annahme ──
  let soloBidId = null;
  await test("Annehmen: Solo-Bewerbung senden", async () => {
    assert(createdId, "kein Testprojekt");
    await ensureNda(6, createdId, { typedName: "Jonas W." });
    const bid = await req("/market/bids", {
      userId: 6, method: "POST",
      body: { projectId: createdId, message: `Solo-Bewerbung ${tag} — Garten-Profi mit Software-Erfahrung.` },
    });
    soloBidId = bid.id;
  });

  await test("Annehmen: Solo-Bewerbung akzeptieren", async () => {
    assert(soloBidId, "keine Bewerbung");
    const res = await req(`/market/bids/${soloBidId}/accept`, { userId: 1, method: "POST", body: {} });
    assert(res.ok, "Annahme fehlgeschlagen");
    const p = await req(`/market/projects/${createdId}`, { userId: 1 });
    assert(p.participants?.length >= 1, "kein Teilnehmer nach Annahme");
    assert(p.status === "assigned", "Solo-Projekt nicht assigned");
  });

  // ── Team-Bewerbung + Annahme (Multi-Accept) ──
  let teamProjectId = null;
  let teamBidId = null;
  await test("Annehmen: Team-Projekt erstellen & freigeben", async () => {
    const p = await req("/market/projects", {
      userId: 1, method: "POST",
      body: {
        title: `Test Team ${tag}`,
        description: "Team-Realisierung mit 4 Plätzen für Integrationstest.",
        publicSummary: "• Team · 4 Plätze\n• Management",
        category: "management",
        budgetCents: 2000000,
        ndaLevel: 0,
        hiringMode: "team",
        teamSlots: 4,
      },
    });
    teamProjectId = p.id;
    await req(`/market/projects/${p.id}/review`, { userId: 1, method: "POST", body: { approve: true } });
  });

  await test("Annehmen: Team-Bewerbung (HealthCode)", async () => {
    assert(teamProjectId, "kein Team-Projekt");
    const bid = await req("/market/bids", {
      userId: 2, method: "POST",
      body: {
        projectId: teamProjectId,
        teamId: 1,
        message: `Team-Bewerbung ${tag} — HealthCode Collective.`,
        priceCents: 1900000,
      },
    });
    teamBidId = bid.id;
  });

  await test("Annehmen: Erste Team-Person akzeptieren", async () => {
    assert(teamBidId, "keine Team-Bewerbung");
    await req(`/market/bids/${teamBidId}/accept`, { userId: 1, method: "POST", body: {} });
  });

  await test("Annehmen: Zweite Person (Multi-Accept)", async () => {
    assert(teamProjectId, "kein Team-Projekt");
    const bid2 = await req("/market/bids", {
      userId: 6, method: "POST",
      body: { projectId: teamProjectId, message: `Zweite Person ${tag} — ergänze Entwicklung.` },
    });
    await req(`/market/bids/${bid2.id}/accept`, { userId: 1, method: "POST", body: {} });
    const parts = await req(`/market/collab/participants/project/${teamProjectId}`, { userId: 1 });
    assert(parts.participants.length >= 2, "Multi-Accept: weniger als 2 Teilnehmer");
  });

  // ── NDA / Ideen-Schutz akzeptieren ──
  await test("Annehmen: NDA Stufe 3 + Ideen-Schutz", async () => {
    const blind = await req("/market/projects/1", { userId: 9 });
    if (!blind.canReadFull) {
      await ensureNda(9, 1, { typedName: "Ali T.", acceptIdeaTerms: true });
      const full = await req("/market/projects/1", { userId: 9 });
      assert(full.canReadFull && full.description, "Volltext nach NDA 3 nicht frei");
    }
  });

  await test("Annehmen: NDA Stufe 2 mit Name", async () => {
    try {
      await req("/market/projects/7/nda", {
        userId: 4, method: "POST",
        body: { typedName: "Anna Design" },
      });
    } catch (e) {
      if (!e.message.includes("already") && !e.message.includes("bereits")) throw e;
    }
    const p = await req("/market/projects/7", { userId: 4 });
    assert(p.canReadFull || p.hasNda, "NDA Stufe 2 nicht wirksam");
  });

  // ── Einladung zum Projekt ──
  await test("Annehmen: Projekt-Einladung senden & annehmen", async () => {
    let openPid = null;
    const list = await req("/market/projects", { userId: 1 });
    const candidate = list.find((p) => p.status === "open" && p.ndaLevel === 0 && p.id !== createdId);
    openPid = candidate?.id || 6;
    const inv = await req("/market/collab/invites", {
      userId: 1, method: "POST",
      body: { projectId: openPid, userId: 10, message: `Einladung ${tag}` },
    });
    assert(inv.ok, "Einladung fehlgeschlagen");
    const mine = await req("/market/collab/invites/mine", { userId: 10 });
    const pending = mine.received?.find((i) => i.projectId === openPid && i.status === "pending");
    if (pending) {
      await req(`/market/collab/invites/${pending.id}/accept`, { userId: 10, method: "POST", body: {} });
    }
  });

  // ── Team: erstellen, suchen, Mitglied hinzufügen ──
  let newTeamId = null;
  await test("Erstellen: Team gründen", async () => {
    const t = await req("/market/teams", {
      userId: 9, method: "POST",
      body: {
        name: `Test Team ${tag}`,
        tagline: "Demo-Team für Integrationstest",
        description: "Automatisch erstellt.",
        categories: ["software"],
      },
    });
    newTeamId = t.id;
    assert(t.memberCount === 1, "Owner sollte Mitglied sein");
  });

  await test("Erstellen: Team-Mitglied suchen & hinzufügen", async () => {
    assert(newTeamId, "kein Team");
    const hits = await req(`/market/teams/${newTeamId}/members/search?q=React`, { userId: 9 });
    assert(hits.length >= 1, "Suche liefert keine Treffer");
    const target = hits.find((h) => h.userId !== 9) || hits[0];
    await req(`/market/teams/${newTeamId}/members`, {
      userId: 9, method: "POST",
      body: { userId: target.userId, direct: true },
    });
    const detail = await req(`/market/teams/${newTeamId}`, { userId: 9 });
    assert(detail.members.length >= 2, "Mitglied nicht hinzugefügt");
  });

  // ── Leistungsangebot buchen ──
  await test("Annehmen: Leistungsangebot buchen", async () => {
    const res = await req("/market/offers/3/book", {
      userId: 1, method: "POST",
      body: { tierId: "t1", message: `Buchung ${tag}` },
    });
    assert(res.ok !== false, "Buchung fehlgeschlagen");
  });

  // ── Zahlungen & Treuhand ──
  await test("Zahlung: Treuhand für Team-Projekt einzahlen", async () => {
    assert(teamProjectId, "kein Team-Projekt");
    await req("/market/payments/client/method", { userId: 1, method: "POST", body: {} });
    const fund = await req(`/market/payments/project/${teamProjectId}/fund`, {
      userId: 1, method: "POST", body: { amountCents: 2000000 },
    });
    assert(fund.escrowHeldCents === 2000000, "Treuhand nicht eingezahlt");
  });

  await test("Zahlung: Individuelle Team-Splits speichern", async () => {
    assert(teamProjectId, "kein Team-Projekt");
    const escrow = await req(`/market/payments/project/${teamProjectId}`, { userId: 1 });
    const parts = escrow.participants.filter((p) => p.userId !== 1);
    if (parts.length < 2) return;
    const split = await req(`/market/payments/project/${teamProjectId}/splits`, {
      userId: 1, method: "POST",
      body: {
        splitMode: "custom",
        allocations: parts.slice(0, 2).map((p, i) => ({
          userId: p.userId,
          amountCents: i === 0 ? 1200000 : 800000,
        })),
      },
    });
    assert(split.splitPreview?.length >= 2, "Split-Vorschau fehlt");
  });

  await test("Zahlung: Angebot buchen & in Treuhand zahlen", async () => {
    await req("/market/payments/client/method", { userId: 5, method: "POST", body: {} });
    const book = await req("/market/offers/4/book", { userId: 5, method: "POST", body: { tierId: "t1" } });
    assert(book.bookingId, "Keine Buchung");
    const pay = await req(`/market/payments/bookings/${book.bookingId}/pay`, {
      userId: 5, method: "POST", body: {},
    });
    assert(pay.escrowHeldCents > 0, "Keine Treuhand-Zahlung");
  });

  // ── Aufgabe zuweisen ──
  await test("Erstellen: Aufgabe an Projektmitglied", async () => {
    assert(teamProjectId, "kein Team-Projekt");
    const parts = await req(`/market/collab/participants/project/${teamProjectId}`, { userId: 1 });
    const assignee = parts.participants[0]?.userId;
    assert(assignee, "kein Assignee");
    await req("/market/collab/tasks", {
      userId: 1, method: "POST",
      body: {
        projectId: teamProjectId,
        assigneeUserId: assignee,
        title: `Demo-Aufgabe ${tag}`,
        description: "Bitte erledigen.",
      },
    });
    const tasks = await req("/market/collab/tasks/mine", { userId: assignee });
    assert(tasks.some((t) => t.title.includes("Demo-Aufgabe")), "Aufgabe nicht bei Assignee");
  });

  // ── Kooperation / Vorschlag ──
  await test("Erstellen: Projekt-Vorschlag an Person", async () => {
    const open = (await req("/market/projects", { userId: 1 })).find((p) => p.status === "open");
    assert(open, "kein offenes Projekt");
    await req("/market/collab/suggestions/project", {
      userId: 1, method: "POST",
      body: { projectId: open.id, toUserId: 5, message: `Vorschlag ${tag}` },
    });
  });

  // ── Suche & Filter ──
  await test("Suche: Talente nach Skill", async () => {
    const hits = await req("/market/search/talent?q=React&kind=person");
    assert(hits.length >= 1, "Talent-Suche leer");
  });

  await test("Suche: Projekte Solo-Filter", async () => {
    const solo = await req("/market/search/projects?for=solo");
    assert(solo.every((p) => ["solo", "both"].includes(p.hiringMode || "solo")), "Solo-Filter falsch");
  });

  await test("Profil: Erstellte Projekte", async () => {
    const projs = await req("/market/profiles/1/projects");
    assert(projs.length >= 3, "zu wenig Projekte im Profil");
  });

  // ── Meilenstein & Bewertung (Demo-Daten) ──
  await test("Annehmen: Meilenstein freigeben", async () => {
    const ms = await req("/market/milestones/project/9", { userId: 1 });
    const submitted = ms.milestones.find((m) => m.status === "submitted");
    if (submitted) {
      await req(`/market/milestones/${submitted.id}/approve`, { userId: 1, method: "POST", body: {} });
    }
  });

  await test("Annehmen: Bewerbung ablehnen", async () => {
    const open = (await req("/market/projects", { userId: 1 })).find((p) => p.status === "open" && p.id === 3);
    if (!open) return;
    const detail = await req("/market/projects/3", { userId: 1 });
    const sent = detail.bids?.find((b) => b.status === "sent");
    if (sent) {
      await req(`/market/bids/${sent.id}/reject`, { userId: 1, method: "POST", body: {} });
    }
  });

  await test("Team beitreten (openToJoin)", async () => {
    try {
      await req("/market/teams/1/join", { userId: 10, method: "POST", body: {} });
    } catch (e) {
      if (!e.message.includes("bereits")) throw e;
    }
  });
}

console.log("ExpertiseMarkt — Vollständiger Flow-Test (5× Prüfung)\n");
console.log(`API: ${BASE}\n`);

await bootstrapAuth();

for (const uid of USERS) {
  try { await acceptTerms(uid); } catch { /* already accepted */ }
}

for (let r = 1; r <= RUNS; r++) {
  await runSuite(r);
}

console.log(`\n${"═".repeat(40)}`);
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen (${RUNS} Durchläufe)`);
if (failures.length) {
  console.log("\nFehler:");
  for (const f of failures) console.log(`  • ${f.name}: ${f.error}`);
}
process.exit(failed ? 1 : 0);

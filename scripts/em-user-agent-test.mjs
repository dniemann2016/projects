#!/usr/bin/env node
/**
 * Nutzer-Simulations-Agent — Login, Admin, Teams, Zahlungen, Escrow, Splits.
 * Läuft 3× hintereinander zur Dreifach-Prüfung.
 */
const BASE = process.env.EM_API || "http://127.0.0.1:8794/api";
const TERMS_VERSION = "2026-07-10-em";
const RUNS = Number(process.env.EM_AGENT_RUNS || 3);

const DEMO_PW = "Demo2026!";
const ADMIN_PW = "Orion447!";
const tokenCache = {};

const LOGIN_BY_ID = {
  1: "davidhammon", 2: "maria_dev", 3: "jonas_w", 4: "lena_design", 5: "ali_tech",
  6: "martina_k", 7: "dr_ohme", 8: "sophie_h", 9: "tim_garten", 10: "nina_recht",
  11: "paul_ui", 12: "julia_data", 13: "max_hand", 14: "eva_team", 15: "leon_sf",
  16: "anna_wiss", 17: "ben_controll", 18: "clara_mkt", 19: "felix_auto", 20: "team_lead",
};

async function loginToken(userId) {
  if (tokenCache[userId]) return tokenCache[userId];
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginName: LOGIN_BY_ID[userId], password: userId === 1 ? ADMIN_PW : DEMO_PW }),
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
  return { Authorization: `Bearer ${await loginToken(userId)}` };
}

async function req(path, { userId, method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(userId ? await authHeaders(userId) : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

async function acceptTerms(userId) {
  try {
    await req("/user/accept-terms", {
      userId, method: "POST",
      body: { termsAccepted: true, termsVersion: TERMS_VERSION },
    });
  } catch { /* already accepted */ }
}

async function setupPayments(userId) {
  await req("/market/payments/client/method", { userId, method: "POST", body: {} });
  await req("/market/payments/payout/onboard", { userId, method: "POST", body: {} });
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

async function runAgent(runNum) {
  const tag = `Agent-R${runNum}-${Date.now()}`;
  console.log(`\n═══ Nutzer-Agent Durchlauf ${runNum}/${RUNS} (${tag}) ═══\n`);

  // ── Auth & Admin ──
  await test("Agent: Admin-Login mit 2FA", async () => {
    const me = await req("/user/", { userId: 1 });
    assert(me.role === "admin", "Kein Admin");
    assert(me.id === 1, "Falsche Admin-ID");
  });

  await test("Agent: Nutzer-Login (Maria)", async () => {
    const me = await req("/user/", { userId: 2 });
    assert(me.id === 2, "Maria nicht eingeloggt");
  });

  await test("Agent: Admin-Nutzerliste + Impersonation-Daten", async () => {
    const users = await req("/market/admin/users", { userId: 1 });
    assert(users.length >= 20, `nur ${users.length} Nutzer`);
    const detail = await req("/market/admin/users/2", { userId: 1 });
    assert(detail.account?.loginName === "maria_dev", "Nutzer-Detail fehlt");
  });

  // ── Auftraggeber: Projekt mit Preis + Team ──
  let projectId = null;
  const ownerId = 1;
  const workerA = 2;
  const workerB = 6;
  const budgetCents = 3000000;

  await test("Agent: Auftraggeber erstellt Team-Projekt (Nach Menge)", async () => {
    await setupPayments(ownerId);
    const p = await req("/market/projects", {
      userId: ownerId, method: "POST",
      body: {
        title: `Agent-Projekt ${tag}`,
        description: "Simuliertes Projekt mit Team-Vergütung und Treuhand.",
        publicSummary: "• Agent-Test\n• Team · 3 Plätze\n• Nach Menge",
        category: "software",
        budgetCents,
        unitPriceCents: 5000,
        unitLabel: "Datensatz",
        payModel: "quantity",
        location: "Remote",
        durationLabel: "8 Wochen",
        ndaLevel: 0,
        hiringMode: "team",
        teamSlots: 3,
        splitMode: "custom",
        taskMode: "team",
      },
    });
    assert(p.id, "Keine Projekt-ID");
    projectId = p.id;
    assert(p.status === "pending_review", "Sollte pending_review sein");
  });

  await test("Agent: Admin gibt Projekt frei", async () => {
    const p = await req(`/market/projects/${projectId}/review`, {
      userId: 1, method: "POST", body: { approve: true },
    });
    assert(p.status === "open", "Nicht open");
  });

  await test("Agent: Auftraggeber zahlt in Treuhand ein", async () => {
    const fund = await req(`/market/payments/project/${projectId}/fund`, {
      userId: ownerId, method: "POST", body: { amountCents: budgetCents },
    });
    assert(fund.ok, "Funding fehlgeschlagen");
    assert(fund.escrowHeldCents === budgetCents, "Falscher Treuhand-Betrag");
  });

  // ── Bewerber: Solo + Team ──
  await test("Agent: Worker A bewirbt sich (Team)", async () => {
    await setupPayments(workerA);
    const bid = await req("/market/bids", {
      userId: workerA, method: "POST",
      body: { projectId, teamId: 1, message: `Team-Bewerbung ${tag}`, priceCents: budgetCents },
    });
    assert(bid.id, "Keine Bewerbung A");
  });

  await test("Agent: Worker B bewirbt sich (Einzelperson)", async () => {
    await setupPayments(workerB);
    const bid = await req("/market/bids", {
      userId: workerB, method: "POST",
      body: { projectId, message: `Solo-Ergänzung ${tag}` },
    });
    assert(bid.id, "Keine Bewerbung B");
  });

  await test("Agent: Auftraggeber nimmt beide an (Multi-Accept)", async () => {
    const detail = await req(`/market/projects/${projectId}`, { userId: ownerId });
    const pending = (detail.bids || []).filter((b) => b.status === "sent");
    assert(pending.length >= 2, "Weniger als 2 offene Bewerbungen");
    for (const b of pending.slice(0, 2)) {
      await req(`/market/bids/${b.id}/accept`, { userId: ownerId, method: "POST", body: {} });
    }
    const parts = await req(`/market/collab/participants/project/${projectId}`, { userId: ownerId });
    assert(parts.participants.length >= 2, "Multi-Accept fehlgeschlagen");
  });

  // ── Team-Split: individuelle Zuweisung ──
  await test("Agent: Individuelle Team-Vergütung zuweisen (eingefroren)", async () => {
    const escrow = await req(`/market/payments/project/${projectId}`, { userId: ownerId });
    const parts = escrow.participants.filter((p) => p.userId !== ownerId);
    assert(parts.length >= 2, "Zu wenig Teilnehmer für Split");
    const a = parts[0].userId;
    const b = parts[1].userId;
    const split = await req(`/market/payments/project/${projectId}/splits`, {
      userId: ownerId, method: "POST",
      body: {
        splitMode: "custom",
        allocations: [
          { userId: a, amountCents: 1800000, label: "Lead" },
          { userId: b, amountCents: 1200000, label: "Support" },
        ],
      },
    });
    assert(split.ok !== false, "Split speichern fehlgeschlagen");
    assert(split.splitPreview?.length >= 2, "Keine Split-Vorschau");
    const total = split.splitPreview.reduce((s, r) => s + r.grossCents, 0);
    assert(total === budgetCents, `Split-Summe ${total} ≠ ${budgetCents}`);
  });

  // ── Meilenstein: einreichen + auszahlen ──
  await test("Agent: Meilenstein einreichen & freigeben (Team-Auszahlung)", async () => {
    const ms = await req(`/market/milestones/project/${projectId}`, { userId: ownerId });
    const held = ms.milestones?.find((m) => m.status === "held");
    assert(held, "Kein Meilenstein in held");
    await req(`/market/milestones/${held.id}/submit`, { userId: workerA, method: "POST", body: {} });
    await req(`/market/milestones/${held.id}/approve`, { userId: ownerId, method: "POST", body: {} });
    let payoutsA = [];
    let payoutsB = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      payoutsA = await req("/market/payments/payouts/mine", { userId: workerA });
      payoutsB = await req("/market/payments/payouts/mine", { userId: workerB });
      if (payoutsA.some((p) => p.projectId === projectId) && payoutsB.some((p) => p.projectId === projectId)) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    assert(payoutsA.some((p) => p.projectId === projectId), "Worker A keine Auszahlung");
    assert(payoutsB.some((p) => p.projectId === projectId), "Worker B keine Auszahlung");
  });

  // ── Leistungsangebot: erstellen, buchen, zahlen, freigeben ──
  let offerId = null;
  let bookingId = null;
  const sellerId = 9;
  const buyerId = 5;

  await test("Agent: Anbieter erstellt Leistungsangebot mit Preisen", async () => {
    await setupPayments(sellerId);
    const o = await req("/market/offers", {
      userId: sellerId, method: "POST",
      body: {
        title: `Agent-Angebot ${tag}`,
        subtitle: "Simulierte Leistung",
        category: "handwerk",
        tiers: [
          { id: "basic", name: "Basis", priceCents: 99000, days: 3 },
          { id: "pro", name: "Pro", priceCents: 199000, days: 7 },
        ],
        process: "1. Briefing 2. Leistung 3. Abnahme",
      },
    });
    assert(o.id, "Kein Angebot");
    offerId = o.id;
    assert(o.tiers?.length === 2, "Pakete fehlen");
  });

  await test("Agent: Käufer bucht & zahlt in Treuhand", async () => {
    await setupPayments(buyerId);
    const book = await req(`/market/offers/${offerId}/book`, {
      userId: buyerId, method: "POST",
      body: { tierId: "basic" },
    });
    assert(book.bookingId, "Keine Buchung");
    bookingId = book.bookingId;
    const pay = await req(`/market/payments/bookings/${bookingId}/pay`, {
      userId: buyerId, method: "POST", body: {},
    });
    assert(pay.paymentStatus === "held" || pay.escrowHeldCents === 99000, "Zahlung nicht in Treuhand");
  });

  await test("Agent: Käufer gibt Leistung frei → Anbieter-Auszahlung", async () => {
    const rel = await req(`/market/payments/bookings/${bookingId}/release`, {
      userId: buyerId, method: "POST", body: {},
    });
    assert(rel.ok !== false, "Freigabe fehlgeschlagen");
    assert(rel.netCents > 0, "Keine Netto-Auszahlung");
    const sellerPayouts = await req("/market/payments/payouts/mine", { userId: sellerId });
    assert(sellerPayouts.some((p) => p.bookingId === bookingId), "Anbieter keine Auszahlung");
  });

  // ── Teams ──
  await test("Agent: Team gründen & Mitglied hinzufügen", async () => {
    const t = await req("/market/teams", {
      userId: buyerId, method: "POST",
      body: {
        name: `Agent-Team ${tag}`,
        tagline: "Simuliert",
        description: "Agent-Test",
        categories: ["software"],
      },
    });
    assert(t.id, "Kein Team");
    await req(`/market/teams/${t.id}/members`, {
      userId: buyerId, method: "POST",
      body: { userId: workerB, direct: true },
    });
    const detail = await req(`/market/teams/${t.id}`, { userId: buyerId });
    assert(detail.members.length >= 2, "Mitglied nicht hinzugefügt");
  });

  await test("Agent: Escrow-Übersicht nach Auszahlung", async () => {
    const escrow = await req(`/market/payments/project/${projectId}`, { userId: ownerId });
    assert(escrow.escrowReleasedCents > 0, "Nichts ausgezahlt");
  });
}

console.log("ExpertiseMarkt — Nutzer-Simulations-Agent (3× Prüfung)\n");
console.log(`API: ${BASE}\n`);

for (const uid of [1, 2, 5, 6, 9]) {
  await loginToken(uid);
  await acceptTerms(uid);
}

for (let r = 1; r <= RUNS; r++) {
  await runAgent(r);
}

console.log(`\n${"═".repeat(40)}`);
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen (${RUNS} Durchläufe)`);
if (failures.length) {
  console.log("\nFehler:");
  for (const f of failures) console.log(`  • ${f.name}: ${f.error}`);
  process.exit(1);
}
console.log("\nAlle Agent-Durchläufe erfolgreich.");
process.exit(0);

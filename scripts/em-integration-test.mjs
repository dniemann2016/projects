#!/usr/bin/env node
/** ExpertiseMarkt API smoke + flow tests */
const BASE = process.env.EM_API || "http://127.0.0.1:8794/api";
const TERMS_VERSION = "2026-07-10-em";

const PASSWORDLESS = new Set();
const DEMO_PW = "Demo2026!";
const ADMIN_PW = "Orion447!";
const tokenCache = {};

async function bootstrapAuth() {
  await loginToken(1);
  for (const uid of [2, 6]) await loginToken(uid);
}

const LOGIN_BY_ID = {
  1: "davidhammon", 2: "maria_dev", 3: "jonas_w", 4: "lena_design", 5: "ali_tech",
  6: "martina_k", 7: "dr_ohme", 8: "sophie_h", 9: "tim_garten", 10: "nina_recht",
  11: "paul_ui", 12: "julia_data", 13: "max_hand", 14: "eva_team", 15: "leon_sf",
  16: "anna_wiss", 17: "ben_controll", 18: "clara_mkt", 19: "felix_auto", 20: "team_lead",
};

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
function ok(name) { passed++; console.log(`  ✓ ${name}`); }
function fail(name, e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
async function test(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

console.log("ExpertiseMarkt Integration Tests\n");

await bootstrapAuth();

await test("accept terms (users 2, 6)", async () => {
  await acceptTerms(2);
  await acceptTerms(6);
});

await test("health", () => req("/health"));

await test("projects list", async () => {
  const items = await req("/market/projects");
  if (!items.length) throw new Error("no projects");
});

await test("project detail with enriched bids (owner)", async () => {
  const p = await req("/market/projects/1", { userId: 1 });
  if (!p.bids?.length) throw new Error("expected demo bids");
  const b = p.bids[0];
  if (!b.proposedCents && !b.priceCents) throw new Error("missing price");
  if (!b.bidderName) throw new Error("missing bidderName");
});

await test("team builder", async () => {
  const tb = await req("/market/team-builder/2", { userId: 1 });
  if (!tb.roles?.length) throw new Error("no roles");
  if (!tb.suggestions?.length) throw new Error("no suggestions");
});

await test("milestones on assigned demo project", async () => {
  const ms = await req("/market/milestones/project/9", { userId: 1 });
  if (ms.milestones.length < 4) throw new Error("expected 4 milestones");
});

await test("milestone approve (owner)", async () => {
  const ms = await req("/market/milestones/project/9", { userId: 1 });
  const submitted = ms.milestones.find((m) => m.status === "submitted");
  if (submitted) {
    await req(`/market/milestones/${submitted.id}/approve`, { userId: 1, method: "POST", body: {} });
  } else if (!ms.milestones.some((m) => m.status === "released")) {
    throw new Error("no submitted or released milestone");
  }
});

await test("reviews on completed project", async () => {
  const rev = await req("/market/reviews/project/10", { userId: 1 });
  if (!rev.canSubmit && !rev.myReview) throw new Error("unexpected review state");
  if (rev.canSubmit) {
    await req("/market/reviews/project/10", {
      userId: 1, method: "POST",
      body: { quality: 5, reliability: 5, communication: 4, value: 5, comment: "Demo" },
    });
  }
});

await test("offer booking", async () => {
  const res = await req("/market/offers/1/book", {
    userId: 1, method: "POST", body: { tierId: "t1" },
  });
  if (!res.ok) throw new Error("booking failed");
});

await test("organon delegations with team", async () => {
  const d = await req("/market/organon/delegations", { userId: 1 });
  const teamDel = [...d.sent, ...d.received].find((x) => x.teamId);
  if (!teamDel) throw new Error("no team delegation in seed");
});

await test("admin users list", async () => {
  const users = await req("/market/admin/users", { userId: 1 });
  if (users.length < 20) throw new Error("expected 20 demo users");
});

await test("bid flow: bid as user 6 on project 3", async () => {
  const pid = 3;
  try {
    await req("/market/bids", {
      userId: 6, method: "POST",
      body: { projectId: pid, message: "Integrationstest — Garten-Job, Start morgen." },
    });
  } catch (e) {
    if (!e.message.includes("bereits beworben") && !e.message.includes("Geheimhaltung")) throw e;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

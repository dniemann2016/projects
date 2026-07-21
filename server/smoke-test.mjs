// Smoke-Test gegen den lokal laufenden Dev-Server (Port 8899, Demo-Daten).
// Legt einen Wegwerf-Testnutzer an und prüft Auth-, Spoofing- und Webhook-Schutz.
const BASE = "http://localhost:8899/api";

async function req(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${detail}`); }
}

const pw = `test-${Math.random().toString(36).slice(2)}A1!`;

const legal = await req("/legal");
check("Legal-Info", legal.status === 200 && legal.json.termsVersion, JSON.stringify(legal.json).slice(0, 80));

// 1. Registrierung mit Passwort + AGB-Zustimmung → Token
const reg = await req("/users", {
  method: "POST",
  body: { name: "SmokeBot", password: pw, termsAccepted: true, termsVersion: legal.json.termsVersion },
});
check("Registrierung mit Passwort + AGB", reg.status === 201 && reg.json.token, JSON.stringify(reg.json));
const uid = reg.json.id;
const token = reg.json.token;

// 2. Spoofing: x-user-id-Header darf bei Passwort-Konto NICHT reichen
const spoof = await req("/user", { headers: { "x-user-id": String(uid) } });
check("Header-Spoofing blockiert", spoof.status === 401, `status=${spoof.status}`);

// 3. Token-Zugriff funktioniert
const me = await req("/user", { headers: { Authorization: `Bearer ${token}` } });
check("Token-Login liefert Konto + Billing", me.status === 200 && me.json.hasPassword === true && me.json.billing, JSON.stringify(me.json).slice(0, 120));
check("AGB akzeptiert", me.status === 200 && me.json.needsTermsAcceptance === false && me.json.termsAcceptedAt, "");

// 3b. Registrierung ohne AGB abgelehnt
const regNoTerms = await req("/users", { method: "POST", body: { name: "NoTerms", password: pw } });
check("Registrierung ohne AGB → 400", regNoTerms.status === 400, `status=${regNoTerms.status}`);

// 4. Falsches Passwort abgelehnt (401) — oder schon vom Rate-Limit gestoppt (429)
const bad = await req("/users/login", { method: "POST", body: { userId: uid, password: "falschfalsch" } });
check("Falsches Passwort abgelehnt", bad.status === 401 || bad.status === 429, `status=${bad.status}`);

// 5. Broker-Liste
const brokers = await req("/brokers", { headers: { Authorization: `Bearer ${token}` } });
check("Broker-Katalog", brokers.status === 200 && brokers.json.length >= 5, `status=${brokers.status}`);

// 6. Broker-Offers Fallback ohne KI-Key (KI beim Testnutzer deaktiviert → 403 erwartet)
const offers = await req("/brokers/offers", { method: "POST", body: { monthly: 50 }, headers: { Authorization: `Bearer ${token}` } });
check("Offers ohne aiEnabled → 403", offers.status === 403, `status=${offers.status}`);

// 7. KI aktivieren, dann Offers: ohne Anthropic-Key → Fallback (200),
//    mit Key → Paywall für Free-Plan (402, Zero-Risk: keine KI ohne Bezahlung).
await req("/user/settings", { method: "PATCH", body: { aiEnabled: true }, headers: { Authorization: `Bearer ${token}` } });
const offers2 = await req("/brokers/offers", { method: "POST", body: { monthly: 50 }, headers: { Authorization: `Bearer ${token}` } });
const offersOk = (offers2.status === 200 && offers2.json.offers?.length >= 5) || offers2.status === 402;
check("Offers: Fallback oder Free-Paywall (Zero-Risk)", offersOk, `status=${offers2.status} ${JSON.stringify(offers2.json).slice(0, 100)}`);

// 8. Kündigungsschreiben hinter Paywall (Free → 402)
const letterFree = await req("/analyze/letter", { method: "POST", body: { merchantName: "Netflix" }, headers: { Authorization: `Bearer ${token}` } });
check("Kündigungsschreiben Free → 402", letterFree.status === 402, `status=${letterFree.status}`);

// 9. Webhook: aktiviert im Dev-Modus (ohne Secret) den Plan — in Produktion
//    nur mit gültiger Stripe-Signatur.
const hook = await req("/billing/webhook", { method: "POST", body: { type: "checkout.session.completed", data: { object: { metadata: { userId: uid, plan: "pro" } } } } });
check("Webhook-Route erreichbar", hook.status === 200 || hook.status === 400, `status=${hook.status}`);
if (hook.status === 200) {
  const letterPro = await req("/analyze/letter", { method: "POST", body: { merchantName: "Netflix" }, headers: { Authorization: `Bearer ${token}` } });
  check("Nach Plan-Aktivierung: Kündigungsschreiben frei", letterPro.status === 200 && letterPro.json.body?.includes("Netflix"), `status=${letterPro.status}`);
}

// 9. Admin-Route ohne Admin-Rechte blockiert
const adm = await req("/admin/overview", { headers: { Authorization: `Bearer ${token}` } });
check("Admin-Route für Nutzer blockiert", adm.status === 403, `status=${adm.status}`);

// 10. Affiliate-Link setzen ohne Admin blockiert
const aff = await req("/brokers/affiliate/ing", { method: "PUT", body: { url: "https://evil.example" }, headers: { Authorization: `Bearer ${token}` } });
check("Affiliate-Setzen ohne Admin blockiert", aff.status === 403, `status=${aff.status}`);

// 12. Analyse ohne Konto (öffentlicher Funnel): Top-2 sichtbar, Rest gesperrt
const statement = [
  "01.05.2026  NETFLIX INTERNATIONAL B.V.  -17,99",
  "02.05.2026  SPOTIFY AB  -10,99",
  "03.05.2026  ADOBE SYSTEMS  -59,99",
  "05.05.2026  McFIT GmbH  -29,90",
  "01.06.2026  NETFLIX INTERNATIONAL B.V.  -17,99",
  "02.06.2026  SPOTIFY AB  -10,99",
  "03.06.2026  ADOBE SYSTEMS  -59,99",
  "05.06.2026  McFIT GmbH  -29,90",
  "01.07.2026  NETFLIX INTERNATIONAL B.V.  -17,99",
  "02.07.2026  SPOTIFY AB  -10,99",
].join("\n");
const analysisRes = await fetch(`${BASE}/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: statement }),
});
const analysis = await analysisRes.json();
check("Öffentliche Analyse findet Abos", analysisRes.status === 200 && analysis.found >= 3, `found=${analysis.found}`);
check("Paywall: nur Top-2 sichtbar", analysis.items?.length === 2 && analysis.locked >= 1, `visible=${analysis.items?.length} locked=${analysis.locked}`);
check("Projektion (4/6/8%) vorhanden", Boolean(analysis.items?.[0]?.projection?.mid), JSON.stringify(analysis.items?.[0]?.projection || {}).slice(0, 80));

// 13. Kündigungsschreiben-Route existiert (Paywall bereits oben in Test 8 geprüft)
const letter = await req("/analyze/letter", { method: "POST", body: {}, headers: { Authorization: `Bearer ${token}` } });
check("Letter ohne Anbieter → 400/402", letter.status === 400 || letter.status === 402, `status=${letter.status}`);

// 14. Impact-Tab: Liste lesbar, Anlegen ohne Admin blockiert
const imp = await req("/impact", { headers: { Authorization: `Bearer ${token}` } });
check("Impact-Liste erreichbar", imp.status === 200 && Array.isArray(imp.json.projects), `status=${imp.status}`);
const impCreate = await req("/impact", { method: "POST", body: { title: "Test", url: "https://example.com" }, headers: { Authorization: `Bearer ${token}` } });
check("Impact-Anlegen ohne Admin blockiert", impCreate.status === 403, `status=${impCreate.status}`);

// 15. SEO-Kündigungsseiten
const seo = await fetch(`${BASE.replace("/api", "")}/kuendigen/netflix`);
check("SEO-Seite /kuendigen/netflix", seo.status === 200 && (await seo.text()).includes("Netflix"), `status=${seo.status}`);

// 11. Login-Rate-Limit (8/min): 10 schnelle Fehlversuche → 429 am Ende
let last = 0;
for (let i = 0; i < 10; i++) {
  const r = await req("/users/login", { method: "POST", body: { userId: uid, password: "brute-force-versuch" } });
  last = r.status;
}
check("Login-Brute-Force → 429", last === 429, `status=${last}`);

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);

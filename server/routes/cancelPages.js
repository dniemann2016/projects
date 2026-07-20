import { Router } from "express";
import { allMerchants } from "../lib/coach.js";

// SEO-Landingpages aus der Merchant_DB (Produktplan, Launch-Woche):
// „Netflix kündigen: Adresse, Frist, Vorlage" — eine Seite pro Anbieter,
// server-gerendert (Suchmaschinen brauchen kein JS), jede mündet in die Analyse.

const router = Router();

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page({ title, description, body, canonical }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1d1d1f;line-height:1.6}
  h1{font-size:32px;letter-spacing:-0.02em;margin:24px 0 8px}
  h2{font-size:20px;margin:28px 0 8px}
  .card{background:#f5f5f7;border-radius:16px;padding:18px 22px;margin:14px 0}
  .btn{display:inline-block;background:#0071e3;color:#fff;padding:12px 26px;border-radius:980px;text-decoration:none;font-weight:600;margin-top:8px}
  .muted{color:#6e6e73;font-size:14px}
  pre{white-space:pre-wrap;font-family:inherit;background:#fff;border-radius:12px;padding:16px;border:1px solid #e5e5ea;font-size:14px}
  a{color:#0071e3}
  ul{padding-left:22px}
</style>
</head>
<body>${body}
<footer class="muted" style="margin-top:40px;border-top:1px solid #e5e5ea;padding-top:16px">
AboWandler — findet vergessene Abos im Kontoauszug und zeigt, was daraus werden könnte.
Keine Rechts- oder Anlageberatung. Angaben ohne Gewähr.
</footer>
</body></html>`;
}

function letterTemplate(m) {
  return `An: ${m.cancelAddress || m.name}

Betreff: Kündigung meines Vertrags — Kundennummer [DEINE KUNDENNUMMER]

Sehr geehrte Damen und Herren,

hiermit kündige ich meinen Vertrag bei ${m.name} fristgerecht zum nächstmöglichen Zeitpunkt.
${m.noticePeriod ? `Laut Ihren Bedingungen gilt: ${m.noticePeriod}.` : ""}

Bitte bestätigen Sie mir den Erhalt dieser Kündigung sowie das Vertragsende schriftlich.
Einer Fortsetzung oder automatischen Verlängerung des Vertrags widerspreche ich ausdrücklich.

Mit freundlichen Grüßen
[DEIN NAME]
[DATUM]`;
}

/** Übersicht: alle Anbieter (dient auch als Sitemap für Crawler). */
router.get("/", (req, res) => {
  const merchants = allMerchants().filter((m) => m.kuendbar !== false);
  const list = merchants
    .map((m) => `<li><a href="/kuendigen/${esc(m.id)}">${esc(m.name)} kündigen</a></li>`)
    .join("\n");
  res.type("html").send(page({
    title: "Abo kündigen: Adressen, Fristen & Vorlagen für alle großen Anbieter",
    description: `Kündigungsadresse, Frist und fertige Kündigungsvorlage für ${merchants.length} Anbieter — Netflix, Spotify, Adobe, Fitnessstudios u.v.m.`,
    body: `<h1>Abo kündigen — alle Anbieter</h1>
<p>Kündigungsadresse, Frist und fertige Vorlage, kostenlos:</p>
<ul>${list}</ul>
<div class="card">
<strong>Wie viele vergessene Abos hast du?</strong><br>
Lade deinen Kontoauszug hoch — die Analyse findet jede wiederkehrende Zahlung und zeigt dir, was das Geld stattdessen werden könnte.
<br><a class="btn" href="/">Kostenlos analysieren →</a>
</div>`,
  }));
});

router.get("/sitemap.txt", (req, res) => {
  const base = process.env.PUBLIC_URL || "";
  const urls = allMerchants().filter((m) => m.kuendbar !== false).map((m) => `${base}/kuendigen/${m.id}`);
  res.type("text/plain").send([`${base}/kuendigen`, ...urls].join("\n"));
});

router.get("/:id", (req, res) => {
  const m = allMerchants().find((x) => x.id === req.params.id && x.kuendbar !== false);
  if (!m) return res.status(404).type("html").send(page({
    title: "Anbieter nicht gefunden",
    description: "Diesen Anbieter kennen wir (noch) nicht.",
    body: `<h1>Anbieter nicht gefunden</h1><p><a href="/kuendigen">Zur Übersicht aller Anbieter →</a></p>`,
  }));

  const body = `
<p class="muted"><a href="/kuendigen">← Alle Anbieter</a></p>
<h1>${esc(m.name)} kündigen: Adresse, Frist &amp; Vorlage</h1>
<p>Alles, was du für die Kündigung von ${esc(m.name)} brauchst — auf einen Blick.</p>

${m.cancelUrl ? `<div class="card"><h2 style="margin-top:0">⚡ Schnellster Weg: Online kündigen</h2>
<p>Seit 2022 muss jeder Anbieter in Deutschland einen Kündigungsbutton anbieten:</p>
<a class="btn" href="${esc(m.cancelUrl)}" rel="nofollow noopener">Direkt zur ${esc(m.name)}-Kündigungsseite →</a></div>` : ""}

<h2>📮 Kündigungsadresse</h2>
<div class="card">${esc(m.cancelAddress || "Siehe Impressum des Anbieters.")}</div>

<h2>⏰ Kündigungsfrist</h2>
<div class="card">${esc(m.noticePeriod || "Vertragsunterlagen prüfen — meist 1 Monat zum Laufzeitende.")}</div>

<h2>✉️ Fertige Kündigungsvorlage</h2>
<pre>${esc(letterTemplate(m))}</pre>

<div class="card">
<strong>Wusstest du?</strong> Die meisten Menschen zahlen für 2–3 vergessene Abos.
Lade deinen Kontoauszug hoch — unsere Analyse findet jede wiederkehrende Zahlung
und zeigt dir, was z.&nbsp;B. ${esc(m.name)}-Beiträge in 25 Jahren als Sparplan wert wären.
<br><a class="btn" href="/">Kostenlos analysieren →</a>
</div>`;

  res.type("html").send(page({
    title: `${m.name} kündigen 2026: Adresse, Frist & kostenlose Vorlage`,
    description: `${m.name} kündigen: Kündigungsadresse, Frist (${m.noticePeriod || "siehe Vertrag"}) und fertige Kündigungsvorlage zum Kopieren. Kostenlos.`,
    canonical: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/kuendigen/${m.id}` : undefined,
    body,
  }));
});

export default router;

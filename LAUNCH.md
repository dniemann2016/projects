# AboWandler — Veröffentlichung

**Positionierung (Produktplan):** „Finanzguru zeigt dir, was du verschwendest. Wir sorgen dafür, dass du es behältst. Gleiche Ausgabe, anderer Empfänger: dein Depot statt Adobe."

## 1. Stripe einrichten

1. [Stripe Dashboard](https://dashboard.stripe.com) → Produkte anlegen:
   - **Einmal-Analyse** — 9,99 € (one-time)
   - **Pro** — 4,99 €/Monat (recurring) + optional 39 €/Jahr (recurring, yearly)
2. Price IDs kopieren → `server/.env` (siehe `.env.example`): `STRIPE_PRICE_CHECK`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_YEAR`
3. Webhook: `POST https://DEINE-DOMAIN/api/billing/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`
   - `STRIPE_WEBHOOK_SECRET` in `.env` — **in Produktion Pflicht** (Signaturprüfung)
4. `PUBLIC_URL` auf deine Domain setzen (auch für Checkout-Redirects und SEO-Canonical)

## 2. KI-Wallet-Modell

| Plan | Preis | Enthalten | Wallet (prepaid) |
|------|-------|-----------|------------------|
| Gratis | 0 € | 1 Analyse, Top-2-Funde komplett, Summen-Teaser | — |
| Einmal-Analyse | 9,99 € einmalig | Volles Ergebnis + Kündigungsschreiben, 30 Tage | 3 € |
| Pro | 4,99 €/Mon. oder 39 €/Jahr | Unbegrenzte Analysen, Dashboard, Reports | 3 €/Monat |

**Zero-Risk:** Overage (0,05 €/Prompt) wird **vor** jeder KI-Aktion abgebucht. Keine Zahlung → keine KI.
**Kostenkontrolle:** Die Analyse selbst ist 3-schichtig — CSV/Regex-Parsing und Wiederkehrungs-Erkennung sind deterministisch (0 € KI-Kosten); das LLM sieht nur unbekannte Kandidaten, nie den ganzen Auszug (wenige Cent pro Analyse).

## 3. Rechtliches vor Go-Live

- **AGB-Zustimmung:** Jeder Nutzer muss beim Konto anlegen bzw. erneut nach AGB-Update zustimmen (Checkbox + Speicherung mit Version/Timestamp). Backend blockiert alle API-Routen ohne gültige Zustimmung.
- **Impressum:** `IMPRESSUM_NAME`, `IMPRESSUM_EMAIL`, `IMPRESSUM_ADDRESS` in `server/.env` — Standard: David Hammon, Parkstr. 7, 82194 Gröbenzell.
- **AGB & Datenschutz:** Muster in der App — **von Anwalt prüfen lassen** vor öffentlichem Launch.
- **Öffentliche Analyse:** Einwilligung in Datenverarbeitung + Verweis auf AGB/Haftungsausschluss (ohne Konto).

## 4. Starten

```bash
cd server && cp .env.example .env   # Keys eintragen
npm install && npm start

cd .. && npm install && npm run build
# oder start-mac.command
```

## 5. Passwort-Sicherheit

- Abo-Passwörter: AES-256-GCM (`server/lib/crypto.js`)
- Admin kann Passwörter **nicht einsehen**, nur ersetzen
- Nutzer sehen eigene Passwörter per 👁-Button

## 6. Kundenkonten & Login

- Registrierung direkt im Profil-Bildschirm: Name + optionales Passwort (min. 8 Zeichen)
- Passwörter als **scrypt-Hash** gespeichert, Login über Session-Token (30 Tage)
- Sobald ein Konto ein Passwort hat, ist Zugriff nur noch mit Token möglich (kein Header-Spoofing)
- Passwort setzen/ändern: Einstellungen → Konto-Sicherheit

## 7. Sicherheit (eingebaut)

- Stripe-Webhook: HMAC-SHA256-Signaturprüfung + 5-Min-Replay-Schutz (`STRIPE_WEBHOOK_SECRET` setzen — in Produktion Pflicht!)
- Rate-Limits: Login 8/Min, KI-Routen 15/Min, Checkout 10/Min, Broker-KI 5/Min
- Security-Header: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- Smoke-Test: `node server/smoke-test.mjs` (Server auf Port 8899 starten) — testet Spoofing, Brute-Force, Rollen-Checks

## 8. Broker-Affiliate (deine Provisionen 💰)

1. Bei Partnerprogrammen anmelden (Hinweise stehen im Admin-Bereich pro Broker):
   - Trade Republic (Impact.com), Scalable Capital (Awin), ING/comdirect/zero/Consorsbank (financeAds/Awin)
2. Admin → **Broker-Affiliate-Links** → deine Tracking-URL je Broker eintragen
3. Alle „Depot eröffnen“-Buttons (Depot-Tab, ETF-Flow) nutzen dann automatisch deinen Link
4. Werbekennzeichnung („Anzeige*“) wird automatisch eingeblendet — Pflicht nach §5a UWG
5. Die KI-Funktion „Aktuelle Broker-Angebote finden“ (Depot-Tab) recherchiert live Prämien und verlinkt über deine Affiliate-URLs (kostet den Nutzer Prompts → dein Zero-Risk-Modell)

## 9. Konto verbinden ohne Banking-Lizenz (Phase 1)

- CSV/Text-Import mit bebilderter 30-Sekunden-Anleitung je Bank (Sparkasse, ING, DKB, comdirect, PayPal, N26 …)
- Kündigungs-Direktlinks (Kündigungsbutton-Gesetz) bei jedem erkannten Abo: „Jetzt kündigen →“
- **Niemals Banking-Passwörter abfragen** — PSD2-Aggregator (GoCardless/FinAPI/Tink) erst ab ~500 Nutzern nachrüsten (API-Slots im Admin sind vorbereitet)

## 10. Der Kern-Funnel (Produktplan 3.1)

1. Landing → „Kostenlos analysieren" (ohne Registrierung!)
2. Upload (PDF/CSV/Text) mit Einwilligungs-Checkbox — Rohdaten werden nach der Analyse verworfen, nie gespeichert
3. Ergebnis: Kündigungs-Kandidat-Score + Projektion (4/6/8 % p.a.) pro Abo
4. Paywall: Top-2 komplett sichtbar, Rest verschwommen mit Summen-Teaser
5. Umwidmungs-Flow: Kündigen (Schreiben + Direktlink) → Umleiten (Broker-Vergleich mit deinen Affiliate-Links) → Verbuchen (Umwidmungs-Zähler)
6. Dashboard: „Vermögens-Kontoauszug" mit Zwei-Linien-Kurve

## 11. SEO & Launch-Woche (Produktplan Kap. 9)

- **62 SEO-Landingpages** laufen bereits: `/kuendigen` (Übersicht) und `/kuendigen/<anbieter>` — „Netflix kündigen: Adresse, Frist, Vorlage". Sitemap: `/kuendigen/sitemap.txt`
- Launch-Fahrplan: 10 Bekannte analysieren lassen → Reddit r/Finanzen Erfahrungsbericht → TikTok/Shorts („Dieses vergessene Abo kostet dich 49.700 € Rente")
- Admin → **Funnel & Kill-Kriterien**: Analysen, Zahler, Konversion — nach 30 Tagen < 3 % trotz 500+ Analysen → Paywall/Preis testen; nach 90 Tagen < 500 €/Monat → Wartungsmodus

## 12. Impact-Tab (Phase 3, vorbereitet)

- Tippgeber-Modell: kuratierte Startup-Projekte einer **lizenzierten** ECSP-Plattform (z. B. Companisto) verlinken — Admin trägt Projekte + Partner-Links im Impact-Tab ein
- Keine eigene ECSP-Zulassung nötig, solange du nur den Kontakt herstellst; Vertrag mit dem Partner vorher fixieren
- Werbekennzeichnung („Anzeige*") wird automatisch angezeigt

## 13. Rote Linien (immer beachten)

- **Keine Anlageberatung**: nie konkrete Produkte empfehlen — die Betragsgleichheit („72 € freigesetzt → Sparplan über 72 €") ist die einzige Personalisierung
- **Kein Geldfluss über dich**: Nutzer überweist selbst, richtet Sparplan selbst ein
- **Rohauszüge nie speichern**: analysieren, strukturierte Ergebnisse extrahieren, Original verwerfen (ist implementiert)
- Pflicht-Fußnote unter jeder Projektion (ist implementiert): „Modellrechnung … keine Garantie, keine Anlageberatung"

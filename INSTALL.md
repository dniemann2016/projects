# ExpertiseMarkt — Installation

## Option A: macOS-App (DMG)
1. `ExpertiseMarkt-0.1.0.dmg` öffnen
2. ExpertiseMarkt in den Programme-Ordner ziehen
3. App starten — Backend startet automatisch im Hintergrund

## Option B: Browser-Version (ohne Electron)
1. Node.js LTS installieren: https://nodejs.org
2. Ordner entpacken
3. Doppelklick auf **start-mac.command** (macOS)
   - oder: `npm install && cd server && npm install && cd .. && npm run build && ./start-mac.command`
4. Browser öffnet sich auf http://127.0.0.1:8787

## Erste Schritte
- Profil anlegen oder bestehendes wählen
- AGB akzeptieren
- Marktplatz: 3 Demo-Projekte sind vorbereitet
- Admin-Freigabe: Nutzer mit Rolle `admin` sieht Tab „Admin“

## Konfiguration (optional)
`server/.env` aus `server/.env.example` kopieren — Impressum, Stripe-Keys.

## Support
Håmmøn & Partner PartGmbH — David Hammon

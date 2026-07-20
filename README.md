# AboWandler

Finanz- & Abo-App im hellen, minimalistischen Design — regelt das Finanzielle im Alltag. **Standardmäßig ganz ohne KI**: Die Erkennung wiederkehrender Zahlungen läuft rein algorithmisch; KI-Funktionen sind pro Nutzer zuschaltbar.

- **Profile & Admin**: Mehrere Nutzerprofile auf einem Gerät (Netflix-Style-Auswahl beim Start). Das Admin-Konto sichtet und verwaltet Nutzer (Rollen, KI-Freischaltung, Löschen), stellt API-Schlüssel ein/um/ab (Anthropic für KI; FinAPI/Tink/GoCardless/PayPal-Slots für echte Bankanbindung) und sieht Systemzustand + Demo-Reset.
- **Konten & Umsätze**: Konten aus einem Katalog verbinden (Sparkasse, Volksbank, Deutsche Bank, Commerzbank, ING, DKB, N26, Revolut, PayPal, Klarna, Amex, Visa, Mastercard, Trade Republic u.v.m. — ohne Bank-API im Demo-Modus, Umsätze per Text/CSV-Import). Umsatzliste pro Konto oder gesamt.
- **Algorithmus-Scanner (ohne KI)**: erkennt wiederkehrende Zahlungen über wiederholte IBANs, Namen/Wörter, Betreffe, regelmäßige Intervalle (wöchentlich/monatlich/quartalsweise/jährlich) und konsistente Beträge; erkennt Preiserhöhungen und markiert Verdächtiges regelbasiert (unbekannter Anbieter + ausländische IBAN + generischer Name + neue Abbuchung).
- **Abos & Zahlungen verwalten**: Zahlungsplan (nächste Abbuchungen, Monats-/Jahressummen, Kategorien), Pausieren, Betrag/Kategorie/Abbuchungstag/Notizen, Zugangsdaten-Tresor (AES-256-verschlüsselt), CSV-Export.
- **KI zuschaltbar (Einstellungen → KI-Funktionen)**: recherchiert Firmen & IBANs auf Seriosität (Websuche), schreibt Kündigungsbriefe, klassifiziert Abos feiner — und der **KI-Anlage-Finder** analysiert Marktlage, Nachrichten, Zusammenschlüsse und Kausalketten und schlägt ETFs, Aktien, Anleihen, Rohstoffe oder fertige Mixe vor (vergangene, aktuelle und mögliche künftige Entwicklungen, als Einschätzung).
- **Investieren-Studio**: Anlage-Universum über alle Klassen mit Rechner, Vergleich und Renten-Lücken-Rechner.
- **Finanz-Radar**: Alltags-Taktiken zu Krediten & Zinsen, Währungen, Immobilienkauf, Steuern/Schenken/Erben, Versicherungen — plus optionale Live-KI-Recherche pro Thema.

**Alle Daten bleiben auf deinem Gerät** — es gibt keinen zentralen Cloud-Server. Dein PC ist der Host: er startet lokal einen kleinen Server (Frontend: Vanilla JS + Vite, Backend: Express) und ist damit auch von deinem Handy im selben WLAN aus erreichbar — wie eine eigene kleine Web-App, aber ohne Cloud. `HOST`/`PORT` sind bewusst als Umgebungsvariablen gehalten, falls du später auf einen echten Server/eine echte Domain umziehen willst (siehe unten).

---

## Genaue Anleitung: App starten

Voraussetzung für alle Wege: **Node.js** muss installiert sein (kostenlos, [nodejs.org](https://nodejs.org), LTS-Version reicht). Ohne Node.js läuft nichts von alldem — das ist die einzige Voraussetzung, es braucht keinen Account, keine Cloud, keine Installation von irgendwas anderem.

### Weg A — Doppelklick-Start (am einfachsten)

Im Hauptordner liegt ein Startprogramm für dein Betriebssystem:

- **Mac**: `start-mac.command` doppelklicken
- **Windows**: `start-windows.bat` doppelklicken
- **Linux**: `start-linux.sh` doppelklicken (oder `bash start-linux.sh`)

Beim ersten Start installiert es automatisch alles Nötige (kann ein paar Minuten dauern), danach öffnet sich AboWandler in deinem Standard-Browser unter `http://127.0.0.1:8787`. Bei jedem weiteren Start geht es sofort los.

> Mac: Falls eine Sicherheitswarnung erscheint ("nicht verifizierter Entwickler"), einmal rechtsklicken → Öffnen, statt doppelzuklicken.

### Weg B — Als natives Fenster (Electron)

```bash
npm install
cd server && npm install && cd ..
npm run electron
```

Öffnet AboWandler als eigenes Fenster statt im Browser. Der erste Aufruf lädt dabei zusätzlich Electron selbst herunter (separat von den normalen npm-Paketen, ca. 100+ MB) — das kann in Firmennetzwerken/hinter restriktiven Firewalls fehlschlagen. Falls `npm run electron` einen Download-/403-Fehler wirft, nutze stattdessen **Weg A**, der ganz ohne Electron auskommt.

Für eine installierbare Datei (`.dmg` / `.exe` / `.AppImage`):

```bash
npm run dist
```

Das Ergebnis liegt danach im Ordner `release/`. **Wichtig:** Baue für dein eigenes Betriebssystem — ein `.dmg` entsteht nur auf einem Mac, ein `.exe` nur unter Windows (bzw. mit passendem Cross-Build-Setup).

### Weg C — Als einzelne Programmdatei (kein Node.js nötig)

```bash
bash build-standalone.sh
```

Baut eine einzelne ausführbare Datei mit eingebauter Node.js-Laufzeit — der Zielrechner braucht danach weder Node.js noch npm. Muss auf dem Betriebssystem gebaut werden, für das sie laufen soll (kein Cross-Compiling): auf Linux gebaut → läuft auf Linux, auf einem Mac gebaut → läuft auf macOS, unter Windows (Git Bash/WSL) gebaut → läuft unter Windows. Ergebnis liegt in `standalone-dist/` (Programmdatei + `dist/` + `data/` — alle drei zusammen kopieren/weitergeben).

### Weg D — Für die Entwicklung (im Browser, mit Hot-Reload)

Zwei Terminals:

```bash
# Terminal 1 — Backend
cd server
npm install
npm run dev            # läuft auf http://127.0.0.1:8787

# Terminal 2 — Frontend
npm install
npm run dev            # läuft auf http://localhost:5173, proxyt /api an Port 8787
```

Dann `http://localhost:5173` im Browser öffnen.

### KI-Funktionen aktivieren

Egal welcher Weg: In der App unter **Konto → KI-Zugang** einmal deinen eigenen [Anthropic API-Key](https://console.anthropic.com/settings/keys) eintragen. Er wird lokal auf deinem Gerät gespeichert — nicht in der Cloud, nicht im Code. Ohne Key läuft die App trotzdem vollständig; KI-Funktionen (Kontoauszug-Analyse, Firmenbericht, Kündigungsbrief, KI-Auto-Check) nutzen dann einen eingebauten Basis-Check statt echter KI.

---

## Auch vom Handy nutzen (gleiches WLAN)

Beim Start (Weg A, B oder C) zeigt die Konsole zwei Adressen an:

```
AboWandler läuft auf http://127.0.0.1:8787
Im selben WLAN erreichbar (z.B. vom Handy) unter: http://192.168.1.23:8787
```

Die zweite Adresse auf dem iPhone/Android-Handy im selben WLAN öffnen (Safari/Chrome) — danach über "Zum Home-Bildschirm hinzufügen" wie eine echte App-Kachel ablegen. Es ist weiterhin dieselbe lokale App auf deinem PC, kein Cloud-Server; dein PC muss dafür nur an und im selben Netzwerk sein.

**Später auf einen echten Server/eine echte Domain umziehen:** `HOST` und `PORT` sind Umgebungsvariablen, keine feste Einstellung. Willst du AboWandler z. B. auf einem gemieteten Server oder mit eigener Domain betreiben, genügt es, den Server dort mit den gewünschten Werten zu starten (z. B. `HOST=0.0.0.0 PORT=443 node server/index.js` hinter einem Reverse Proxy) — am Code ändert sich nichts. Standardmäßig bindet die App bei jedem "vollständigen" Start (Weg A/B/C) auf `0.0.0.0` (alle Netzwerk-Schnittstellen); willst du sie stattdessen strikt auf dieses Gerät beschränken, `HOST=127.0.0.1` setzen, bevor du startest.

---

## Wo landen meine Daten?

| Modus | Speicherort |
|---|---|
| `npm run electron` / `npm run dist` | Betriebssystem-Datenordner der App (z. B. `~/Library/Application Support/AboWandler` auf Mac, `%APPDATA%\AboWandler` auf Windows, `~/.config/AboWandler` auf Linux) |
| `build-standalone.sh` (Weg C) | `~/.abowandler/` im Home-Verzeichnis |
| `npm run dev` (Browser) | `server/data/` im Projektordner |

In allen Fällen: nur auf deinem eigenen Rechner, nie auf einem fremden Server (außer du richtest das später selbst so ein, siehe oben). Passwörter sind zusätzlich AES-256-verschlüsselt.

## Build (nur Frontend, ohne Electron)

```bash
npm run build
```

## Architektur

- `src/` — Frontend (Landing, Dashboard, Abo-Liste, Konten & Import, ETF-Explorer, Einstellungen)
- `server/` — lokale Express-App: AI-Proxy (der Anthropic-Key verlässt nie den Browser/das Gerät des Nutzers), Abo-CRUD mit AES-256-verschlüsselter Passwortablage, ETF-Referenzdaten, Konten-Demo-Endpunkte. Läuft nur auf `127.0.0.1`, nicht im Netzwerk erreichbar.
- `electron/` — Desktop-Shell: startet die lokale Express-App als Kindprozess (mit Electrons eigenem Node — kein separates Node.js auf dem Zielrechner nötig) und öffnet ein natives Fenster darauf.

### KI-Auto-Check

Der Button „✦ KI-Auto-Check starten" (Übersicht) klassifiziert alle Abos auf einen Klick in Behalten / In ETF umwandeln / Warnung / Ausstehender Check — inkl. Begründung pro Abo:

- **Mit hinterlegtem API-Key**: echte Claude-Analyse (Betrugsmuster, Plausibilität, Preisentwicklung).
- **Ohne Key**: eingebauter Basis-Check (Regel-Engine: ausländische IBAN + unbekannte Firma, Preissprünge ≥ 25 %, nie überprüfte Alt-Verträge, Abgleich mit bekannter Anbieter-Liste) — klar als Basis-Check gekennzeichnet.

### ETF-Tausch pro Abo

Jede Abo-Karte hat einen „↗ ETF-Tausch"-Button: „Statt 19,99 € für Streaming → 19,99 €/Monat in MSCI World bzw. den rendite-stärksten ETF", mit 10/20/30-Jahres-Projektion und Renten-Boost nach 4%-Regel.

### Mobile / Cross-Platform

Das Frontend ist React — die portabelste Basis für den späteren Handy-Schritt (iOS + Android): als PWA installierbar (Manifest + Apple-Meta-Tags sind eingerichtet) oder per Capacitor/React Native in echte Store-Apps überführbar. Das Layout ist responsiv und auf Mobilgeräten getestet.

### Was echt ist, was Demo ist

- **Abo-Verwaltung, ETF-Rechner, KI-Auto-Check, KI-Analyse/-Berichte/-Kündigungsbriefe, Desktop-App**: voll funktionsfähig.
- **Konten verbinden (PayPal, Bank, Kreditkarte, Klarna)**: Demo-Toggle. Echte Anbindung erfordert registrierte Zugänge bei einem Kontoaggregator (z. B. Tink, GoCardless, FinAPI für PSD2-Bankdaten) bzw. bei PayPal Developer — dafür sind eigene API-Keys und ein OAuth-Flow nötig, die hier nicht hinterlegt sind. Der funktionierende Datenweg ist der Import: Kontoauszug einfügen oder als PDF/CSV hochladen.
- **Logos**: über die öffentliche Clearbit-Logo-API anhand der Firmen-Domain, mit Fallback auf einen farbigen Buchstaben-Avatar, falls kein Logo geladen werden kann (z. B. ohne Internetverbindung).

AboWandler ist keine Finanz-, Anlage- oder Rechtsberatung. Alle Prognosen sind unverbindliche Modellrechnungen.

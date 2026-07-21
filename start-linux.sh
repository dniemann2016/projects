#!/bin/bash
cd "$(dirname "$0")"

echo "AboWandler wird vorbereitet..."

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js wurde nicht gefunden."
  echo "Bitte installiere es (kostenlos) von https://nodejs.org (LTS-Version) und starte dieses Programm danach erneut."
  read -p "Drücke Enter zum Schließen..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installiere Frontend-Komponenten (einmalig, kann ein paar Minuten dauern)..."
  npm install
fi

if [ ! -d "server/node_modules" ]; then
  echo "Installiere Backend-Komponenten (einmalig)..."
  (cd server && npm install)
fi

if [ ! -d "dist" ]; then
  echo "Baue die App (einmalig)..."
  npm run build
fi

export ABOWANDLER_STATIC_DIR="$(pwd)/dist"
export PORT="${PORT:-8787}"
# HOST is intentionally not forced here — the server defaults to 0.0.0.0
# (reachable from your phone on the same WiFi) unless you export HOST
# yourself before running this script, e.g. to point it at a real
# server/host later or lock it back to 127.0.0.1-only.

echo "Starte AboWandler..."
(cd server && node index.js) &
SERVER_PID=$!

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:$PORT"
else
  echo "Öffne http://127.0.0.1:$PORT in deinem Browser."
fi

echo ""
echo "AboWandler läuft jetzt in deinem Browser."
echo "Auf dem Handy (im selben WLAN) siehst du oben die Netzwerk-Adresse zum Öffnen."
echo "Dieses Fenster offen lassen, solange du die App nutzt."
echo "Zum Beenden: dieses Fenster schließen oder Strg+C drücken."
echo ""
wait $SERVER_PID

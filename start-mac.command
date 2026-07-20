#!/bin/bash
cd "$(dirname "$0")"

echo "ExpertiseMarkt wird vorbereitet..."

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

echo "Starte ExpertiseMarkt..."
(cd server && node index.js) &
SERVER_PID=$!

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

open "http://127.0.0.1:$PORT"

echo ""
echo "ExpertiseMarkt läuft jetzt in deinem Browser."
echo "Dieses Fenster offen lassen, solange du die App nutzt."
echo "Zum Beenden: dieses Fenster schließen oder Strg+C drücken."
echo ""
wait $SERVER_PID

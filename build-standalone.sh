#!/bin/bash
# Builds a single-file AboWandler executable with Node.js embedded —
# the target machine needs no Node.js/npm install at all.
# Must be run on the OS you're building FOR (no cross-compilation):
# run this on Linux for a Linux binary, on macOS for a macOS binary,
# on Windows (Git Bash/WSL) for a Windows .exe.
set -euo pipefail
cd "$(dirname "$0")"

OUT_DIR="standalone-dist"
BIN_NAME="AboWandler"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) BIN_NAME="AboWandler.exe" ;;
esac

echo "1/6 Frontend bauen..."
npm install
npm run build

echo "2/6 Backend-Abhängigkeiten (esbuild, postject)..."
(cd server && npm install)

echo "3/6 Backend zu einer Datei bündeln..."
mkdir -p "$OUT_DIR"
npx --prefix server esbuild server/standalone.js --bundle --platform=node --format=cjs \
  --outfile="$OUT_DIR/server-bundle.cjs" --external:node:*

echo "4/6 Single-Executable-Blob erzeugen..."
cat > "$OUT_DIR/sea-config.json" <<EOF
{
  "main": "server-bundle.cjs",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
EOF
(cd "$OUT_DIR" && node --experimental-sea-config sea-config.json)

echo "5/6 Node-Laufzeit in die Programmdatei einbetten..."
NODE_BIN=$(command -v node)
cp "$NODE_BIN" "$OUT_DIR/$BIN_NAME"
npx --prefix server postject "$OUT_DIR/$BIN_NAME" NODE_SEA_BLOB "$OUT_DIR/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  $( [ "$(uname -s)" = "Darwin" ] && echo "--macho-segment-name NODE_SEA" )
chmod +x "$OUT_DIR/$BIN_NAME" 2>/dev/null || true

if [ "$(uname -s)" = "Darwin" ]; then
  codesign --sign - "$OUT_DIR/$BIN_NAME" 2>/dev/null || true
fi

echo "6/6 Frontend + Referenzdaten daneben ablegen..."
rm -rf "$OUT_DIR/dist"
cp -r dist "$OUT_DIR/dist"
mkdir -p "$OUT_DIR/data"
# Alle Referenzdaten (Seed, ETF-/Invest-Universum, Finanz-Radar-Tipps) —
# aber niemals Laufzeitdaten wie db.json oder Schlüssel.
cp server/data/db.seed.json server/data/etfs.json server/data/invest.json server/data/tips.json server/data/providers.json "$OUT_DIR/data/"
rm -f "$OUT_DIR/server-bundle.cjs" "$OUT_DIR/sea-prep.blob" "$OUT_DIR/sea-config.json"

echo ""
echo "Fertig: $OUT_DIR/$BIN_NAME"
echo "Der Ordner \"$OUT_DIR\" (Programmdatei + dist/ + data/) ist eigenständig lauffähig — kein Node.js/npm auf dem Zielrechner nötig."

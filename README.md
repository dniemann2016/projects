# Projects — komplette App

Marketplace-App (Projekte, Teams, Escrow, Chat, Admin, …).

## Für Base44 / Claude
Dieser Stand ist der **vollständige Quellcode** der App (Frontend + Backend + Electron-Quellen + Tests/Scripts).

## Start lokal
```bash
cd server && npm install
cd .. && npm install && npm run build
ABOWANDLER_STATIC_DIR=dist PORT=8787 node server/index.js
```
Dann: http://127.0.0.1:8787

Demo: `maria_dev` / `Demo2026!`  
Admin: `davidhammon` / `Orion447!`

## Struktur
- `src/` — Frontend (Marketplace in `src/em/`)
- `server/` — Express-API
- `electron/` — Desktop-Shell
- `dist/` — gebautes Frontend (falls vorhanden)
- `scripts/` — Tests

Nicht im Repo (absichtlich): `node_modules/`, `release/`, Secrets (`.env`, Encryption-Key).

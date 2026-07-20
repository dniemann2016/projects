import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, BUNDLED_DATA_DIR } from "./paths.js";

// db.json is user data — lives in DATA_DIR (the OS app-data folder when
// running as the desktop app). db.seed.json is the shipped starter
// dataset and always stays with the app's own files.
const DB_FILE = path.join(DATA_DIR, "db.json");
const SEED_FILE = path.join(BUNDLED_DATA_DIR, "db.seed.json");

function load() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = fs.existsSync(SEED_FILE) ? fs.readFileSync(SEED_FILE, "utf8") : "{}";
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, seed, "utf8");
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return migrate(db);
}

// Upgrades databases written by older app versions (single-profile era)
// to the multi-user layout: adds users/transactions collections and stamps
// existing rows with userId 1 so nothing the user saved gets lost.
function migrate(db) {
  if (db.users?.length) {
    db.users = db.users.map((u) => ({
      ...u,
      billing: u.billing || {
        plan: "free",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        walletBalanceEUR: 0,
        walletGrantedEUR: 0,
        walletPeriodStart: new Date().toISOString().slice(0, 10),
        oneTimeExpires: null,
        allowOverage: true,
        promptLog: [],
      },
      // Demo-Profile ohne AGB-Stamp erhalten beim ersten Start automatisch Zustimmung
      termsAcceptedAt: u.termsAcceptedAt || new Date().toISOString(),
      termsVersion: u.termsVersion || "2026-07-10-em",
    }));
    db.holdings = db.holdings || [];
    return db;
  }
  const seed = fs.existsSync(SEED_FILE) ? JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) : {};
  db.users = seed.users || [
    { id: 1, name: db.user?.name || "Admin", role: "admin", createdAt: new Date().toISOString().slice(0, 10), emails: db.user?.emails || [""], settings: { aiEnabled: false } },
  ];
  if (db.user?.name) db.users[0].name = db.user.name;
  if (db.user?.emails?.some(Boolean)) db.users[0].emails = db.user.emails;
  delete db.user;
  db.transactions = db.transactions || seed.transactions || [];
  db.accounts = (db.accounts || []).map((a) => ({ userId: 1, provider: a.provider || a.id, ...a }));
  db.subscriptions = (db.subscriptions || []).map((s) => ({ userId: 1, ...s }));
  save(db);
  return db;
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// Minimal file-backed JSON store. Fine for a single-user demo app;
// swap for a real database before handling concurrent users.
export const store = {
  read() {
    return load();
  },
  write(db) {
    save(db);
  },
  collection(name) {
    const db = load();
    if (!db[name]) db[name] = [];
    return db[name];
  },
  setCollection(name, items) {
    const db = load();
    db[name] = items;
    save(db);
  },
};

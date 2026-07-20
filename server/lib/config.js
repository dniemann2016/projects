import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.js";

const CONFIG_FILE = path.join(DATA_DIR, "config.json");

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

// The API key is entered once in the app's Settings and saved on-device —
// no .env file needed for the desktop app. ANTHROPIC_API_KEY in the
// environment still works as a fallback (useful for local `npm run dev`).
export function getApiKey() {
  return readConfig().anthropicApiKey || process.env.ANTHROPIC_API_KEY || "";
}

export function setApiKey(key) {
  const cfg = readConfig();
  if (key) cfg.anthropicApiKey = key;
  else delete cfg.anthropicApiKey;
  writeConfig(cfg);
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

// Named third-party API slots managed from the admin area. "anthropic" is
// live (powers the KI features); the bank aggregator slots are stored for
// the future real-PSD2 connection and surfaced in the admin UI.
export const API_SLOTS = [
  { name: "anthropic", label: "Anthropic (KI-Analysen)", live: true },
  { name: "finapi", label: "FinAPI (Bank-Aggregator, PSD2)", live: false },
  { name: "tink", label: "Tink (Bank-Aggregator, PSD2)", live: false },
  { name: "gocardless", label: "GoCardless Bank Account Data", live: false },
  { name: "paypal", label: "PayPal Developer (echte PayPal-Anbindung)", live: false },
];

function mask(key) {
  if (!key) return null;
  return key.length <= 10 ? "••••" : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function listApis() {
  const cfg = readConfig();
  return API_SLOTS.map((slot) => {
    const value = slot.name === "anthropic" ? getApiKey() : cfg.apis?.[slot.name] || "";
    return { ...slot, configured: Boolean(value), masked: mask(value) };
  });
}

export function setNamedApi(name, key) {
  if (name === "anthropic") return setApiKey(key);
  const cfg = readConfig();
  cfg.apis = cfg.apis || {};
  if (key) cfg.apis[name] = key;
  else delete cfg.apis[name];
  writeConfig(cfg);
}

// Freely-named API keys for any provider (Grok, DeepSeek, Base44, ...),
// added ad-hoc from the admin area — unlike API_SLOTS this isn't a fixed
// list. Stored as a secure credential store; nothing in the app calls
// these out automatically yet, but the key is captured and ready for
// whichever provider gets wired in next.
export function listCustomApis() {
  const cfg = readConfig();
  return Object.entries(cfg.customApis || {}).map(([id, v]) => ({
    id, label: v.label || id, baseUrl: v.baseUrl || null, masked: mask(v.key),
  }));
}

export function setCustomApi(id, { label, key, baseUrl }) {
  const cfg = readConfig();
  cfg.customApis = cfg.customApis || {};
  cfg.customApis[id] = { label: label || id, key, baseUrl: baseUrl || null };
  writeConfig(cfg);
}

export function deleteCustomApi(id) {
  const cfg = readConfig();
  if (cfg.customApis) delete cfg.customApis[id];
  writeConfig(cfg);
}

export function getCustomApiKey(id) {
  return readConfig().customApis?.[id]?.key || "";
}

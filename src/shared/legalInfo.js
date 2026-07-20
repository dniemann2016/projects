import { api } from "./api.js";

let cache = null;

export async function loadLegalInfo() {
  if (cache) return cache;
  cache = await api.legal.info();
  return cache;
}

export function getLegalInfoSync() {
  return cache;
}

export function clearLegalInfoCache() {
  cache = null;
}

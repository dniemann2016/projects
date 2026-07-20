// Einfaches In-Memory-Rate-Limit pro IP — schützt Login und KI-Routen
// gegen Brute-Force und Kosten-Abuse. Für Cluster-Setups Redis nutzen.
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 30, message = "Zu viele Anfragen — bitte kurz warten." } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = buckets.get(key) || [];
    const recent = entry.filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: message });
    }
    recent.push(now);
    buckets.set(key, recent);
    if (buckets.size > 10_000) buckets.clear();
    next();
  };
}

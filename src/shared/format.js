export const fmt = (n) => (n ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export const monthsSince = (ym) => {
  if (!ym) return 0;
  const [y, m] = ym.split("-").map(Number);
  const now = new Date();
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
};

export const yearsLabel = (ym) => {
  const m = monthsSince(ym);
  const y = Math.floor(m / 12);
  return y >= 1 ? `${y} Jahr${y > 1 ? "e" : ""}` : `${m} Monate`;
};

// Zinseszins: monatliche Sparrate
export const futureValue = (monthly, annualPct, years) => {
  const r = annualPct / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
};

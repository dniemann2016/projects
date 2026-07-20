// Light, minimal design system: white page, soft gray tiles, dark ink text,
// one blue accent, pill-shaped controls, large tight-tracked headlines.
export const T = {
  bg: "#ffffff",
  bgAlt: "#f5f5f7",
  bgCard: "#f5f5f7",
  bgCardHover: "#ececee",
  border: "rgba(0,0,0,0.10)",
  text: "#1d1d1f",
  textDim: "#6e6e73",
  textFaint: "#86868b",
  green: "#1d9a46",
  teal: "#0071e3",
  purple: "#8944ab",
  orange: "#b25a00",
  red: "#d70015",
  blue: "#0071e3",
};

export const statusCfg = {
  pending: { label: "Ausstehender Check", color: T.orange, icon: "◷" },
  warning: { label: "Warnung / Risiko", color: T.red, icon: "⚠" },
  keep: { label: "Behalten", color: T.blue, icon: "✓" },
  switch: { label: "In Sparplan umwandeln", color: T.green, icon: "↗" },
};

export const S = {
  page: { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", position: "relative", overflowX: "hidden" },
  container: { maxWidth: 1024, margin: "0 auto", padding: "0 22px", position: "relative", zIndex: 1 },
  card: { class: "aw-card" },
  btn: { class: "aw-btn aw-btn-primary" },
  btnGhost: { class: "aw-btn aw-btn-ghost" },
  input: { class: "aw-input" },
  tag: (c) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: `${c}14`, color: c, borderRadius: 980, padding: "5px 12px", fontSize: 12.5, fontWeight: 600 }),
};

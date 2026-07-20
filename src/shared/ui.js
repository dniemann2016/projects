import { h } from "./dom.js";

let toastHost = null;

function ensureToastHost() {
  if (!toastHost) {
    toastHost = h("div", { class: "aw-toast-host" });
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

/** Kurzes Feedback unten — besser als alert() oder versteckte Inline-Messages. */
export function toast(message, { type = "info", ms = 3200 } = {}) {
  const host = ensureToastHost();
  const el = h("div", { class: `aw-toast${type === "ok" ? " ok" : type === "err" ? " err" : ""}` }, message);
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.25s";
    setTimeout(() => el.remove(), 280);
  }, ms);
}

export function loadingView(label = "Lädt…") {
  return h("div", { class: "aw-loading" },
    h("div", { class: "aw-spinner" }),
    h("div", {}, label)
  );
}

export function pageHeader(title, subtitle) {
  return h("div", { class: "aw-page-header" },
    h("h1", {}, title),
    subtitle ? h("p", {}, subtitle) : null
  );
}

/** Navigation: 4 Haupt-Tabs + „Mehr"-Menü — weniger Überladung auf kleinen Screens. */
export const NAV_PRIMARY = [
  { id: "dashboard", label: "Start", icon: "🏠" },
  { id: "analyse", label: "Analyse", icon: "📊" },
  { id: "abos", label: "Abos", icon: "📋" },
  { id: "depot", label: "Depot", icon: "💼" },
];

export const NAV_MORE = [
  { id: "konten", label: "Konten & Import", icon: "🏦" },
  { id: "etf", label: "Investieren", icon: "📈" },
  { id: "impact", label: "Impact", icon: "🌱" },
  { id: "radar", label: "Finanz-Radar", icon: "📡" },
  { id: "settings", label: "Einstellungen", icon: "⚙️" },
  { id: "admin", label: "Admin", icon: "🔧", adminOnly: true },
];

export function tabLabel(id) {
  return [...NAV_PRIMARY, ...NAV_MORE].find((t) => t.id === id)?.label || id;
}

/** Pflicht-Zustimmung AGB + Haftungsausschluss (Login, Registrierung, Terms-Gate). */
export function termsAcceptanceUI({ legal, checkboxId = "aw-terms", checked = false, onChange, onLegal }) {
  const liability = legal?.liabilityShort || "Keine Finanz-, Anlage-, Rechts- oder Steuerberatung.";
  const open = (doc) => (ev) => { ev.preventDefault(); onLegal?.(doc); };
  return h("div", { class: "aw-terms-box" },
    h("label", { class: "aw-terms-label", for: checkboxId },
      h("input", {
        type: "checkbox",
        id: checkboxId,
        checked,
        onChange: (ev) => onChange?.(ev.target.checked),
      }),
      h("span", {},
        "Ich habe die ",
        h("button", { type: "button", class: "aw-terms-link", onClick: open("agb") }, "AGB"),
        " (inkl. Haftungsausschluss) und die ",
        h("button", { type: "button", class: "aw-terms-link", onClick: open("datenschutz") }, "Datenschutzerklärung"),
        " gelesen und akzeptiere sie. Ich nehme zur Kenntnis, dass AboWandler ",
        h("strong", {}, "keine Finanz-, Anlage-, Rechts- oder Steuerberatung"),
        " ist und ich die Nutzung auf eigenes Risiko erfolgt."
      )
    ),
    h("p", { class: "aw-terms-hint" }, liability)
  );
}

export function legalFooterBar({ onLegal, compact = false }) {
  if (!onLegal) return null;
  const link = (doc, label) =>
    h("button", { type: "button", class: "aw-legal-link", onClick: () => onLegal(doc) }, label);
  return h("footer", { class: compact ? "aw-legal-footer aw-legal-footer-compact" : "aw-legal-footer" },
    link("agb", "AGB"),
    link("datenschutz", "Datenschutz"),
    link("impressum", "Impressum"),
    h("span", { class: "aw-legal-note" }, "Keine Anlageberatung · Modellrechnungen ohne Gewähr")
  );
}

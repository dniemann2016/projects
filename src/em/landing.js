import { h } from "../shared/dom.js";
import { mountHeroCanvas, initScrollReveal } from "./heroCanvas.js";
import { appleBtn, appleLink, appleTrustRow, appleTwoPaths } from "./components.js";
import { VERSPRECHEN } from "./nav.js";

function bindHeroCanvas(getCleanup, setCleanup, opts) {
  return (canvas) => {
    getCleanup()?.destroy?.();
    setCleanup(canvas ? mountHeroCanvas(canvas, opts) : null);
  };
}

export function emLandingPage({ onStart, onBrowse, onLegal, onPath }) {
  let cleanupMain = null;
  let cleanupStrip = null;

  const page = h("div", { class: "em-page" },
    h("nav", { class: "em-nav is-dark", id: "em-landing-nav" },
      h("div", { class: "em-nav-inner" },
        h("button", { class: "em-brand", type: "button" }, "Projects"),
        h("div", { class: "em-nav-links" },
          h("button", { class: "em-nav-link", type: "button", onClick: () => onBrowse?.() }, "Entdecken"),
          h("button", { class: "em-nav-link", type: "button", onClick: () => onPath?.("guide") }, "Anleitung"),
          h("button", { class: "em-btn em-btn-primary", type: "button", style: { padding: "6px 16px", fontSize: 14 }, onClick: () => onStart?.() }, "Anmelden")
        )
      )
    ),

    h("section", { class: "em-hero" },
      h("canvas", {
        class: "em-hero-canvas",
        ref: bindHeroCanvas(() => cleanupMain, (c) => { cleanupMain = c; }),
      }),
      h("div", { class: "em-hero-overlay" }),
      h("div", { class: "em-hero-content" },
        h("div", { class: "em-hero-layout" },
          h("div", { class: "em-hero-badge" },
            h("span", { class: "em-hero-badge-dot" }),
            "Ingenieurs-Know-how · mit Treuhandschutz"
          ),
          h("h1", {}, "Arbeit findet dich."),
          h("p", {}, "Vom Handgriff bis zur Geschäftsführung auf Zeit. Projekte von 30 € bis 300.000 €. Einzeln oder als Team."),
          appleTwoPaths({
            onHire: () => onPath?.("hire") ?? onStart?.(),
            onOffer: () => onPath?.("offer") ?? onBrowse?.(),
          }),
          h("div", { class: "em-hero-cta", style: { marginTop: 28 } },
            appleLink("Ohne Konto stöbern", () => onBrowse?.())
          )
        )
      )
    ),

    h("section", { class: "em-hero-strip" },
      h("canvas", {
        class: "em-hero-strip-canvas",
        ref: bindHeroCanvas(() => cleanupStrip, (c) => { cleanupStrip = c; }, { strip: true }),
      }),
      h("div", { class: "em-hero-strip-overlay" }),
      h("div", { class: "em-hero-strip-content em-reveal" },
        h("h2", {}, "Engineering trifft Marktplatz."),
        h("p", {}, "Rotierende Turbinen, Team-Know-how, Meilensteine mit Treuhand — live visualisiert."),
        h("div", { class: "em-hero-strip-tags" },
          h("span", { class: "em-tag em-tag-green" }, "3D-Wireframes"),
          h("span", { class: "em-tag" }, "Meilensteine"),
          h("span", { class: "em-tag" }, "Team-Besetzung")
        )
      )
    ),

    h("section", { class: "em-section", style: { background: "var(--apple-bg-alt)", maxWidth: "none", padding: "80px 22px" } },
      h("div", { style: { maxWidth: "var(--apple-max)", margin: "0 auto" } },
        appleTrustRow(
          VERSPRECHEN.map((v, i) => ({ num: String(i + 1).padStart(2, "0"), title: v.title, text: v.text, tab: v.tab })),
          {
            onItemClick: (item) => {
              if (item.tab === "teams") onPath?.("offer") ?? onBrowse?.();
              else onPath?.("guide") ?? onBrowse?.();
            },
          }
        )
      )
    ),

    h("section", { class: "em-section" },
      h("div", { class: "em-reveal", style: { textAlign: "center", marginBottom: 48 } },
        h("h2", {}, "So funktioniert's."),
        h("p", { style: { margin: "12px auto 0" } }, "Drei Schritte vom Auftrag zur Zusammenarbeit — ohne Arbeitsvertrag.")
      ),
      h("div", { class: "em-features" },
        ...[
          { step: "1", title: "Projekt einstellen", text: "Titel, Budget, Ort, NDA-Stufe — geführt in drei Schritten." },
          { step: "2", title: "Bewerbungen vergleichen", text: "Kurzbewerbung, Bewertung, Passung — kein Preiswettlauf nach unten." },
          { step: "3", title: "Sicher zusammenarbeiten", text: "Treuhand, Meilensteine, Chat — Geld erst bei Abnahme." },
        ].map((f, i) =>
          h("div", { class: "em-feature-card em-reveal", "data-delay": String(i * 100) },
            h("div", { class: "em-feature-icon", style: { fontSize: 56, fontWeight: 600, color: "var(--apple-blue)" } }, f.step),
            h("h3", {}, f.title),
            h("p", {}, f.text)
          )
        )
      )
    ),

    h("section", { class: "em-section-dark" },
      h("div", { class: "em-section-inner em-reveal", style: { textAlign: "center" } },
        h("h2", {}, "Bereit loszulegen?"),
        h("p", { style: { color: "rgba(255,255,255,0.65)", margin: "12px auto 32px" } }, "Registrierung erst bei der ersten Handlung — nicht vorher."),
        h("div", { class: "em-hero-cta" },
          appleBtn("Kostenlos starten", { onClick: () => onStart?.() }),
          h("button", { class: "em-btn em-btn-ghost", type: "button", style: { color: "#2997ff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" }, onClick: () => onBrowse?.() }, "Marktplatz öffnen")
        )
      )
    ),

    h("footer", { style: { padding: "20px 22px 48px", background: "var(--apple-bg-alt)", fontSize: 12, color: "var(--apple-text-secondary)" } },
      h("div", { style: { maxWidth: "var(--apple-max)", margin: "0 auto", textAlign: "center" } },
        h("div", { style: { display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 } },
          h("button", { type: "button", class: "em-nav-link", style: { color: "var(--apple-text-secondary)", fontSize: 12 }, onClick: () => onLegal?.("agb") }, "AGB"),
          h("button", { type: "button", class: "em-nav-link", style: { color: "var(--apple-text-secondary)", fontSize: 12 }, onClick: () => onLegal?.("haftung") }, "Haftung"),
          h("button", { type: "button", class: "em-nav-link", style: { color: "var(--apple-text-secondary)", fontSize: 12 }, onClick: () => onLegal?.("datenschutz") }, "Datenschutz"),
          h("button", { type: "button", class: "em-nav-link", style: { color: "var(--apple-text-secondary)", fontSize: 12 }, onClick: () => onLegal?.("impressum") }, "Impressum")
        ),
        "Copyright © 2026 Projects. Arbeit fair vergeben und leisten."
      )
    )
  );

  requestAnimationFrame(() => {
    initScrollReveal(page);
    cleanupMain?.refresh?.();
    cleanupStrip?.refresh?.();
    const nav = page.querySelector("#em-landing-nav");
    const onScroll = () => {
      if (!nav) return;
      nav.classList.toggle("is-dark", window.scrollY < window.innerHeight * 0.5);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    page._scrollNav = onScroll;
  });

  page.destroy = () => {
    cleanupMain?.destroy?.();
    cleanupStrip?.destroy?.();
    cleanupMain = null;
    cleanupStrip = null;
    if (page._scrollNav) window.removeEventListener("scroll", page._scrollNav);
  };

  return page;
}

import { h } from "../shared/dom.js";

/** Apple.com / Apple Store UI-Bausteine */

export function appleLink(label, onClick) {
  return h("button", { type: "button", class: "apple-link", onClick }, label, " ›");
}

export function appleBtn(label, { variant = "primary", onClick, className = "", disabled = false } = {}) {
  return h("button", {
    type: "button",
    class: `apple-btn apple-btn-${variant} ${className}`.trim(),
    onClick,
    disabled,
  }, label);
}

export function appleSectionHeadline(title, subtitle, { linkLabel, onLink } = {}) {
  return h("div", { class: "apple-section-head" },
    h("div", {},
      h("h2", { class: "apple-section-title" }, title),
      subtitle ? h("p", { class: "apple-section-sub" }, subtitle) : null
    ),
    linkLabel ? appleLink(linkLabel, onLink) : null
  );
}

export function appleProductTile({ eyebrow, title, subtitle, price, meta, tags = [], onClick, variant = "light", cta = "Mehr erfahren" }) {
  return h("article", { class: `apple-tile apple-tile-${variant}`, onClick },
    eyebrow ? h("p", { class: "apple-tile-eyebrow" }, eyebrow) : null,
    price ? h("p", { class: "apple-tile-price" }, price) : null,
    h("h3", { class: "apple-tile-title" }, title),
    subtitle ? h("p", { class: "apple-tile-sub" }, subtitle) : null,
    meta ? h("p", { class: "apple-tile-meta" }, meta) : null,
    tags.length ? h("div", { class: "apple-pills" },
      ...tags.map((t) => h("span", { class: `apple-pill ${t.accent ? "apple-pill-accent" : ""}` }, t.label))
    ) : null,
    onClick ? h("span", { class: "apple-tile-cta" }, `${cta} ›`) : null
  );
}

export function applePersonTile({ name, headline, badge, rating, onClick, meta }) {
  return h("article", { class: "apple-person-tile", onClick },
    h("div", { class: "apple-person-ring" }, (name || "?")[0]),
    h("h3", { class: "apple-person-name" }, name),
    h("p", { class: "apple-person-role" }, headline),
    meta ? h("p", { class: "apple-person-role", style: { marginTop: 4 } }, meta) : null,
    h("div", { class: "apple-pills" },
      badge ? h("span", { class: "apple-pill" }, badge) : null,
      rating ? h("span", { class: "apple-pill apple-pill-accent" }, `★ ${rating}`) : null
    )
  );
}

export function applePageHero(title, subtitle, actions = []) {
  return h("header", { class: "apple-page-hero" },
    h("h1", { class: "apple-page-title" }, title),
    subtitle ? h("p", { class: "apple-page-sub" }, subtitle) : null,
    actions.length ? h("div", { class: "apple-page-actions" }, ...actions) : null
  );
}

export function appleSpecRow(label, value) {
  return h("div", { class: "apple-spec-row" },
    h("span", { class: "apple-spec-label" }, label),
    h("span", { class: "apple-spec-value" }, value)
  );
}

export function appleSpecSheet(rows) {
  return h("div", { class: "apple-spec-sheet" }, ...rows.map(([l, v]) => appleSpecRow(l, v)));
}

export function appleFilterPills(items, active, onSelect) {
  return h("div", { class: "apple-filter-bar" },
    ...items.map((item) =>
      h("button", {
        type: "button",
        class: `apple-filter-pill${active === item.id ? " is-on" : ""}`,
        onClick: () => onSelect(item.id),
      }, item.label)
    )
  );
}

/** Kompakte Dropdown-Filter statt endloser Pill-Reihen. */
export function appleFilterSelect(label, items, value, onChange) {
  const sel = h("select", { class: "em-filter-select" });
  for (const item of items) {
    sel.appendChild(h("option", { value: String(item.id) }, item.label));
  }
  sel.value = value ?? "";
  sel.addEventListener("change", () => onChange(sel.value));
  return h("label", { class: "em-filter-field" },
    h("span", { class: "em-filter-label" }, label),
    sel
  );
}

export function appleFilterGrid(children) {
  return h("div", { class: "em-filter-grid" }, ...children);
}

export function appleTrustRow(items, { onItemClick } = {}) {
  return h("div", { class: "apple-trust-row" },
    ...items.map((item) =>
      h("button", {
        type: "button",
        class: `apple-trust-item${onItemClick ? " is-clickable" : ""}`,
        onClick: onItemClick ? () => onItemClick(item) : undefined,
      },
        h("div", { class: "apple-trust-num" }, item.num),
        h("h3", {}, item.title),
        h("p", {}, item.text),
        onItemClick ? h("span", { class: "apple-trust-more" }, "Mehr erfahren ›") : null
      )
    )
  );
}

export function appleTwoPaths({ onHire, onOffer }) {
  return h("div", { class: "apple-two-paths" },
    h("button", { type: "button", class: "apple-path-card apple-path-primary", onClick: onHire },
      h("span", { class: "apple-path-label" }, "Ich vergebe Arbeit"),
      h("span", { class: "apple-path-arrow" }, "→")
    ),
    h("button", { type: "button", class: "apple-path-card", onClick: onOffer },
      h("span", { class: "apple-path-label" }, "Ich biete Arbeit an"),
      h("span", { class: "apple-path-arrow" }, "→")
    )
  );
}

export function appleWizardBar(step, total, label) {
  return h("div", { class: "apple-wizard-bar" },
    h("div", { class: "apple-wizard-progress" },
      h("div", { class: "apple-wizard-fill", style: { width: `${(step / total) * 100}%` } })
    ),
    h("p", { class: "apple-wizard-label" }, `Schritt ${step} von ${total}`, label ? ` · ${label}` : "")
  );
}

export function appleBidCard({ name, headline, price, message, tags = [], warnings = [], actions = [] }) {
  return h("article", { class: "apple-bid-card" },
    h("div", { class: "apple-bid-head" },
      h("div", {},
        h("h3", { class: "apple-bid-name" }, name),
        h("p", { class: "apple-bid-meta" }, headline)
      ),
      h("div", { class: "apple-bid-price" }, price)
    ),
    warnings.length ? h("div", { class: "apple-bid-warnings" },
      ...warnings.map((w) => h("span", { class: "apple-pill" }, w))
    ) : null,
    message ? h("p", { class: "apple-bid-msg" }, `"${message}"`) : null,
    tags.length ? h("div", { class: "em-tags" }, ...tags.map((t) => h("span", { class: `em-tag ${t.cls || ""}` }, t.label))) : null,
    actions.length ? h("div", { class: "apple-bid-actions" }, ...actions) : null
  );
}

export function appleNdaBlind({ level, onConfirm, nameInput, ideaTermsCheckbox, showIdeaTerms = false }) {
  return h("div", { class: "apple-nda-blind" },
    h("h3", {}, level >= 3 ? "Geheime Idee — nur Realisierung" : level >= 2 ? "Geschütztes Realisierungsprojekt" : "Vertrauliches Realisierungsprojekt"),
    h("p", {}, "Der Marktplatz dient nicht dem Verkauf von Ideen, sondern deren Umsetzung. Mit der Bestätigung verpflichtest du dich:"),
    h("ul", { class: "em-nda-list" },
      h("li", {}, "Inhalte weder weiterzugeben noch selbst zu verwerten oder die Idee eigenständig zu realisieren."),
      h("li", {}, "Nur im Rahmen dieses Auftrags mitzuwirken — nicht parallel dieselbe Idee umzusetzen."),
      ...(level >= 3 ? [
        h("li", {}, "Bei Verstoß: Vertragsstrafe sowie Herausgabe sämtlicher Vorteile aus der unerlaubten Nutzung."),
        h("li", {}, "Im Zweifel auch Herausgabe/Unterstellung eines Unternehmens, das auf der geklauten Idee basiert."),
      ] : [])
    ),
    level >= 2 ? h("p", { style: { fontSize: 14, marginTop: 8 } }, "Deine Zustimmung wird mit Namen und Zeitpunkt protokolliert.") : null,
    nameInput || null,
    ideaTermsCheckbox || null,
    showIdeaTerms && !ideaTermsCheckbox ? h("p", { class: "em-muted", style: { fontSize: 13 } }, "Bitte Ideen-Schutz-Bedingungen aktivieren.") : null,
    onConfirm
  );
}

export function applePanel(title, children = []) {
  return h("section", { class: "apple-panel" },
    title ? h("h2", { class: "apple-panel-title" }, title) : null,
    ...children
  );
}

export function appleBreadcrumb(items, { onNavigate } = {}) {
  return h("nav", { class: "apple-breadcrumb", "aria-label": "Pfad" },
    ...items.flatMap((item, i) => {
      const nodes = [];
      if (i > 0) nodes.push(h("span", { class: "apple-breadcrumb-sep" }, "›"));
      nodes.push(item.current
        ? h("span", { class: "apple-breadcrumb-current" }, item.label)
        : h("button", { type: "button", class: "apple-breadcrumb-link", onClick: () => onNavigate?.(item) }, item.label));
      return nodes;
    })
  );
}

export function appleEmptyState({ title, text, ctaLabel, onCta }) {
  return h("div", { class: "apple-empty" },
    h("h3", {}, title),
    h("p", {}, text),
    ctaLabel && onCta ? appleBtn(ctaLabel, { onClick: onCta }) : null
  );
}

export function appleErsteSchritte(steps, { done, total, onStep }) {
  return h("div", { class: "apple-erste-schritte" },
    h("div", { class: "apple-erste-head" },
      h("strong", {}, "Erste Schritte"),
      h("span", {}, `${done} von ${total} erledigt`)
    ),
    h("div", { class: "apple-wizard-progress", style: { marginTop: 8 } },
      h("div", { class: "apple-wizard-fill", style: { width: `${total ? (done / total) * 100 : 0}%` } })
    ),
    h("ul", { class: "apple-erste-list" },
      ...steps.map((s) =>
        h("li", { class: s.done ? "is-done" : "" },
          h("button", {
            type: "button",
            class: "apple-erste-row",
            disabled: s.done,
            onClick: () => !s.done && onStep?.(s),
          },
            h("span", { class: "apple-erste-check" }, s.done ? "✓" : "○"),
            s.label
          )
        )
      )
    )
  );
}

/** Große Auswahl-Karte — für Senioren & Einsteiger */
export function appleBigChoice({ num, title, text, hint, onClick, active }) {
  return h("button", {
    type: "button",
    class: `apple-big-choice${active ? " is-active" : ""}`,
    onClick,
  },
    num ? h("span", { class: "apple-big-num" }, num) : null,
    h("strong", {}, title),
    h("p", {}, text),
    hint ? h("em", {}, hint) : null
  );
}

/** Segment — 1 · 2 · 3 */
export function appleSegmentSimple(items, active, onSelect) {
  return h("div", { class: "em-segment-simple" },
    ...items.map((item) =>
      h("button", {
        type: "button",
        class: `em-segment-btn${active === item.id ? " is-on" : ""}`,
        onClick: () => onSelect(item.id),
      }, item.label)
    )
  );
}

/** Ein Feld mit großer Beschriftung */
export function appleSimpleField(label, inputEl) {
  return h("div", { class: "em-simple-field" },
    h("label", { class: "em-simple-label" }, label),
    inputEl
  );
}

/** Kleines Info-/Angebots-Band oben (wie „Bezahle in 24 Raten …"). */
export function applePromoBar({ text, linkLabel, onLink, onPrev, onNext }) {
  return h("section", { class: "apple-promo-bar" },
    h("button", { type: "button", class: "apple-promo-arrow", "aria-label": "Zurück", onClick: onPrev }, "‹"),
    h("div", { class: "apple-promo-text" },
      text,
      linkLabel ? h("button", { type: "button", class: "apple-link", onClick: onLink }, ` ${linkLabel} ›`) : null
    ),
    h("button", { type: "button", class: "apple-promo-arrow", "aria-label": "Weiter", onClick: onNext }, "›")
  );
}

/** Große Apple-Store-Überschrift („Der Store. Die beste Art …") mit Blau-Links. */
export function appleStoreHero({ title, subtitle, links = [] }) {
  return h("section", { class: "apple-store-hero" },
    h("h1", { class: "apple-store-hero-title" }, title),
    subtitle ? h("p", { class: "apple-store-hero-sub" }, subtitle) : null,
    links.length ? h("div", { class: "apple-store-hero-links" },
      ...links.map((l) => h("button", { type: "button", class: "apple-store-hero-link", onClick: l.onClick },
        l.label, h("span", {}, " ↗")))
    ) : null
  );
}

/** Kategorie-Chip mit großem Icon oben und Label unten (Mac · iPhone · iPad …). */
export function appleCategoryChip({ icon, label, onClick, active }) {
  return h("button", {
    type: "button",
    class: `apple-cat-chip${active ? " is-on" : ""}`,
    onClick,
  },
    h("div", { class: "apple-cat-icon" }, icon),
    h("span", { class: "apple-cat-label" }, label)
  );
}

export function appleCategoryRow(items) {
  return h("div", { class: "apple-cat-row" }, ...items);
}

/** Große Inserats-Karte im Apple-Store-Look ("Gerade erst vorgestellt"). */
export function appleInsertCard({
  eyebrow, title, subtitle, priceLine, ratelLine, badge,
  emoji, accent = "#0071e3", theme = "light", cta = "Details ansehen",
  paymentHint, splitHint, nda, onClick,
}) {
  const dark = theme === "dark";
  return h("article", {
    class: `apple-insert-card ${dark ? "is-dark" : "is-light"}`,
    style: { "--tone": accent },
    onClick,
  },
    eyebrow ? h("p", { class: "apple-insert-eyebrow" }, eyebrow) : null,
    h("h3", { class: "apple-insert-title" }, title),
    subtitle ? h("p", { class: "apple-insert-sub" }, subtitle) : null,
    priceLine ? h("p", { class: "apple-insert-price" }, priceLine) : null,
    ratelLine ? h("p", { class: "apple-insert-rate" }, ratelLine) : null,
    badge ? h("span", { class: "apple-insert-badge" }, badge) : null,
    paymentHint || splitHint ? h("div", { class: "apple-insert-tags" },
      paymentHint ? h("span", { class: "apple-pill apple-pill-accent" }, paymentHint) : null,
      splitHint ? h("span", { class: "apple-pill" }, splitHint) : null,
      nda ? h("span", { class: "apple-pill apple-pill-lock" }, "🔒 NDA") : null
    ) : null,
    h("div", { class: "apple-insert-visual" },
      h("span", { class: "apple-insert-emoji" }, emoji || "✨")
    ),
    onClick ? h("span", { class: "apple-insert-cta" }, `${cta} ›`) : null
  );
}

/** Karussell-Zeile mit horizontalem Scroll (Snap). */
export function appleCarousel(children) {
  return h("div", { class: "apple-carousel" }, ...children);
}

/** Kleine Hilfe-Karte unten ("Wir helfen gerne."). */
export function appleHelpCard({ eyebrow, title, text, cta, onClick, accent = "#f5f5f7" }) {
  return h("article", { class: "apple-help-card", style: { background: accent }, onClick },
    eyebrow ? h("p", { class: "apple-help-eyebrow" }, eyebrow) : null,
    h("h3", { class: "apple-help-title" }, title),
    text ? h("p", { class: "apple-help-text" }, text) : null,
    onClick ? h("span", { class: "apple-link", style: { marginTop: 12, display: "inline-block" } }, `${cta || "Mehr erfahren"} ›`) : null
  );
}

/** Gesperrtes Feld mit Schloss – nur nach NDA sichtbar. */
export function appleLockedField({ label, note = "Wird nach NDA sichtbar", onUnlock }) {
  return h("div", { class: "apple-locked-field" },
    h("div", { class: "apple-locked-head" },
      h("span", { class: "apple-locked-icon" }, "🔒"),
      h("strong", {}, label)
    ),
    h("p", { class: "apple-locked-note" }, note),
    onUnlock ? h("button", { type: "button", class: "apple-link", onClick: onUnlock }, "NDA akzeptieren ›") : null
  );
}

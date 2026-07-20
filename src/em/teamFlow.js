/**
 * Teams — Apple-Store-Aufbau, Projects-Inhalt.
 * Drei Wege: einzeln · Bündnis · gründen.
 */
import { h } from "../shared/dom.js";
import { formatEUR } from "./format.js";
import {
  appleBtn, applePanel, appleSimpleField, appleBigChoice,
  appleInsertCard, appleCarousel, appleStoreHero, appleHelpCard,
} from "./components.js";

export const TEAM_WAYS = [
  {
    id: "self",
    num: "01",
    title: "Personen einzeln holen",
    text: "Für jede Rolle jemanden suchen — Schritt für Schritt.",
    hint: "1–3 Tage",
  },
  {
    id: "bundle",
    num: "02",
    title: "Fertiges Team buchen",
    text: "Eingespieltes Bündnis — alle bekommen die Anfrage auf einmal.",
    hint: "Oft sofort",
  },
  {
    id: "create",
    num: "03",
    title: "Eigenes Team gründen",
    text: "Freunde & Kollegen einladen — bleibt dauerhaft zusammen.",
    hint: "Wiederkehrend",
  },
];

export function renderTeamWayPicker(active, onSelect) {
  return h("div", { class: "apple-team-ways" },
    h("h2", { class: "apple-section-lead" },
      "Drei Wege. ",
      h("span", { class: "apple-section-lead-dim" }, "Wähle, wie du dein Team findest.")
    ),
    h("div", { class: "apple-help-grid" },
      ...TEAM_WAYS.map((w) =>
        h("button", {
          type: "button",
          class: `apple-help-card apple-way-card${active === w.id ? " is-on" : ""}`,
          onClick: () => onSelect(w.id),
        },
          h("p", { class: "apple-help-eyebrow" }, w.num),
          h("h3", { class: "apple-help-title" }, w.title),
          h("p", { class: "apple-help-text" }, w.text),
          h("span", { class: "apple-link", style: { marginTop: 12, display: "inline-block" } },
            active === w.id ? "Ausgewählt" : `${w.hint} ›`)
        )
      )
    )
  );
}

/** Liste fertiger Bündnisse — Apple-Karten */
export function renderBundleList(teams, { onOpen, onRequest, myProjectTitle }) {
  const presets = teams.filter((t) => t.preset);
  if (!presets.length) {
    return h("p", { class: "em-muted", style: { padding: "16px 0" } }, "Noch keine Bündnisse — nutze Weg 1 oder 3.");
  }
  return h("div", {},
    myProjectTitle
      ? h("p", { class: "apple-page-sub", style: { marginBottom: 16 } }, `Für: ${myProjectTitle}`)
      : null,
    appleCarousel(presets.map((t) =>
      appleInsertCard({
        eyebrow: "EINGESPIELT · Bündnis",
        title: t.name,
        subtitle: t.tagline || `${t.memberCount} Personen`,
        priceLine: t.teamDayRateCents ? `Ab ${formatEUR(t.teamDayRateCents)} / Tag` : `${t.memberCount} Mitglieder`,
        ratelLine: t.teamRating ? `★ ${t.teamRating}` : null,
        badge: "Bündnis",
        emoji: t.heroEmoji || "🤝",
        accent: t.heroAccent || "#5e5ce6",
        theme: t.heroTheme || "dark",
        cta: "Team ansehen",
        paymentHint: "Team-Anfrage",
        onClick: () => onOpen(t.id),
      })
    )),
    onRequest ? h("div", { class: "apple-help-grid", style: { marginTop: 16 } },
      ...presets.slice(0, 4).map((t) =>
        appleHelpCard({
          eyebrow: t.name,
          title: "Für dein Projekt anfragen",
          text: t.tagline || "Alle Mitglieder erhalten die Anfrage.",
          cta: "Anfragen",
          onClick: () => onRequest(t.id),
          accent: "#f5f5f7",
        })
      )
    ) : null
  );
}

/** Team-Baukasten — eine Rolle nach der anderen */
export function renderSimpleTeamBuilder(tb, { onInvite, onOpenProfile }) {
  if (!tb?.roles?.length) {
    return h("p", { class: "em-muted" }, "Noch keine Rollen — Projekt speichern, dann erscheinen Vorschläge.");
  }
  const openRoles = tb.roles.filter((r) => !r.userId);
  const filled = tb.roles.filter((r) => r.userId);

  return h("div", { class: "apple-team-builder" },
    h("p", { class: "apple-page-sub" },
      `${filled.length} von ${tb.roles.length} Rollen besetzt`,
      tb.teamPassScore != null ? ` · Passung ${tb.teamPassScore}%` : ""
    ),
    h("div", { class: "apple-help-grid", style: { marginTop: 16 } },
      ...tb.roles.map((r) => {
        const person = r.userId ? tb.suggestions?.find((s) => s.userId === r.userId) : null;
        const status = !r.userId ? "Offen" : r.status === "confirmed" ? "Zugesagt" : "Angefragt";
        return appleHelpCard({
          eyebrow: status,
          title: r.name,
          text: person ? (person.name || `Person #${r.userId}`) : "Noch niemand besetzt",
          accent: status === "Zugesagt" ? "#e8f6ec" : status === "Angefragt" ? "#fff2e6" : "#f5f5f7",
        });
      })
    ),
    openRoles.length && (tb.suggestions || []).length ? h("div", { style: { marginTop: 28 } },
      h("h2", { class: "apple-section-lead" },
        `Nächste Rolle: ${openRoles[0].name}. `,
        h("span", { class: "apple-section-lead-dim" }, "Tippe auf Einladen.")
      ),
      appleCarousel((tb.suggestions || []).slice(0, 6).map((s) =>
        appleInsertCard({
          eyebrow: s.passScore != null ? `Passt zu ${s.passScore}%` : "Vorschlag",
          title: s.name,
          subtitle: s.headline || "",
          priceLine: (s.passReasons || []).slice(0, 1).map((x) => x.text).join("") || null,
          emoji: "👤",
          accent: "#0071e3",
          theme: "light",
          cta: "Einladen",
          onClick: () => onInvite(openRoles[0].name, s.userId, s.name),
        })
      )),
      h("div", { style: { marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" } },
        ...(tb.suggestions || []).slice(0, 4).map((s) =>
          appleBtn("Profil · " + (s.name || "").split(" ")[0], {
            variant: "secondary",
            onClick: () => onOpenProfile(s.userId),
          })
        )
      )
    ) : null
  );
}

/** Eigenes Team gründen */
export function renderCreateTeamForm({ onCreate, onCancel }) {
  const name = h("input", { class: "em-input em-input-big", placeholder: "z. B. Werkbank Vier" });
  const tag = h("input", { class: "em-input em-input-big", placeholder: "Kurz: Was macht ihr zusammen?" });
  return applePanel("Team gründen", [
    h("p", { class: "em-muted", style: { marginBottom: 16 } }, "Schritt 1: Name. Schritt 2: Freunde einladen."),
    appleSimpleField("Team-Name", name),
    appleSimpleField("Kurzbeschreibung (optional)", tag),
    h("div", { style: { display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" } },
      appleBtn("Team erstellen", {
        onClick: () => {
          if (!name.value.trim()) return;
          onCreate({ name: name.value.trim(), tagline: tag.value.trim() });
        },
      }),
      onCancel ? appleBtn("Abbrechen", { variant: "secondary", onClick: onCancel }) : null
    ),
  ]);
}

/** Große Aufgabe vergeben */
export function renderSimpleTaskForm(participants, { onSubmit, onCancel }) {
  const title = h("input", { class: "em-input em-input-big", placeholder: "z. B. Lieferantenliste prüfen" });
  const outcome = h("input", { class: "em-input em-input-big", placeholder: "z. B. Top-20-Liste als PDF" });
  const due = h("input", { class: "em-input em-input-big", type: "date" });
  const whoRow = h("div", { class: "em-who-row" });
  const state = { selected: participants[0]?.userId || null };
  const paintWho = () => {
    whoRow.replaceChildren(...participants.map((p) =>
      h("button", {
        type: "button",
        class: `em-who-btn${state.selected === p.userId ? " is-on" : ""}`,
        onClick: () => { state.selected = p.userId; paintWho(); },
      }, p.name || "Person")
    ));
  };
  paintWho();

  return applePanel("Aufgabe vergeben", [
    h("p", { class: "em-muted", style: { marginBottom: 16 } }, "Ohne Arbeitszeit — nur Ergebnis + Frist."),
    appleSimpleField("Was soll gemacht werden?", title),
    appleSimpleField("Was ist fertig, wenn es gut ist?", outcome),
    appleSimpleField("Bis wann?", due),
    h("label", { class: "em-simple-label" }, "Wer macht das?"),
    whoRow,
    h("div", { style: { display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" } },
      appleBtn("Aufgabe senden", {
        onClick: () => {
          if (!title.value.trim() || !state.selected) return;
          onSubmit({
            title: title.value.trim(),
            outcome: outcome.value.trim(),
            dueDate: due.value || null,
            assigneeUserId: state.selected,
          });
        },
      }),
      onCancel ? appleBtn("Abbrechen", { variant: "secondary", onClick: onCancel }) : null
    ),
  ]);
}

export function renderSimpleDelegateForm({ onSubmit, onCancel, lead = "Aufgabe ans Team senden — jemand aus dem Team übernimmt." }) {
  const title = h("input", { class: "em-input em-input-big", placeholder: "z. B. Unterlagen für Kunde vorbereiten" });
  const outcome = h("input", { class: "em-input em-input-big", placeholder: "z. B. PDF-Paket fertig zum Versand" });
  return applePanel("Anfrage ans Team", [
    h("p", { class: "em-muted", style: { marginBottom: 16 } }, lead),
    appleSimpleField("Was soll gemacht werden?", title),
    appleSimpleField("Was ist fertig, wenn es gut ist?", outcome),
    h("div", { style: { display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" } },
      appleBtn("Anfrage senden", {
        onClick: () => {
          if (!title.value.trim()) return;
          onSubmit({ title: title.value.trim(), outcome: outcome.value.trim() });
        },
      }),
      onCancel ? appleBtn("Abbrechen", { variant: "secondary", onClick: onCancel }) : null
    ),
  ]);
}

export function renderTeamOnBoardBanner({ onClick, staffingLabel }) {
  return appleHelpCard({
    eyebrow: "Team an Bord",
    title: "Brauchst du ein Team?",
    text: staffingLabel || "Mehrere Rollen gleichzeitig — hier holst du Leute an Bord.",
    cta: "Team an Bord holen",
    onClick,
    accent: "#eef1ff",
  });
}

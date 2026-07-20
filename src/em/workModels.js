/** Vergütungs- & Aufgaben-Modelle — einfache Labels für die UI */
import { h } from "../shared/dom.js";

export const PAY_MODELS = [
  { id: "fixed", num: "1", title: "Festpreis", text: "Fester Betrag fürs Ergebnis — Treuhand & Meilensteine.", icon: "💶" },
  { id: "time", num: "2", title: "Nach Zeit", text: "Vergütung pro Stunde, Tag, Woche oder Monat — z. B. Interim.", icon: "⏱" },
  { id: "success", num: "3", title: "Erfolgsbasiert", text: "Bezahlung (ganz oder teilweise) erst bei messbarem Erfolg (z. B. Umsatz, Einsparung).", icon: "📈" },
  { id: "quantity", num: "4", title: "Nach Menge", text: "Pro Einheit — z. B. pro Beitrag, pro Datensatz, pro qm.", icon: "🔢" },
  { id: "contest", num: "5", title: "Wettbewerb (Qualität)", text: "Alle können einreichen — die beste Arbeit gewinnt.", icon: "🏆" },
];

export const WINNER_CRITERIA = [
  { id: "best", title: "Beste Qualität", text: "Auftraggeber wählt die beste Arbeit — egal wann eingereicht." },
  { id: "fastest", title: "Schnellste gute", text: "Wer zuerst brauchbar liefert, gewinnt." },
  { id: "best_by_deadline", title: "Beste bis Stichtag", text: "Bis zur Frist einreichen — dann wird gekürt." },
  { id: "community", title: "Community-Vote", text: "Andere Teilnehmer bewerten — höchster Score gewinnt." },
];

export const TASK_MODES = [
  { id: "owner", title: "Ich verteile", text: "Nur du vergibst Aufgaben ans Team." },
  { id: "team", title: "Team verteilt selbst", text: "Mitglieder dürfen Aufgaben anlegen & umhängen." },
];

export function payModelLabel(id) {
  return PAY_MODELS.find((m) => m.id === id)?.title || "Festpreis";
}

export function winnerCriteriaLabel(id) {
  return WINNER_CRITERIA.find((m) => m.id === id)?.title || "Beste Arbeit";
}

/** Große nummerierte Auswahl — eine Spalte */
export function renderBigPick(items, active, onSelect, { getId = (x) => x.id } = {}) {
  return h("div", { class: "em-big-pick-list" },
    ...items.map((item) =>
      h("button", {
        type: "button",
        class: `em-big-pick${active === getId(item) ? " is-on" : ""}`,
        onClick: () => onSelect(getId(item)),
      },
        item.num ? h("span", { class: "em-big-pick-num" }, item.num) : null,
        h("strong", {}, item.title),
        h("p", {}, item.text || item.short || "")
      )
    )
  );
}

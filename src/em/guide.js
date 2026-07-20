import { h } from "../shared/dom.js";
import { appleBtn, applePanel, appleSectionHeadline } from "./components.js";
import { GRUNDREGELN } from "./nav.js";

function svgMockup(step) {
  const common = `viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" class="em-guide-svg"`;
  const screens = {
    project: `<svg ${common}><rect width="400" height="260" rx="18" fill="#f5f5f7"/><rect x="24" y="24" width="352" height="32" rx="8" fill="#e8e8ed"/><rect x="24" y="72" width="280" height="12" rx="4" fill="#d2d2d7"/><rect x="24" y="160" width="160" height="36" rx="18" fill="#0071e3"/></svg>`,
    offer: `<svg ${common}><rect width="400" height="260" rx="18" fill="#1d1d1f"/><rect x="24" y="120" width="352" height="56" rx="12" fill="#0071e3"/></svg>`,
    apply: `<svg ${common}><rect width="400" height="260" rx="18" fill="#f5f5f7"/><rect x="24" y="196" width="352" height="44" rx="22" fill="#0071e3"/></svg>`,
    team: `<svg ${common}><circle cx="100" cy="100" r="36" fill="#0071e3" opacity="0.2"/><circle cx="200" cy="80" r="36" fill="#0071e3" opacity="0.35"/><circle cx="300" cy="100" r="36" fill="#0071e3" opacity="0.2"/></svg>`,
    board: `<svg ${common}><rect x="20" y="40" width="110" height="200" rx="10" fill="#f5f5f7"/><rect x="145" y="40" width="110" height="200" rx="10" fill="#fff" stroke="#d2d2d7"/><rect x="270" y="40" width="110" height="200" rx="10" fill="#f5f5f7"/></svg>`,
    nda: `<svg ${common}><rect width="400" height="260" rx="18" fill="#fff"/><rect x="40" y="80" width="320" height="100" rx="12" fill="#f5f5f7" stroke="#0071e3" stroke-dasharray="4"/></svg>`,
    contest: `<svg ${common}><rect width="400" height="260" rx="18" fill="#f5f5f7"/><rect x="24" y="40" width="352" height="48" rx="12" fill="#34c759" opacity="0.25"/><rect x="24" y="110" width="352" height="80" rx="12" fill="#fff" stroke="#d2d2d7"/><rect x="24" y="210" width="200" height="36" rx="18" fill="#0071e3"/></svg>`,
    hub: `<svg ${common}><rect x="20" y="30" width="80" height="28" rx="14" fill="#0071e3"/><rect x="110" y="30" width="80" height="28" rx="14" fill="#e8e8ed"/><rect x="200" y="30" width="80" height="28" rx="14" fill="#e8e8ed"/><rect x="20" y="80" width="360" height="160" rx="12" fill="#fff" stroke="#d2d2d7"/></svg>`,
  };
  return h("div", { class: "em-guide-mockup", innerHTML: screens[step] || screens.project });
}

const RULES = GRUNDREGELN;

const SECTIONS = [
  {
    id: "A",
    title: "A · Arbeit anbieten (Fachkraft)",
    steps: [
      { id: "apply", title: "1 · Profil arbeitsbereit machen", text: "Arbeitsweise wählen: Solo, im Team oder beides. Auszahlungskonto verbinden. Jeder hat einen eigenen Account — auch in Teams.", cta: "profil", ctaLabel: "Profil öffnen" },
      { id: "nda", title: "2 · Projekt finden & NDA bestätigen", text: "Geschützte Projekte zeigen nur Stichpunkte. Ein Klick (Stufe 1), Name tippen (Stufe 2) oder Ideen-Schutz (Stufe 3) — dann siehst du alles.", cta: "markt", ctaLabel: "Projekte durchsuchen" },
      { id: "apply", title: "3 · Bewerben oder Wettbewerb", text: "Normal: kurze Bewerbung (max. 400 Zeichen) + Preis. Wettbewerb: keine Bewerbung — einfach Arbeit fertig machen und einreichen. Beste oder schnellste gewinnt.", cta: "markt", ctaLabel: "Mitmachen" },
      { id: "offer", title: "4 · Leistungspaket anbieten", text: "Festpreis, Frist, Startfragen — solo oder als Team. Andere können dein Paket buchen, ohne jedes Mal neu zu verhandeln.", cta: "angebote", ctaLabel: "Angebote" },
    ],
  },
  {
    id: "B",
    title: "B · Arbeit vergeben (Auftraggeber)",
    steps: [
      { id: "project", title: "1 · Projekt erstellen — Vergütung wählen", text: "Festpreis · Auf Zeit · Erfolgsbasiert · Wettbewerb. Dann Schutz, Ort, Budget. Bei Teams: Solo, Team oder beides — und wer Aufgaben verteilt.", cta: "erstellen", ctaLabel: "Projekt einstellen" },
      { id: "team", title: "2 · Bewerbungen annehmen", text: "Sortiert nach Bewertung und Termintreue. Mehrere Personen annehmen, wenn das Projekt ein Team braucht. Jede Annahme = Treuhand-Meilenstein.", cta: "meine", ctaLabel: "Meine Projekte" },
      { id: "hub", title: "3 · Projekt-Arbeitsfläche", text: "Reiter pro Projekt: Übersicht · Team · Aufgaben · Wettbewerb · Bezahlung. Alles an einem Ort — kein Suchen in Menüs.", cta: "markt", ctaLabel: "Projekt öffnen" },
      { id: "project", title: "4 · Abnehmen & bezahlen", text: "7 Tage Prüffrist pro Meilenstein. Abnehmen = Auszahlung. Schweigen = automatische Freigabe. Bei Wettbewerb: Gewinner wählen → Preisgeld frei.", cta: "meine", ctaLabel: "Zahlungen" },
    ],
  },
  {
    id: "C",
    title: "C · Teams — drei Wege",
    steps: [
      { id: "team", title: "Weg 1 · Aus Bewerbern bauen", text: "Projekt braucht Team? Bewerbungen annehmen → im Team-Reiter Personen einladen → alle müssen zustimmen. Dann als Dauer-Team speichern.", cta: "teams", ctaLabel: "Teams" },
      { id: "team", title: "Weg 2 · Personen direkt anfragen", text: "Name suchen, einladen — jede Person entscheidet selbst: Ja/Nein, solo oder im Team. Keine User-IDs nötig.", cta: "teams", ctaLabel: "Einladen" },
      { id: "team", title: "Weg 3 · Fertiges Bündnis", text: "Eingespieltes Team mit gemeinsamer Bewertung — ein Klick buchen oder für dein Projekt anfragen. Oder selbst gründen und als Bündnis anbieten.", cta: "teams", ctaLabel: "Bündnisse" },
      { id: "board", title: "Aufgaben im Team", text: "Modus wählbar: Du verteilst alle Aufgaben — oder das Team darf selbst anlegen und umhängen. Board: Wer · To-dos · Bezahlung.", cta: "markt", ctaLabel: "Laufendes Projekt" },
    ],
  },
  {
    id: "D",
    title: "D · Vergütungsmodelle",
    steps: [
      { id: "project", title: "Festpreis", text: "Fester Betrag fürs Ergebnis. Geld in Treuhand, Auszahlung in Meilensteinen nach Abnahme.", cta: "erstellen", ctaLabel: "Festpreis-Projekt" },
      { id: "project", title: "Arbeit auf Zeit", text: "Tag, Woche oder Monat — z. B. Interim. Meilensteine pro Periode, keine Zeiterfassung — nur Ergebnis + Frist.", cta: "erstellen", ctaLabel: "Zeit-Projekt" },
      { id: "project", title: "Erfolgsbasiert", text: "Bezahlung (ganz oder teilweise) erst bei messbarem Erfolg — z. B. Umsatzsteigerung, Exit, KPI.", cta: "erstellen", ctaLabel: "Erfolgs-Projekt" },
      { id: "contest", title: "Wettbewerb", text: "Preisgeld eingefroren. Jeder arbeitet zuhause, reicht ein — beste, schnellste oder beste bis Stichtag gewinnt. Streit: Markt ± Experte.", cta: "markt", ctaLabel: "Wettbewerbe finden" },
    ],
  },
  {
    id: "E",
    title: "E · Weitere Handlungen",
    steps: [
      { id: "nda", title: "Nachrichten & Bewertung", text: "Vor Annahme max. 5 Klärungs-Nachrichten. Nach Abschluss: 4 Sterne-Achsen, verdeckt bis beide abgegeben haben.", cta: "chat", ctaLabel: "Nachrichten" },
      { id: "contest", title: "Streitfälle", text: "Bei Wettbewerb oder Meilenstein: Streit melden. Admin entscheidet — Geld bleibt in Treuhand bis zur Klärung.", cta: "hub", ctaLabel: "Konto" },
      { id: "project", title: "Konto & Recht", text: "Auszahlung, Belege, Daten löschen. Fußzeile: AGB, Datenschutz, Impressum.", cta: "hub", ctaLabel: "Mein Bereich" },
    ],
  },
];

export function renderGuidePage({ onGoTab, onStart }) {
  const go = (tab) => {
    if (tab === "erstellen") onStart?.();
    else onGoTab?.(tab);
  };

  return h("div", { class: "em-guide-page" },
    applePanel("Grundregeln (überall gleich)", [
      h("ul", { class: "em-guide-rules" }, ...RULES.map((r) => h("li", {}, r))),
      h("p", { class: "em-muted", style: { marginTop: 12 } },
        "Modus-Umschalter oben: Ich arbeite / Ich vergebe — ein Konto, beide Rollen. Jede Person hat einen eigenen Account."
      ),
    ]),
    applePanel("Inhaltsverzeichnis", [
      h("nav", { class: "em-guide-toc" },
        ...SECTIONS.map((sec) =>
          h("a", {
            href: `#guide-${sec.id}`,
            class: "em-guide-toc-link",
            onClick: (e) => {
              e.preventDefault();
              document.getElementById(`guide-${sec.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          }, sec.title)
        )
      ),
    ]),
    ...SECTIONS.map((sec, si) =>
      h("section", { id: `guide-${sec.id}`, class: "em-guide-section em-reveal", "data-delay": String(si * 60) },
        appleSectionHeadline(sec.title),
        h("div", { class: "em-guide-steps" },
          ...sec.steps.map((s, i) =>
            h("article", { class: "em-guide-step" },
              svgMockup(s.id),
              h("div", { class: "em-guide-step-body" },
                h("h2", {}, s.title),
                h("p", {}, s.text),
                appleBtn(s.ctaLabel, {
                  variant: i % 2 ? "secondary" : "primary",
                  onClick: () => go(s.cta),
                })
              )
            )
          )
        )
      )
    ),
    applePanel("Kurzüberblick", [
      h("div", { class: "em-guide-overview" },
        ...[
          ["Auftraggeber", "Projekt (Vergütung wählen) → Bewerbungen → Team-Reiter → Aufgaben delegieren → abnehmen"],
          ["Fachkraft", "Profil → NDA → bewerben oder Wettbewerb einreichen → Meilenstein → Auszahlung"],
          ["Team", "3 Wege (Bewerber / Einladen / Bündnis) → Zustimmung → Aufgaben (Owner oder Team-Modus)"],
          ["Wettbewerb", "Keine Bewerbung → einreichen → Gewinner → Treuhand-Auszahlung"],
        ].map(([role, line]) =>
          h("div", { class: "em-guide-overview-row" },
            h("strong", {}, role),
            h("span", {}, line)
          )
        )
      ),
    ])
  );
}

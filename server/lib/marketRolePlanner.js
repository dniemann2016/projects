/**
 * Aufgabenzerleger — Ziel in einem Satz → Rollen, Teilaufgaben, Preisspannen.
 * Regelbasiert aus Kategorie + Keywords (KI-ready Hook).
 */
import { CATEGORIES } from "./marketConstants.js";

const ROLE_TEMPLATES = {
  software: [
    { role: "Tech-Lead", share: 35, tasks: ["Architektur", "Code-Review", "Schnittstellen"] },
    { role: "Entwickler", share: 40, tasks: ["Implementierung", "Tests", "Deployment"] },
    { role: "UX/QA", share: 25, tasks: ["UI-Feinschliff", "Abnahme-Tests"] },
  ],
  design: [
    { role: "Art Director", share: 30, tasks: ["Konzept", "Markenführung"] },
    { role: "Designer", share: 50, tasks: ["Layouts", "Assets", "Export"] },
    { role: "Feedback-Runde", share: 20, tasks: ["Iterationen", "Finalisierung"] },
  ],
  management: [
    { role: "Projektleitung", share: 40, tasks: ["Steuerung", "Reporting", "Stakeholder"] },
    { role: "Fachexperte", share: 35, tasks: ["Umsetzung", "Qualitätssicherung"] },
    { role: "Operativ", share: 25, tasks: ["Operative Aufgaben", "Dokumentation"] },
  ],
  default: [
    { role: "Koordination", share: 30, tasks: ["Planung", "Abstimmung"] },
    { role: "Umsetzung", share: 50, tasks: ["Hauptarbeit", "Lieferung"] },
    { role: "Qualität", share: 20, tasks: ["Prüfung", "Abnahme-Vorbereitung"] },
  ],
};

export function suggestRolesFromGoal({ goal, category, budgetCents }) {
  const cat = CATEGORIES.some((c) => c.id === category) ? category : "sonstiges";
  const template = ROLE_TEMPLATES[cat] || ROLE_TEMPLATES.default;
  const budget = budgetCents || 1000000;
  const goalLower = String(goal || "").toLowerCase();

  let teamRecommended = goalLower.length > 40
    || /team|zusammen|mehrere|parallel|umfang|komplex/i.test(goalLower);

  const roles = template.map((r) => ({
    role: r.role,
    sharePercent: r.share,
    shareBps: r.share * 100,
    suggestedTasks: r.tasks,
    budgetHintCents: Math.round(budget * (r.share / 100)),
    budgetHint: `${Math.round(budget * r.share / 100 / 100).toLocaleString("de-DE")} €`,
  }));

  const hiringMode = teamRecommended ? "team" : "solo";
  const teamSlots = teamRecommended ? roles.length : 1;

  return {
    goal: String(goal || "").slice(0, 500),
    category: cat,
    teamRecommended,
    hiringMode,
    teamSlots,
    splitMode: teamRecommended ? "shares" : "equal",
    roles,
    summary: teamRecommended
      ? `${roles.length} Rollen vorgeschlagen — Team empfohlen für: „${String(goal).slice(0, 80)}…"`
      : "Einzelperson reicht vermutlich — bei Bedarf Team aktivieren.",
  };
}

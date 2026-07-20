/** Zentrale Navigation & Texte — Apple-Stil-Entwürfe + Bedienungsanleitung */

export const NAV = {
  mobile: [
    { id: "entdecken", label: "Start" },
    { id: "markt", label: "Projekte" },
    { id: "angebote", label: "Angebote" },
    { id: "teams", label: "Teams" },
    { id: "hub", label: "Konto" },
  ],
  desktop: [
    { id: "entdecken", label: "Startseite" },
    { id: "markt", label: "Projekte" },
    { id: "talent", label: "Fachleute" },
    { id: "teams", label: "Teams" },
    { id: "angebote", label: "Angebote" },
    { id: "anleitung", label: "Hilfe" },
    { id: "hub", label: "Konto" },
  ],
  primary: { id: "erstellen", label: "Projekt einstellen" },
};

export const TAB_COPY = {
  entdecken: {
    title: "Start",
    subtitle: (mode) => mode === "vergeben"
      ? "Projekte einstellen, Teams holen, Bewerbungen prüfen."
      : "Passende Projekte, Leistungsangebote und Teams — ohne Arbeitsvertrag.",
  },
  markt: {
    title: "Projekte",
    subtitle: "Realisierung beauftragen — Solo, Team oder teilbesetzt.",
  },
  angebote: {
    title: "Leistungsangebote",
    subtitle: "Festpreis-Pakete mit Frist, Nachbesserungsrunden und Treuhand.",
  },
  teams: {
    title: "Teams & Bündnisse",
    subtitle: "Selbst zusammenstellen · Fertiges Bündnis buchen · Für Projekt anfragen.",
  },
  erstellen: {
    title: "Projekt einstellen",
    subtitle: "Drei Schritte: Was & wofür → Schutz & Ort → Zusammenfassung & Prüfung.",
  },
  hub: {
    title: "Konto",
    subtitle: "Ein Konto für beide Rollen — Profil, Auszahlung, Aufgaben, Anfragen.",
  },
  anleitung: {
    title: "Bedienungsanleitung",
    subtitle: "Schritt für Schritt — jede Handlung wie in den Entwürfen.",
  },
  profil: { title: "Mein Profil", subtitle: "Arbeitsweise, Skills, Verifizierung, Projekte, Aufgaben." },
  meine: { title: "Meine Projekte", subtitle: "Als Auftraggeber und als Fachmensch." },
  chat: { title: "Nachrichten", subtitle: "Projektgebundene Klärung — vor Annahme begrenzt." },
  admin: { title: "Administration", subtitle: "Freigabe-Warteschlange und Streitfälle." },
};

export const GRUNDREGELN = [
  "Geld nur über Treuhand — nie direkt.",
  "Beschreibung erst nach bestätigter Vertraulichkeit.",
  "Aufgaben: Ergebnis + Frist — niemals Arbeitszeit.",
  "Ein blauer Knopf pro Bildschirm ist die Hauptaktion (#0071e3).",
];

export const VERSPRECHEN = [
  { id: "nda", title: "Idee geschützt", text: "Vertraulichkeit wird bestätigt, bevor deine Beschreibung lesbar ist.", tab: "anleitung" },
  { id: "escrow", title: "Geld sicher hinterlegt", text: "Treuhand — Auszahlung nur gegen abgenommene Meilensteine oder Wettbewerb-Gewinn.", tab: "anleitung" },
  { id: "teams", title: "Teams flexibel", text: "Einzeln suchen, Bündnis buchen, selbst gründen — oder aus Projekt ein Dauer-Team bauen.", tab: "teams" },
  { id: "contest", title: "Wettbewerbe", text: "Ohne Bewerbung mitmachen — beste Arbeit gewinnt. Streit regelt der Markt.", tab: "markt" },
];

export const ERSTE_SCHRITTE = [
  { id: "profil", label: "Profil angelegt", tab: "profil", section: "profil", check: (s) => Boolean(s.myProfile?.headline) },
  { id: "work", label: "Arbeitsweise ausgefüllt", tab: "profil", section: "profil", check: (s) => Boolean(s.myProfile?.workMode) },
  { id: "payout", label: "Auszahlungskonto verbinden", tab: "hub", section: "zahlung", check: (s) => Boolean(s.paymentStatus?.payoutReady) },
  { id: "payment", label: "Zahlungsmittel hinterlegen (Vergeben)", tab: "hub", section: "zahlung", check: (s) => Boolean(s.paymentStatus?.paymentReady) },
  { id: "probe", label: "Erste Arbeitsprobe hochladen", tab: "profil", section: "profil", check: (s) => (s.workSamples?.length || 0) >= 1 },
];

export const EMPTY = {
  projects: { title: "Noch keine Projekte", text: "Stöbere in der Liste oder stelle dein eigenes Projekt ein.", cta: "Projekt einstellen", tab: "erstellen" },
  talent: { title: "Keine Treffer", text: "Filter lockern oder andere Skills suchen.", cta: "Alle anzeigen", tab: "markt" },
  teams: { title: "Noch kein Team", text: "Tritt einem Bündnis bei oder gründe dein eigenes Team.", cta: "Team gründen", tab: "teams" },
  tasks: { title: "Keine offenen Aufgaben", text: "Aufgaben erscheinen hier, wenn dir jemand welche zuweist.", cta: "Projekte", tab: "markt" },
  bids: { title: "Noch keine Bewerbungen", text: "Teile das Projekt oder warte auf passende Fachleute.", cta: null, tab: null },
};

export function breadcrumb(items) {
  return items.filter(Boolean);
}

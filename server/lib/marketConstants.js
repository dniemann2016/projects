export const CATEGORIES = [
  { id: "handwerk", label: "Handwerk" },
  { id: "software", label: "Software" },
  { id: "management", label: "Management" },
  { id: "recht", label: "Recht" },
  { id: "wissenschaft", label: "Wissenschaft" },
  { id: "design", label: "Design" },
  { id: "sonstiges", label: "Sonstiges" },
];

/** Vergütungsmodelle — wie bezahlt wird */
export const PAY_MODELS = [
  { id: "fixed", label: "Festpreis", short: "Fester Betrag für das Ergebnis — Treuhand, Meilensteine." },
  { id: "time", label: "Nach Zeit", short: "Vergütung pro Stunde, Tag, Woche oder Monat — z. B. Interim." },
  { id: "success", label: "Erfolgsbasiert", short: "Bezahlung ganz oder teilweise nach messbarem Erfolg (z. B. % Ersparnis, +Umsatz)." },
  { id: "quantity", label: "Nach Menge", short: "Pro Einheit — z. B. pro Beitrag, pro Datensatz, pro m²." },
  { id: "contest", label: "Wettbewerb", short: "Alle können mitmachen und einreichen — die beste Arbeit gewinnt das Preisgeld." },
];

export const WINNER_CRITERIA = [
  { id: "best", label: "Beste Qualität", short: "Auftraggeber entscheidet — Qualität zählt." },
  { id: "fastest", label: "Schnellste gute Arbeit", short: "Wer zuerst brauchbar liefert, gewinnt." },
  { id: "best_by_deadline", label: "Beste bis Stichtag", short: "Bis zur Frist einreichen — dann wird die beste gekürt." },
  { id: "community", label: "Community-Vote", short: "Andere Teilnehmer bewerten — höchster Score gewinnt." },
];

export const PROJECT_STATUS = {
  draft: "Entwurf",
  pending_review: "In Prüfung",
  open: "Offen",
  assigned: "Vergeben",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
  rejected: "Abgelehnt",
};

export const FEE_BPS = 1200; // 12 %
export const FEE_FREE_UNDER_CENTS = 10000; // unter 100 €

export function feeCents(amountCents, { hasTeam = false } = {}) {
  if (amountCents < FEE_FREE_UNDER_CENTS) return 0;
  let bps = FEE_BPS;
  if (hasTeam) bps += 300;
  return Math.floor((amountCents * bps) / 10000);
}

export function formatEUR(cents) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}

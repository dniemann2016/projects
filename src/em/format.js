const CAT_LABELS = {
  handwerk: "Handwerk",
  software: "Software",
  management: "Management",
  recht: "Recht",
  wissenschaft: "Wissenschaft",
  design: "Design",
  sonstiges: "Sonstiges",
};

export function catLabel(id) {
  return CAT_LABELS[id] || id;
}

export function formatEUR(cents) {
  if (!cents && cents !== 0) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export function projectTags(p) {
  const tags = [];
  if (p.ideaProtected || p.ndaLevel >= 3) tags.push({ label: "Geheime Idee · Realisierung", cls: "em-tag-protected" });
  else if (p.ndaLevel >= 2) tags.push({ label: "Geschützt · Stufe 2", cls: "em-tag-protected" });
  else if (p.ndaLevel === 1) tags.push({ label: "Realisierung · geschützt", cls: "em-tag-protected" });
  if (p.payModel === "contest") tags.push({ label: "Wettbewerb", cls: "em-tag-green" });
  else if (p.payModel === "time") tags.push({ label: "Auf Zeit", cls: "em-tag" });
  else if (p.payModel === "success") tags.push({ label: "Erfolgsbasiert", cls: "em-tag-green" });
  if (p.successFee && p.payModel !== "success") tags.push({ label: "Erfolgsbeteiligung", cls: "em-tag-green" });
  else if (p.successFee && p.payModel === "success") tags.push({ label: p.successFee.slice(0, 40), cls: "em-tag-green" });
  const mode = p.hiringMode || (p.teamRecommended ? "team" : "solo");
  if (mode === "team") tags.push({ label: "Team gesucht", cls: "em-tag-green" });
  else if (mode === "both") tags.push({ label: "Solo oder Team", cls: "em-tag-green" });
  else tags.push({ label: "Einzelperson", cls: "em-tag" });
  if (p.staffingStatus === "partial") tags.push({ label: p.staffingLabel || "Teilbesetzt", cls: "em-tag-amber" });
  else if (p.staffingStatus === "open" && mode !== "solo") tags.push({ label: "Stellen frei", cls: "em-tag" });
  else if (p.staffingStatus === "full") tags.push({ label: "Besetzt", cls: "em-tag" });
  return tags;
}

export const WORK_MODE_LABEL = {
  solo: "Nur solo",
  team: "Nur im Team",
  both: "Solo & Team",
};

export function workModeTag(mode) {
  const cls = mode === "solo" ? "em-tag" : mode === "team" ? "em-tag-green" : "em-tag-green";
  return { label: WORK_MODE_LABEL[mode] || mode, cls };
}


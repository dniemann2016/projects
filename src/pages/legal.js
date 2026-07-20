import { h } from "../shared/dom.js";
import { getLegalInfoSync } from "../shared/legalInfo.js";

const FALLBACK_IMPRESSUM = {
  name: "David Hammon",
  address: "Parkstr. 7\n82194 Gröbenzell\nDeutschland",
  email: "david.hammon@outlook.de",
  phone: null,
};

function impressumData() {
  return getLegalInfoSync()?.impressum || FALLBACK_IMPRESSUM;
}

const DOCS = [
  { id: "agb", label: "AGB" },
  { id: "haftung", label: "Haftungsausschluss" },
  { id: "datenschutz", label: "Datenschutz" },
  { id: "impressum", label: "Impressum" },
];

export function legalPage({ doc = "agb", onBack }) {
  const root = h("div", { class: "em-page", style: { maxWidth: 760, margin: "0 auto", padding: "calc(var(--apple-nav-h) + 32px) 22px 80px" } });
  const imp = impressumData();

  const nav = h("div", { style: { display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" } },
    h("button", { class: "em-btn em-btn-ghost", onClick: onBack }, "← Zurück"),
    ...DOCS.map((d) =>
      h("button", {
        class: "em-btn em-btn-ghost",
        style: { fontWeight: doc === d.id ? 600 : 400, color: doc === d.id ? "var(--apple-blue)" : "var(--apple-text-secondary)" },
        onClick: () => { root.replaceWith(legalPage({ doc: d.id, onBack })); },
      }, d.label)
    )
  );
  root.appendChild(nav);

  if (doc === "impressum") {
    root.appendChild(h("h1", { class: "apple-page-title", style: { textAlign: "left", fontSize: 32 } }, "Impressum"));
    root.appendChild(h("p", {}, `Verantwortlich: ${imp.name}`));
    for (const line of String(imp.address || "").split("\n").filter(Boolean)) {
      root.appendChild(h("p", { style: { margin: "4px 0" } }, line));
    }
    root.appendChild(h("p", {}, `E-Mail: ${imp.email}`));
    if (imp.phone) root.appendChild(h("p", {}, `Telefon: ${imp.phone}`));
    return root;
  }

  if (doc === "datenschutz") {
    root.appendChild(h("h1", { class: "apple-page-title", style: { textAlign: "left", fontSize: 32 } }, "Datenschutzerklärung"));
    root.appendChild(section("1. Verantwortlicher", `Verantwortlich ist ${imp.name}, ${imp.email}.`));
    root.appendChild(section("2. Welche Daten", "Profilname, Projektdaten, Nachrichten, Bewerbungen, NDA-Protokolle (Zeitpunkt, ggf. Name), Zahlungsmetadaten über Stripe, Zeitpunkt der AGB-Zustimmung."));
    root.appendChild(section("3. Identitätsprüfung", "Optional können Sie Ihr Profil über einen externen Anbieter (z. B. Persona, Veriff, Onfido) verifizieren lassen. Dabei werden Ausweisdaten und Video/Liveness direkt beim Anbieter verarbeitet — Projects speichert keine Ausweiskopien, nur das Ergebnis (verifiziert / abgelehnt) und den Zeitpunkt."));
    root.appendChild(section("4. Treuhand", "Zahlungen werden über Stripe abgewickelt. Kartendaten werden nicht auf unseren Servern gespeichert."));
    root.appendChild(section("5. Speicherort", "Standardmäßig lokal auf Ihrem Gerät bzw. dem von Ihnen betriebenen Server."));
    root.appendChild(section("6. Ihre Rechte", "Auskunft, Berichtigung, Löschung — per E-Mail an die oben genannte Adresse."));
    return root;
  }

  if (doc === "haftung") {
    root.appendChild(h("h1", { class: "apple-page-title", style: { textAlign: "left", fontSize: 32 } }, "Haftungsausschluss"));
    root.appendChild(h("p", { class: "em-muted", style: { marginBottom: 32 } }, "Stand: Juli 2026 · Projects · Håmmøn & Partner"));
    root.appendChild(h("div", { class: "apple-nda-blind", style: { textAlign: "left", marginBottom: 32 } },
      h("strong", {}, "Kurzfassung: "),
      "Projects vermittelt nur. Wir sind weder Arbeitgeber noch Vertragspartner zwischen Auftraggebern und Fachleuten. Für alles, was Nutzer tun oder lassen, haften wir nicht — soweit gesetzlich zulässig."
    ));

    const clauses = [
      ["1. Rolle der Plattform", "Projects ist eine technische Vermittlungsplattform. Wir schließen keine Werk-, Dienst- oder Arbeitsverträge zwischen Nutzern. Verträge entstehen ausschließlich zwischen Auftraggeber und Fachperson bzw. Team."],
      ["2. Keine Gewähr für Leistungen", "Wir garantieren nicht, dass Projekte erfüllt, pünktlich, mangelfrei oder fachgerecht erbracht werden. Wir garantieren nicht die Qualität, Eignung, Verfügbarkeit oder Identität von Nutzern — auch nicht bei „verifiziert“-Kennzeichnung."],
      ["3. Betrug, Abzocke, Insolvenz", "Wir haften nicht, wenn ein Unternehmen oder eine Person einen Nutzer betrügt, über den Tisch zieht, nicht zahlt, Leistungen vorenthält, bewusst schlechte Arbeit liefert oder zahlungsunfähig wird. Treuhand reduziert Risiken, beseitigt sie nicht vollständig."],
      ["4. Schlechte oder fehlende Leistung", "Wir haften nicht für Schäden aus nicht erbrachter, verspäteter, unvollständiger oder mangelhafter Arbeit — einschließlich Folgeschäden, entgangenem Gewinn, Datenverlust, Reputationsschäden oder Projektverzug."],
      ["5. NDA und Geheimhaltung", "NDA-Funktionen unterstützen die Geheimhaltung, ersetzen aber keine rechtliche Beratung und garantieren keinen vollständigen Schutz vor Weitergabe oder Missbrauch."],
      ["6. Teams und Bündnisse", "Wir haften nicht für interne Streitigkeiten, Honoraraufteilung, Ausfälle einzelner Teammitglieder oder falsche Teamzusagen."],
      ["7. Identitätsprüfung", "Eine Verifizierung (Ausweis, Video) wird über Drittanbieter durchgeführt. Wir haften nicht für Fehler, Ausfälle oder Fälschungen bei der Prüfung. „GEPRÜFT“ bedeutet: Prüfung zum Zeitpunkt bestanden — keine Garantie für künftiges Verhalten."],
      ["8. Technik und Verfügbarkeit", "Keine Garantie für unterbrechungsfreien Betrieb, Datenverlust, Bugs oder Ausfälle von Stripe, Verifizierungsanbietern oder sonstigen Diensten."],
      ["9. Keine Rechts-, Steuer- oder Arbeitsberatung", "Inhalte, Texte und Abläufe sind keine Rechts-, Steuer-, Arbeits- oder Finanzberatung. Scheinselbständigkeit und arbeitsrechtliche Fragen klärt der Nutzer selbst."],
      ["10. Haftungsumfang", "Soweit gesetzlich zulässig, ist jede Haftung des Betreibers — gleich aus welchem Rechtsgrund — ausgeschlossen. Dies gilt auch für leichte Fahrlässigkeit, soweit nicht zwingendes Verbraucherrecht entgegensteht. Eine Haftung für Vorsatz und grobe Fahrlässigkeit sowie nach dem Produkthaftungsgesetz bleibt unberührt."],
      ["11. Freistellung", "Nutzer stellen den Betreiber von Ansprüchen Dritter frei, die aus ihren Inhalten, Projekten, Verträgen oder Verstößen gegen diese Bedingungen entstehen."],
      ["12. Streitbeilegung", "Streitigkeiten zwischen Nutzern sind von diesen selbst zu klären. Die Plattform ist nicht verpflichtet, zu vermitteln oder Schiedsrichter zu sein."],
    ];
    clauses.forEach(([title, text]) => root.appendChild(section(title, text)));
    root.appendChild(h("p", { style: { fontSize: 12, color: "var(--apple-text-tertiary)", marginTop: 40 } },
      "Hinweis: Dieses Muster sollte vor Veröffentlichung von einem Rechtsanwalt geprüft werden."
    ));
    return root;
  }

  // AGB
  root.appendChild(h("h1", { class: "apple-page-title", style: { textAlign: "left", fontSize: 32 } }, "Allgemeine Geschäftsbedingungen"));
  root.appendChild(h("p", { class: "em-muted", style: { marginBottom: 32 } }, "Stand: Juli 2026 · Projects"));

  const clauses = [
    ["§1 Geltungsbereich", "Diese AGB gelten für die Nutzung von Projects (Web, Desktop). Mit Registrierung oder Nutzung akzeptieren Sie AGB, Datenschutz und den gesonderten Haftungsausschluss."],
    ["§2 Leistung", "Projects vermittelt Projekte, Teams und Leistungsangebote zwischen Auftraggebern und Fachleuten. Wir sind nicht Vertragspartei der zwischen Nutzern geschlossenen Verträge."],
    ["§3 Registrierung", "Registrierung erfolgt bei der ersten relevanten Handlung. Nutzer sind für die Richtigkeit ihrer Angaben verantwortlich."],
    ["§4 Treuhand", "Zahlungen können über Treuhand (Stripe) abgewickelt werden. Freigabe erfolgt nach vereinbarter Abnahme bzw. Ablauf der Prüffrist. Details siehe Projektseite."],
    ["§5 Gebühren", "Die Plattform erhebt eine Vermittlungsgebühr auf Auszahlungen (abhängig von Nutzerstufe). Frühboni und Erfolgsbeteiligungen werden zwischen Nutzern vereinbart."],
    ["§6 Geheimhaltung", "NDA-Stufen unterstützen den Schutz von Projektinhalten. Nutzer sind selbst für die Einhaltung verantwortlich."],
    ["§7 Verifizierung", "Optionale Profilverifizierung über externe Anbieter. Kosten können anfallen. Ergebnis wird als Badge angezeigt, ohne Garantie."],
    ["§8 Haftung", "Es gilt der gesonderte umfassende Haftungsausschluss. Soweit gesetzlich zulässig, ist die Haftung des Betreibers ausgeschlossen."],
    ["§9 Schlussbestimmungen", "Es gilt deutsches Recht. Gerichtsstand ist — soweit zulässig — der Sitz des Anbieters."],
  ];
  clauses.forEach(([title, text]) => root.appendChild(section(title, text)));
  root.appendChild(h("p", { style: { marginTop: 24 } },
    h("button", { class: "apple-link", type: "button", onClick: () => { root.replaceWith(legalPage({ doc: "haftung", onBack })); } }, "Zum vollständigen Haftungsausschluss ›")
  ));
  return root;
}

function section(title, text) {
  return h("div", { style: { marginBottom: 24 } },
    h("h2", { style: { fontSize: 17, fontWeight: 600, margin: "0 0 8px" } }, title),
    h("p", { style: { color: "var(--apple-text-secondary)", lineHeight: 1.55, margin: 0, fontSize: 15 } }, text)
  );
}

export function legalFooter({ onLegal }) {
  return h("div", { style: { display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", fontSize: 12, color: "var(--apple-text-tertiary)", marginTop: 24 } },
    ...DOCS.map((d) =>
      h("button", { style: { background: "none", border: "none", color: "var(--apple-text-secondary)", cursor: "pointer" }, onClick: () => onLegal(d.id) }, d.label)
    )
  );
}

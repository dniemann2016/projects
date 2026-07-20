import { getApiKey } from "./config.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

export class AnthropicNotConfigured extends Error {
  constructor() {
    super("Kein Anthropic API-Key hinterlegt. Bitte unter Konto → KI-Zugang eintragen.");
    this.name = "AnthropicNotConfigured";
  }
}

async function callMessages({ messages, maxTokens = 1000, tools }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new AnthropicNotConfigured();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages,
      ...(tools ? { tools } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API Fehler (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function analyzeStatement(statementText) {
  return callMessages({
    maxTokens: 1500,
    messages: [
      {
        role: "user",
        content: `Analysiere diesen Kontoauszug/Zahlungsexport. Finde ALLE wiederkehrenden Zahlungen (Abos, Mitgliedschaften, Mobilfunk etc.) und markiere verdächtige Abbuchungen (unbekannte Firmen, ausländische/unplausible IBANs, plötzliche Betragssprünge, generische Firmennamen). Antworte NUR mit validem JSON, ohne Markdown-Codeblock:
{"subs":[{"name":"...","amount":0.00,"iban":"...","suspicious":false,"reason":"..."}],"summary":"kurze Zusammenfassung auf Deutsch"}

Kontoauszug:
${statementText}`,
      },
    ],
  });
}

export function companyReport({ name, ibanCountry, amount }) {
  return callMessages({
    maxTokens: 900,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Erstelle einen kurzen Seriositäts-Bericht über die Firma "${name}" (IBAN-Land: ${ibanCountry || "unbekannt"}, monatliche Abbuchung: ${amount}€). Recherchiere: Existiert die Firma? Gibt es Betrugswarnungen oder auffällig viele Beschwerden? Ist der Betrag plausibel für diese Art von Dienstleistung? Bewerte das Risiko (niedrig/mittel/hoch) und begründe kurz. Max. 150 Wörter, auf Deutsch. Wichtig: Formuliere als Wahrscheinlichkeits-Einschätzung, nicht als Tatsachenbehauptung.`,
      },
    ],
  });
}

export function autoClassify(subs) {
  const compact = subs.map((s) => ({
    id: s.id, name: s.name, amount: s.amount, since: s.since,
    iban: s.iban ? s.iban.replace(/\s/g, "").slice(0, 2) : null,
    category: s.category, priceHistory: s.priceHistory,
  }));
  return callMessages({
    maxTokens: 1500,
    messages: [
      {
        role: "user",
        content: `Du bist ein Finanz-Sicherheits-Analyst. Ordne jedes dieser Abos/wiederkehrenden Zahlungen in genau eine Kategorie ein:
- "keep": bekannter seriöser Anbieter, Betrag plausibel
- "switch": läuft, aber Kündigung/Wechsel lohnt sich (starke Preiserhöhung, überteuert, selten genutzt laut Notiz)
- "warning": verdächtig (unbekannte Firma, ausländische IBAN ohne plausiblen Grund, Betrugsverdacht, plötzliche Betragssprünge)
- "pending": unklar, Nutzer sollte selbst prüfen (z.B. sehr alte nie überprüfte Verträge)

Antworte NUR mit validem JSON ohne Markdown:
{"results":[{"id":1,"status":"keep","reason":"kurze deutsche Begründung"}],"summary":"1-2 Sätze Gesamtfazit auf Deutsch"}

Abos:
${JSON.stringify(compact)}`,
      },
    ],
  });
}

export function investAnalysis({ monthly, years, risk, universe }) {
  const compact = universe.map((a) => ({ id: a.id, class: a.class, name: a.name, ret: a.ret, risk: a.risk, riskScore: a.riskScore, desc: a.desc }));
  return callMessages({
    maxTokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [
      {
        role: "user",
        content: `Du bist ein erfahrener Marktanalyst. Ein Nutzer will ${monthly}€/Monat (frei geworden durch gekündigte Abos) über ${years} Jahre investieren. Risikoprofil: ${risk}.

Analysiere den AKTUELLEN Markt mit Websuche: aktuelle Nachrichten weltweit, Zinsentscheidungen, geopolitische Lage, Branchentrends, angekündigte Fusionen/Zusammenschlüsse und deren Kausalketten (z.B. "Chip-Nachfrage durch KI-Rechenzentren → Energiebedarf → Uran/Versorger"). Berücksichtige auch vergangene Entwicklungen der Anlageklassen.

Wähle aus diesem Universum die 3-5 passendsten Anlagen (ETFs, Aktien, Anleihen, Rohstoffe oder Themen-Portfolios) und begründe jede Wahl mit deiner Analyse inkl. erkannter Kausalitäten und Nachrichtenlage:
${JSON.stringify(compact)}

Antworte NUR mit validem JSON ohne Markdown:
{"picks":[{"id":"...","warum":"2-3 Sätze: Marktlage, Nachrichten, Kausalkette","signal":"kauf-signal|beobachten|defensiv"}],"marktlage":"3-4 Sätze aktuelle Gesamtmarkt-Einschätzung auf Deutsch","risikohinweis":"1 Satz"}

Wichtig: Formuliere als Einschätzung/Wahrscheinlichkeit, nie als Garantie.`,
      },
    ],
  });
}

export function financeRadar({ topicId, topicTitle }) {
  const focus = {
    kredite: "Wo sind Ratenkredit- und Baufinanzierungszinsen in Deutschland aktuell am günstigsten (konkrete aktuelle Zinsspannen nennen)? Welche Banken/Portale haben gerade Aktionen?",
    waehrungen: "Wie steht der Euro-Dollar-Kurs aktuell und wie ist die Tendenz laut Nachrichtenlage? Wo tauscht man gerade am günstigsten (Anbieter-Vergleich)? Lohnen sich Fremdwährungs-Strategien aktuell?",
    immobilien: "Wie entwickeln sich Immobilienpreise und Bauzinsen in Deutschland gerade? Welche konkreten Spar-Taktiken sind in der aktuellen Marktlage am wirksamsten (Verhandlungsspielraum, Förderprogramme mit Fristen)?",
    "steuern-erbe": "Welche steuerlichen Freibeträge, Fristen oder Gesetzesänderungen (Erbschaft/Schenkung/Kapitalerträge) sind aktuell relevant oder ändern sich bald? Gibt es neue Urteile zu Gestaltungen wie der Ehegattenschaukel?",
    alltag: "Welche konkreten Spar-Aktionen laufen gerade in Deutschland (Strom/Gas-Wechselboni, Bank-Neukundenprämien, Cashback-Aktionen)? Mit Beträgen.",
    versicherungen: "Was ändert sich gerade am deutschen Versicherungsmarkt (KFZ-Beiträge, Prämienentwicklung)? Wo lohnt der Wechsel aktuell besonders?",
  }[topicId] || `Aktuelle Spartipps und Marktlage zum Thema ${topicTitle}.`;

  return callMessages({
    maxTokens: 1800,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content: `Du bist ein unabhängiger Finanz-Rechercheur. Recherchiere mit Websuche AKTUELL: ${focus}

Antworte NUR mit validem JSON ohne Markdown:
{"stand":"kurzes Datum/Aktualität","lage":"3-4 Sätze aktuelle Lage auf Deutsch","tipps":[{"titel":"...","text":"2-3 konkrete Sätze","ersparnis":"grobe Größenordnung oder null"}]}

3-5 Tipps. Konkret und aktuell, keine Allgemeinplätze. Formuliere als Information, nicht als Rechts-/Steuer-/Anlageberatung.`,
      },
    ],
  });
}

export function cancellationLetter({ name, since, note }) {
  return callMessages({
    maxTokens: 500,
    messages: [
      {
        role: "user",
        content: `Verfasse eine kurze, höfliche, aber bestimmte Kündigung für das Abo/den Vertrag "${name}" (Kunde seit ${since || "unbekannt"}). Kontext: ${note || "keiner"}. Format: Betreff-Zeile, dann Brieftext auf Deutsch, zum ordentlichen nächstmöglichen Termin, mit Bitte um schriftliche Bestätigung. Antworte NUR mit validem JSON ohne Markdown: {"subject":"...","body":"..."}`,
      },
    ],
  });
}

/** Schicht 3 der Analyse-Pipeline (Produktplan 5.3): Klassifiziert NUR die
 *  erkannten Kandidaten (nie den ganzen Auszug). Striktes JSON. */
export function enrichCandidates(candidates) {
  return callMessages({
    maxTokens: 1200,
    messages: [
      {
        role: "user",
        content: `Du bist ein Klassifizierer für Banktransaktionen. Antworte AUSSCHLIESSLICH mit JSON ohne Markdown.
INPUT: Liste erkannter wiederkehrender Zahlungen (Buchungstext, Betrag, Intervall):
${JSON.stringify(candidates)}

Für jede Zahlung in derselben Reihenfolge: {"results":[{"merchant_clean":"Klartext-Anbietername (z.B. 'PP.5678.PP ADOBE SYST' → 'Adobe Creative Cloud')","kategorie":"streaming|software|fitness|mobilfunk|versicherung|wohnen|energie|shopping|gaming|medien|sonstiges","kuendbar":true,"confidence":0.9}]}
Miete, Strom, Pflichtversicherungen: kuendbar=false.`,
      },
    ],
  });
}

export function brokerOffers({ brokers, monthly }) {
  const compact = brokers.map((b) => ({ id: b.id, name: b.name, sparplanCosts: b.sparplanCosts, depotFee: b.depotFee }));
  return callMessages({
    maxTokens: 1800,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [
      {
        role: "user",
        content: `Du bist ein neutraler Broker-Vergleicher. Ein Nutzer will einen ETF-Sparplan über ${monthly}€/Monat starten. Recherchiere mit Websuche die AKTUELLEN Angebote dieser deutschen Broker: Neukunden-Prämien, 0-€-Sparplan-Aktionen, Zins-Aktionen, befristete Boni (mit Fristen wenn bekannt):
${JSON.stringify(compact)}

Antworte NUR mit validem JSON ohne Markdown:
{"offers":[{"brokerId":"...","offer":"1-2 Sätze aktuelles Angebot/Prämie","costs":"Sparplan-Kosten kurz","fit":"1 Satz warum passend für ${monthly}€/Monat"}],"marktlage":"2 Sätze Gesamtlage Broker-Markt auf Deutsch"}

Nur Broker aus der Liste. Formuliere als Information ohne Gewähr, keine Anlageberatung.`,
      },
    ],
  });
}

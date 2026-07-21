import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { fmt } from "../shared/format.js";
import { api } from "../shared/api.js";
import { EXPORT_GUIDES } from "../shared/cancelLinks.js";
import { pageHeader, toast } from "../shared/ui.js";

// Der Kern-Funnel aus dem Produktplan: Upload → Analyse → Aha-Moment →
// Paywall → Umwidmungs-Flow. Funktioniert OHNE Registrierung bis zur Paywall.

const CAT_ICON = {
  streaming: "📺", software: "💻", fitness: "🏋️", mobilfunk: "📱",
  versicherung: "🛡", wohnen: "🏠", energie: "⚡", shopping: "🛒",
  gaming: "🎮", medien: "📰", dating: "💬", lebensmittel: "🥡",
  mobilitaet: "🚉", pflicht: "📋", sonstiges: "❓",
};

export function analysePage({ me = null, onNeedAccount, onUpgrade, onDone, onLegal }) {
  const root = h("div", {});
  let result = null;
  let files = [];
  let rededicated = {}; // itemIndex -> { cancelled, sparplan, booked }

  const uploadSlot = h("div", {});
  const resultSlot = h("div", {});
  root.append(uploadSlot, resultSlot);

  // ---------- Screen 2: Upload ----------
  function renderUpload() {
    const ta = h("textarea", {
      style: { ...S.input, minHeight: 130, fontFamily: "ui-monospace, monospace", fontSize: 12.5, marginTop: 10 },
      placeholder: "Oder Kontoauszug als Text einfügen:\n15.06.2026  NETFLIX INTERNATIONAL B.V.  -17,99\n01.06.2026  ADOBE SYSTEMS  -59,99\n…",
    });

    const fileInput = h("input", { type: "file", accept: ".pdf,.csv,.txt", multiple: true, style: { display: "none" } });
    const fileLabel = h("div", { style: { fontSize: 13, color: T.textDim, marginTop: 8, minHeight: 18 } });
    const drop = h("div", { class: "aw-dropzone" },
      h("div", { style: { fontSize: 34, marginBottom: 8 } }, "📄"),
      h("div", { style: { fontWeight: 600, fontSize: 15.5 } }, "Kontoauszug hierher ziehen oder klicken"),
      h("div", { style: { fontSize: 13, color: T.textDim, marginTop: 4 } }, "PDF oder CSV · mehrere Dateien · max. 10 MB · am besten die letzten 3 Monate")
    );
    drop.addEventListener("click", () => fileInput.click());
    drop.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.classList.add("is-drag"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
    drop.addEventListener("drop", (ev) => {
      ev.preventDefault();
      drop.classList.remove("is-drag");
      files = [...ev.dataTransfer.files].slice(0, 5);
      fileLabel.textContent = files.map((f) => f.name).join(" · ");
      if (files.length) toast(`${files.length} Datei${files.length > 1 ? "en" : ""} bereit`, { type: "ok", ms: 2200 });
    });
    fileInput.addEventListener("change", () => {
      files = [...fileInput.files].slice(0, 5);
      fileLabel.textContent = files.map((f) => f.name).join(" · ");
    });

    // Bank-Anleitungen ausklappbar (reduziert Support-Anfragen, Plan Screen 2).
    const banks = [["sparkasse", "Sparkasse"], ["ing", "ING"], ["dkb", "DKB"], ["n26", "N26"], ["comdirect", "comdirect"], ["paypal", "PayPal"]];
    const guideSlot = h("div", {});
    let openBank = null;
    function renderGuides() {
      mount(guideSlot,
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 } },
          ...banks.map(([id, name]) => {
            const b = h("button", { style: { ...S.btnGhost, padding: "6px 14px", fontSize: 12.5, borderColor: openBank === id ? T.blue : undefined, color: openBank === id ? T.blue : undefined } }, name);
            b.addEventListener("click", () => { openBank = openBank === id ? null : id; renderGuides(); });
            return b;
          })
        ),
        openBank
          ? h("div", { style: { padding: "12px 16px", background: "rgba(0,113,227,0.06)", borderRadius: 12, marginTop: 10 } },
              ...(EXPORT_GUIDES[openBank] || EXPORT_GUIDES.default).map((step, i) =>
                h("div", { style: { fontSize: 12.5, color: T.textDim, lineHeight: 1.7 } }, `${i + 1}. ${step}`)
              )
            )
          : null
      );
    }
    renderGuides();

    const consent = h("input", { type: "checkbox", id: "consent" });
    const msg = h("div", { style: { color: T.red, fontSize: 13, minHeight: 18, marginTop: 8 } });
    const goBtn = h("button", { class: "aw-btn aw-btn-primary", style: { padding: "13px 30px", fontSize: 16, marginTop: 14 } }, "Kostenlos analysieren →");
    goBtn.addEventListener("click", async () => {
      if (!consent.checked) {
        msg.textContent = "Bitte der Datenverarbeitung zustimmen.";
        toast("Bitte der Datenverarbeitung zustimmen.", { type: "err" });
        return;
      }
      if (!ta.value.trim() && files.length === 0) {
        msg.textContent = "Bitte Datei hochladen oder Text einfügen.";
        toast("Bitte Datei hochladen oder Text einfügen.", { type: "err" });
        return;
      }
      msg.textContent = "";
      goBtn.disabled = true;
      goBtn.textContent = "⏳ Analyse läuft…";
      try {
        result = await api.analyze.run(ta.value, files);
        renderResult();
        uploadSlot.style.display = "none";
        toast(`${result.found} wiederkehrende Zahlungen gefunden`, { type: "ok" });
      } catch (e) {
        msg.textContent = e.message;
        toast(e.message, { type: "err", ms: 4200 });
      }
      goBtn.disabled = false;
      goBtn.textContent = "Kostenlos analysieren →";
    });

    mount(uploadSlot,
      pageHeader(
        "Wie viel zahlst du für Dinge, die du vergessen hast?",
        h("span", {},
          "Lade deinen Kontoauszug hoch. Die Analyse findet jedes Abo — und zeigt dir, was daraus werden könnte. ",
          h("strong", {}, "Ohne Registrierung, ohne Kontoverbindung.")
        )
      ),
      drop, fileInput, fileLabel,
      guideSlot,
      ta,
      h("label", { for: "consent", style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: T.textDim, marginTop: 12, cursor: "pointer" } },
        consent,
        h("span", {},
          "Ich willige in die Verarbeitung meines Auszugs ein (Rohdaten werden nach der Analyse gelöscht) und akzeptiere die ",
          h("button", { type: "button", class: "aw-terms-link", onClick: (ev) => { ev.preventDefault(); onLegal?.("agb"); } }, "AGB"),
          " inkl. Haftungsausschluss (keine Finanzberatung)."
        )
      ),
      goBtn, msg,
      h("div", { style: { display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, fontSize: 12.5, color: T.textFaint } },
        h("span", {}, "✓ Auszüge werden nach der Analyse gelöscht"),
        h("span", {}, "✓ Keine Kontoverbindung nötig"),
        h("span", {}, "✓ Kein Zugriff auf dein Konto")
      )
    );
  }

  // ---------- Screen 3: Ergebnis mit Paywall ----------
  function projLine(p) {
    if (!p) return null;
    return h("div", { style: { marginTop: 10, padding: "10px 14px", background: "rgba(52,199,89,0.08)", borderRadius: 12 } },
      h("div", { style: { fontSize: 13, fontWeight: 650, color: T.green } },
        `${fmt(p.monthlyEUR)}/Monat → in ${p.years} Jahren: ${fmt(p.low)} – ${fmt(p.high)}*`
      ),
      h("div", { style: { fontSize: 11.5, color: T.textDim, marginTop: 2 } },
        `Mittleres Szenario (6 % p.a.): ≈ ${fmt(p.mid)} · eingezahlt: ${fmt(p.paidIn)}`
      )
    );
  }

  function itemCard(item, index) {
    const icon = CAT_ICON[item.merchantCategory] || "❓";
    const done = rededicated[index] || {};
    const isNecessary = item.kuendbar === false;

    const flowSlot = h("div", {});
    let flowOpen = false;

    const flowBtn = isNecessary ? null : h("button", { style: { ...S.btn, padding: "9px 18px", fontSize: 13.5, marginTop: 12 } }, "↗ Umwidmen — behalten fürs zukünftige Ich");
    flowBtn?.addEventListener("click", () => {
      if (!result.full) { onUpgrade?.(); return; }
      flowOpen = !flowOpen;
      renderFlow();
    });

    function renderFlow() {
      if (!flowOpen) { mount(flowSlot); return; }
      const state = rededicated[index] || (rededicated[index] = { cancelled: false, sparplan: false, booked: false });
      const letterSlot = h("div", {});

      const step = (n, label, doneFlag, content) =>
        h("div", { style: { padding: "14px 0", borderTop: "1px solid rgba(0,0,0,0.07)" } },
          h("div", { style: { display: "flex", gap: 10, alignItems: "center" } },
            h("span", { style: { width: 26, height: 26, borderRadius: "50%", background: doneFlag ? T.green : "#d5d5da", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 } }, doneFlag ? "✓" : String(n)),
            h("span", { style: { fontWeight: 650, fontSize: 14.5 } }, label)
          ),
          content
        );

      // Schritt 1: Kündigen
      const letterBtn = h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13 } }, "✉ Kündigungsschreiben erstellen");
      const custNr = h("input", { style: { ...S.input, width: 180, padding: "8px 12px", fontSize: 13 }, placeholder: "Kundennummer (optional)" });
      letterBtn.addEventListener("click", async () => {
        try {
          const letter = await api.analyze.letter({ merchantId: item.merchantId, merchantName: item.displayName, customerNumber: custNr.value, userName: me?.name });
          const copyBtn = h("button", { style: { ...S.btnGhost, padding: "6px 14px", fontSize: 12.5, marginTop: 8 } }, "In Zwischenablage kopieren");
          copyBtn.addEventListener("click", () => {
            navigator.clipboard?.writeText(letter.body);
            copyBtn.textContent = "✓ Kopiert";
            toast("Kündigungsschreiben kopiert", { type: "ok", ms: 2200 });
          });
          mount(letterSlot,
            h("div", { style: { marginTop: 10, padding: 14, background: "rgba(100,210,255,0.07)", borderRadius: 12, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6, color: T.textDim } }, letter.body),
            copyBtn
          );
        } catch (e) {
          mount(letterSlot, h("div", { style: { color: T.red, fontSize: 13, marginTop: 8 } }, e.message));
        }
      });
      const doneCancelBtn = h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13, color: T.green, borderColor: T.green + "66" } }, state.cancelled ? "✓ Gekündigt" : "Als gekündigt markieren");
      doneCancelBtn.addEventListener("click", () => { state.cancelled = !state.cancelled; renderFlow(); });

      const step1Content = h("div", { style: { marginLeft: 36, marginTop: 8 } },
        item.noticePeriod ? h("div", { style: { fontSize: 12.5, color: T.orange, marginBottom: 8 } }, `⏰ Frist: ${item.noticePeriod}`) : null,
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
          item.cancelUrl ? h("a", { href: item.cancelUrl, target: "_blank", rel: "noopener noreferrer", style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13, color: T.red, borderColor: T.red + "66", textDecoration: "none", display: "inline-block" } }, "Kündigungsseite öffnen →") : null,
          custNr, letterBtn, doneCancelBtn
        ),
        letterSlot
      );

      // Schritt 2: Umleiten — neutral, ohne Produktempfehlung (rote Linie 1).
      const amount = Math.ceil(item.monthlyEUR);
      const doneSparBtn = h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13, color: T.green, borderColor: T.green + "66" } }, state.sparplan ? "✓ Sparplan eingerichtet" : "Als eingerichtet markieren");
      doneSparBtn.addEventListener("click", () => { state.sparplan = !state.sparplan; renderFlow(); });
      const step2Content = h("div", { style: { marginLeft: 36, marginTop: 8 } },
        h("p", { style: { fontSize: 13.5, color: T.textDim, margin: "0 0 8px", lineHeight: 1.55 } },
          `Richte bei einem Broker deiner Wahl einen Sparplan über ${amount} € ein — derselbe Betrag, anderer Empfänger: dein Depot statt ${item.displayName}. `,
          "Welches Produkt du wählst, entscheidest du selbst beim Broker (Stichwort für den Einstieg: weltweit gestreuter ETF)."
        ),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h("button", {
            style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13 },
            onClick: () => onDone?.("depot"),
          }, "Broker-Vergleich öffnen (Depot-Tab)"),
          doneSparBtn
        )
      );

      // Schritt 3: Verbuchen
      const bookBtn = h("button", { style: { ...S.btn, padding: "9px 18px", fontSize: 13.5 } }, state.booked ? "✓ Verbucht" : "Umwidmung verbuchen");
      bookBtn.addEventListener("click", async () => {
        if (state.booked) return;
        if (!me) { onNeedAccount?.(); return; }
        try {
          await api.holdings.create({
            assetName: "Sparplan (Umwidmung)",
            monthlyEUR: item.monthlyEUR,
            swappedFromName: item.displayName,
            assetClass: "etf",
            note: `Umgewidmet aus ${item.displayName} (${fmt(item.monthlyEUR)}/Monat)`,
          });
          state.booked = true;
          renderFlow();
        } catch (e) {
          alert(e.message);
        }
      });
      const step3Content = h("div", { style: { marginLeft: 36, marginTop: 8 } },
        h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 8px" } }, "Zählt ab jetzt in deinem Vermögens-Dashboard als „umgewidmet“."),
        bookBtn
      );

      mount(flowSlot,
        h("div", { style: { marginTop: 14, padding: "4px 18px 14px", background: T.bgAlt, borderRadius: 14 } },
          step(1, "Kündigen", state.cancelled, step1Content),
          step(2, "Umleiten — Sparplan einrichten", state.sparplan, step2Content),
          step(3, "Verbuchen", state.booked, step3Content)
        )
      );
    }

    return h("div", { style: { ...S.card, padding: 20, marginBottom: 12 } },
      h("div", { style: { display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" } },
        h("span", { style: { fontSize: 30 } }, icon),
        h("div", { style: { flex: 1, minWidth: 220 } },
          h("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
            h("span", { style: { fontWeight: 650, fontSize: 16.5 } }, item.displayName),
            isNecessary
              ? h("span", { style: S.tag(T.textFaint) }, "notwendige Zahlung")
              : h("span", { style: S.tag(item.score >= 60 ? T.red : item.score >= 35 ? T.orange : T.blue) }, `Kündigungs-Kandidat: ${item.score}/100`)
          ),
          h("div", { style: { fontSize: 13, color: T.textDim, marginTop: 4 } },
            `${fmt(item.amount)} ${item.cycle} · zuletzt ${item.lastCharge || "—"}`,
            item.priceIncreaseDetected ? " · 📈 Preiserhöhung erkannt" : ""
          ),
          item.scoreReasons?.length ? h("div", { style: { fontSize: 12.5, color: T.orange, marginTop: 4 } }, item.scoreReasons.join(" · ")) : null,
          projLine(item.projection),
          flowBtn,
          flowSlot
        ),
        h("div", { style: { textAlign: "right" } },
          h("div", { style: { fontSize: 19, fontWeight: 700 } }, `${fmt(item.monthlyEUR)}`),
          h("div", { style: { fontSize: 11.5, color: T.textFaint } }, "pro Monat")
        )
      )
    );
  }

  function renderResult() {
    if (!result) return;
    if (result.found === 0) {
      mount(resultSlot,
        h("div", { style: { ...S.card, marginTop: 20, color: T.textDim } }, result.message || "Nichts gefunden."),
        backBtn()
      );
      return;
    }

    const adoptBtn = me
      ? (() => {
          const b = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13.5 } }, "In mein Konto übernehmen");
          b.addEventListener("click", async () => {
            try {
              const r = await api.analyze.adopt(result.items);
              b.textContent = `✓ ${r.created} Abos übernommen`;
            } catch (e) { b.textContent = e.message; }
          });
          return b;
        })()
      : null;

    mount(resultSlot,
      h("div", { style: { textAlign: "center", padding: "26px 0 20px" } },
        h("div", { style: { fontSize: 14, color: T.textDim } }, `${result.transactions} Umsätze analysiert`),
        h("div", { style: { fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "6px 0" } },
          `Gefunden: ${result.found} wiederkehrende Zahlungen · ${fmt(result.totalMonthly)}/Monat`
        ),
        result.totalProjection
          ? h("div", { style: { fontSize: 16, color: T.green, fontWeight: 600 } },
              `Würdest du alles umwidmen: ≈ ${fmt(result.totalProjection.mid)} in ${result.totalProjection.years} Jahren*`
            )
          : null
      ),
      ...result.items.map((item, i) => itemCard(item, i)),
      // Paywall-Teaser: verschwommene Karten + Summen-Anzeige (Plan 3.2).
      result.locked > 0 ? lockedTeaser() : null,
      h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 } }, adoptBtn, backBtn()),
      h("p", { style: { fontSize: 11.5, color: T.textFaint, marginTop: 20, lineHeight: 1.6 } },
        "*" + (result.disclaimer || "Modellrechnung mit historischen Durchschnittswerten. Keine Garantie, keine Anlageberatung.")
      )
    );
  }

  function lockedTeaser() {
    const blurCards = h("div", { style: { position: "relative" } },
      ...(result.lockedPreview || []).slice(0, 4).map((p) =>
        h("div", { style: { ...S.card, padding: 20, marginBottom: 12, filter: "blur(6px)", userSelect: "none", pointerEvents: "none" } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } },
            h("span", { style: { fontWeight: 650 } }, `${CAT_ICON[p.category] || "❓"} ${"█".repeat(10)}`),
            h("span", { style: { fontWeight: 700 } }, fmt(p.monthlyEUR))
          )
        )
      ),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
        h("div", { style: { ...S.card, padding: 28, textAlign: "center", maxWidth: 420, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" } },
          h("div", { style: { fontSize: 17, fontWeight: 700, marginBottom: 6 } },
            `${result.locked} weitere gefunden — geschätztes Potenzial: ${fmt(result.lockedMonthly)}/Monat`
          ),
          h("p", { style: { fontSize: 13.5, color: T.textDim, margin: "0 0 14px", lineHeight: 1.5 } },
            "Vollständige Liste, alle Kündigungsschreiben und der Umwidmungsplan:"
          ),
          h("div", { style: { display: "grid", gap: 8 } },
            h("button", { style: { ...S.btn, width: "100%" }, onClick: () => onUpgrade?.("check") }, "Einmal-Analyse — 9,99 € (kein Abo)"),
            h("button", { style: { ...S.btnGhost, width: "100%" }, onClick: () => onUpgrade?.("pro") }, "Pro — 4,99 €/Monat oder 39 €/Jahr")
          )
        )
      )
    );
    return blurCards;
  }

  function backBtn() {
    const b = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13.5 } }, "← Neue Analyse");
    b.addEventListener("click", () => {
      result = null;
      files = [];
      mount(resultSlot);
      uploadSlot.style.display = "block";
    });
    return b;
  }

  renderUpload();

  return {
    el: root,
    update({ me: newMe } = {}) {
      if (newMe !== undefined) me = newMe;
    },
  };
}

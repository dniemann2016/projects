import { h, svg, mount } from "../shared/dom.js";
import { T, S, statusCfg } from "../shared/tokens.js";
import { pageHeader } from "../shared/ui.js";
import { reveal } from "../shared/scrollReveal.js";
import { growthChart } from "../shared/growthChart.js";
import { fmt, futureValue, monthsSince } from "../shared/format.js";
import { api } from "../shared/api.js";

// 0-100 health score: rewards low suspicious share and reviewed subscriptions, penalizes stale unreviewed ones.
function healthScore(subs) {
  if (subs.length === 0) return 100;
  const warn = subs.filter((s) => s.status === "warning").length;
  const pendingOld = subs.filter((s) => s.status === "pending" && monthsSince(s.since) >= 24).length;
  const reviewed = subs.filter((s) => s.status === "keep" || s.status === "switch").length;
  let score = 100;
  score -= warn * 18;
  score -= pendingOld * 8;
  score += Math.min(10, reviewed * 1.5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function dashboardPage({ subs: initialSubs, aiEnabled: initialAi, holdings: initialHoldings = [], onFilterWarning, onRefresh, onGoTo }) {
  let subs = initialSubs;
  let aiEnabled = initialAi;
  let holdings = initialHoldings;

  const scanBtn = h("button", { class: "aw-btn aw-btn-primary" }, "◎ Konten scannen — ohne KI");
  const autoCheckBtn = h("button", { class: "aw-btn aw-btn-ghost", style: { display: aiEnabled ? "inline-flex" : "none" } }, "✦ KI-Feinanalyse");
  const resultSlot = h("div", {});
  const el = h("div", {});

  scanBtn.addEventListener("click", async () => {
    scanBtn.disabled = true;
    scanBtn.style.opacity = "0.6";
    scanBtn.textContent = "⏳ Algorithmus scannt…";
    mount(resultSlot);
    try {
      const res = await api.scan.run();
      renderResult({ summary: res.summary, engine: "algorithmus", results: [] });
      onRefresh?.();
    } catch (e) {
      renderResult({ summary: e.message, engine: "fehler", results: [] });
    }
    scanBtn.disabled = false;
    scanBtn.style.opacity = "1";
    scanBtn.textContent = "◎ Konten scannen — ohne KI";
  });

  autoCheckBtn.addEventListener("click", async () => {
    autoCheckBtn.disabled = true;
    autoCheckBtn.style.opacity = "0.6";
    autoCheckBtn.textContent = "⏳ KI prüft alle Abos…";
    mount(resultSlot);
    try {
      const res = await api.ai.autoClassify();
      renderResult(res);
      onRefresh?.();
    } catch (e) {
      renderResult({ summary: e.message, engine: "fehler", results: [] });
    }
    autoCheckBtn.disabled = false;
    autoCheckBtn.style.opacity = "1";
    autoCheckBtn.textContent = "✦ KI-Feinanalyse";
  });

  function renderResult(checkResult) {
    const badgeColor = checkResult.engine === "ki" ? T.purple : checkResult.engine === "fehler" ? T.red : T.blue;
    const title =
      checkResult.engine === "ki" ? "✦ KI-Analyse abgeschlossen" :
      checkResult.engine === "algorithmus" ? "◎ Algorithmus-Scan abgeschlossen" :
      checkResult.engine === "basis" ? "🛡 Basis-Check abgeschlossen" : "Fehler";
    const tags = (checkResult.results || [])
      .map((r) => {
        const sub = subs.find((s) => s.id === r.id);
        const cfg = statusCfg[r.status];
        if (!cfg) return null;
        const tag = h("span", { style: S.tag(cfg.color), title: r.reason }, `${cfg.icon} ${sub?.name || `#${r.id}`}`);
        return tag;
      })
      .filter(Boolean);

    mount(
      resultSlot,
      reveal(
        h("div", { style: { ...S.card, marginBottom: 32 } },
          h("div", { style: { fontWeight: 650, marginBottom: 8, color: badgeColor } }, title),
          h("p", { style: { fontSize: 14, color: T.textDim, margin: "0 0 12px", lineHeight: 1.5 } }, checkResult.summary),
          tags.length > 0 ? h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, ...tags) : null
        )
      )
    );
  }

  function renderBody() {
  const switchedSum = subs.filter((s) => s.status === "switch").reduce((a, s) => a + s.amount, 0);
  const totalMonthly = subs.filter((s) => !s.paused).reduce((a, s) => a + s.amount, 0);
  const warnings = subs.filter((s) => s.status === "warning");
  const score = healthScore(subs);
  const scoreColor = score >= 75 ? T.green : score >= 45 ? T.orange : T.red;

  // Umwidmungs-Tracker (Plan Screen 5): verbuchte Sparpläne aus dem Depot.
  const rededicatedMonthly = holdings.reduce((a, hd) => a + (Number(hd.monthlyEUR) || 0), 0);
  const paidToFutureSelf = holdings.reduce((a, hd) => {
    const start = hd.acquiredAt ? new Date(hd.acquiredAt) : new Date();
    const months = Math.max(0, (Date.now() - start.getTime()) / (86400000 * 30.44));
    return a + (Number(hd.monthlyEUR) || 0) * months;
  }, 0);

  // Screen 5 (Produktplan): der Motivations-Kern mit Zwei-Linien-Kurve.
  const rededicationPanel = rededicatedMonthly > 0
    ? reveal(
        h("div", { style: { ...S.card, marginBottom: 32, padding: 32, background: "linear-gradient(135deg, rgba(52,199,89,0.07), rgba(100,210,255,0.06))" } },
          h("div", { style: { fontWeight: 650, fontSize: 16, marginBottom: 14 } }, "💚 Dein Vermögens-Kontoauszug"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 18 } },
            h("div", {},
              h("div", { style: { fontSize: 13, color: T.textDim } }, "Seit deinem Start umgewidmet"),
              h("div", { style: { fontSize: 24, fontWeight: 700, color: T.green } }, `${fmt(rededicatedMonthly)}/Monat`)
            ),
            h("div", {},
              h("div", { style: { fontSize: 13, color: T.textDim } }, "Bisher an dein zukünftiges Ich gezahlt"),
              h("div", { style: { fontSize: 24, fontWeight: 700 } }, fmt(paidToFutureSelf))
            ),
            h("div", {},
              h("div", { style: { fontSize: 13, color: T.textDim } }, "Projektion in 25 Jahren (6 % p.a.)"),
              h("div", { style: { fontSize: 24, fontWeight: 700, color: T.teal } }, `≈ ${fmt(futureValue(rededicatedMonthly, 6, 25))}`)
            )
          ),
          growthChart({ monthly: rededicatedMonthly, ret: 6, years: 25 }),
          h("div", { style: { fontSize: 11.5, color: T.textFaint, marginTop: 8 } },
            "Kumulierte Umwidmungen mit Zinseszins vs. was sonst in Abos geflossen wäre. Modellrechnung, keine Garantie, keine Anlageberatung."
          )
        )
      )
    : null;

  const statCards = [
    ["Monatliche Abo-Kosten", fmt(totalMonthly), T.text],
    ["Umwandlungs-Potenzial", fmt(switchedSum) + "/Monat", T.green],
    ["Warnungen", warnings.length + " verdächtige Zahlung" + (warnings.length !== 1 ? "en" : ""), T.red],
    ["In 25 J. (bei 7,1% p.a.)", "≈ " + fmt(futureValue(switchedSum, 7.1, 25)), T.teal],
  ];

  const circumference = 2 * Math.PI * 40;
  const scoreCircle = svg("circle", {
    cx: "46", cy: "46", r: "40", fill: "none", stroke: scoreColor, "stroke-width": "8", "stroke-linecap": "round",
    "stroke-dasharray": String(circumference), "stroke-dashoffset": String(circumference * (1 - score / 100)),
    transform: "rotate(-90 46 46)", style: { transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" },
  });
  const scoreSvg = svg("svg", { width: "92", height: "92", viewBox: "0 0 92 92" });
  scoreSvg.append(
    svg("circle", { cx: "46", cy: "46", r: "40", fill: "none", stroke: T.border, "stroke-width": "8" }),
    scoreCircle
  );

  const emptyState =
    subs.length === 0
      ? h("div", { class: "aw-card", style: { marginBottom: 28, textAlign: "center", padding: 40 } },
          h("div", { style: { fontSize: 40, marginBottom: 10 } }, "📊"),
          h("div", { style: { fontWeight: 600, fontSize: 18, marginBottom: 6 } }, "Noch keine Abos erkannt"),
          h("p", { style: { color: T.textDim, fontSize: 14, margin: "0 0 20px", lineHeight: 1.55, maxWidth: 420, marginLeft: "auto", marginRight: "auto" } },
            "Am schnellsten: Kontoauszug hochladen und kostenlos analysieren. Oder Konten verbinden und den Algorithmus-Scan starten."
          ),
          h("div", { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" } },
            (() => {
              const b = h("button", { class: "aw-btn aw-btn-primary", style: { padding: "10px 20px", fontSize: 14 } }, "Kontoauszug analysieren →");
              b.addEventListener("click", () => onGoTo?.("analyse"));
              return b;
            })(),
            (() => {
              const b = h("button", { class: "aw-btn aw-btn-ghost", style: { padding: "10px 20px", fontSize: 14 } }, "Konten verbinden");
              b.addEventListener("click", () => onGoTo?.("konten"));
              return b;
            })()
          )
        )
      : null;

  const root = h(
    "div",
    {},
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8 } },
      reveal(pageHeader("Übersicht", `${subs.length} erkannte wiederkehrende Zahlungen`), { delay: 0.05 }),
      reveal(h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", alignSelf: "flex-end" } }, scanBtn, autoCheckBtn), { delay: 0.1 })
    ),
    resultSlot,
    emptyState,
    rededicationPanel,
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 32 } },
      ...statCards.map(([l, v, c], i) =>
        reveal(
          h("div", { style: S.card },
            h("div", { style: { fontSize: 13, color: T.textDim, marginBottom: 8 } }, l),
            h("div", { style: { fontSize: 24, fontWeight: 700, color: c, letterSpacing: "-0.5px" } }, v)
          ),
          { delay: i * 0.08 }
        )
      )
    ),
    reveal(
      h("div", { style: { ...S.card, marginBottom: 32, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" } },
        h("div", { style: { position: "relative", width: 92, height: 92, flexShrink: 0 } },
          scoreSvg,
          h("div", { style: { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: scoreColor } }, String(score))
        ),
        h("div", {},
          h("div", { style: { fontWeight: 650, fontSize: 16 } }, "Abo-Gesundheits-Score"),
          h("div", { style: { fontSize: 13.5, color: T.textDim, marginTop: 4, maxWidth: "480px" } },
            score >= 75 ? "Sehr gut — deine Abos sind größtenteils überprüft und unbedenklich." :
            score >= 45 ? "Mittel — einige Abos sollten noch geprüft werden." :
            "Achtung — mehrere verdächtige oder lange unüberprüfte Abos."
          )
        )
      )
    ),
    warnings.length > 0
      ? reveal(
          h("div", { style: { ...S.card, borderColor: "rgba(255,69,58,0.35)", background: "rgba(255,69,58,0.06)", marginBottom: 32 } },
            h("div", { style: { fontWeight: 650, color: T.red, marginBottom: 12 } }, "⚠ Verdächtige Abbuchungen erkannt"),
            ...warnings.map((w) =>
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${T.border}`, gap: 12, flexWrap: "wrap" } },
                h("div", {},
                  h("div", { style: { fontWeight: 600 } }, `${w.name} · ${fmt(w.amount)}`),
                  h("div", { style: { fontSize: 13, color: T.textDim } }, w.note)
                ),
                h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13, borderColor: T.red, color: T.red }, onClick: onFilterWarning }, "Prüfen →")
              )
            )
          )
        )
      : null,
    reveal(
      h("div", { style: { ...S.card, padding: 32 } },
        h("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 } },
          h("div", {},
            h("div", { style: { fontSize: 14, color: T.textDim } },
              `Wenn du deine ${subs.filter((s) => s.status === "switch").length} markierten Abos umwandelst (${fmt(switchedSum)}/Monat, MSCI World, 25 Jahre)`
            ),
            h("div", { style: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.5px" } }, `≈ ${fmt(futureValue(switchedSum, 7.1, 25))} Vermögen`)
          ),
          h("div", { style: { ...S.tag(T.green), alignSelf: "center", fontSize: 14 } }, `+${fmt((futureValue(switchedSum, 7.1, 25) * 0.04) / 12)}/Monat Renten-Boost*`)
        ),
        growthChart({ monthly: switchedSum || 1, ret: 7.1, years: 25 })
      )
    )
  );

  return root;
  }

  mount(el, renderBody());

  return {
    el,
    update({ subs: newSubs, aiEnabled: newAi, holdings: newHoldings } = {}) {
      if (newSubs) subs = newSubs;
      if (newHoldings) holdings = newHoldings;
      if (newAi !== undefined) {
        aiEnabled = newAi;
        autoCheckBtn.style.display = aiEnabled ? "inline-block" : "none";
      }
      mount(el, renderBody());
    },
  };
}

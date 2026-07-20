import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { reveal } from "../shared/scrollReveal.js";
import { api } from "../shared/api.js";

// Finanz-Radar: curated everyday-finance tactics per topic, plus optional
// live AI research (web search) that layers the current market situation on top.
export function financeRadarPage({ aiEnabled: initialAi } = {}) {
  let aiEnabled = Boolean(initialAi);
  let topics = [];
  let openTopicId = null;
  const aiResults = {}; // topicId -> parsed result
  let aiLoadingId = null;

  const gridSlot = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 } });
  const detailSlot = h("div", {});

  async function runAiResearch(topic) {
    aiLoadingId = topic.id;
    renderDetail();
    try {
      aiResults[topic.id] = await api.ai.financeRadar({ topicId: topic.id, topicTitle: topic.title });
    } catch (e) {
      aiResults[topic.id] = { error: e.message };
    }
    aiLoadingId = null;
    renderDetail();
  }

  function renderGrid() {
    mount(
      gridSlot,
      ...topics.map((t, i) => {
        const active = openTopicId === t.id;
        const card = h(
          "div",
          {
            style: {
              ...S.card, padding: 20, cursor: "pointer", transition: "all 0.2s",
              borderColor: active ? T.teal : T.border,
              background: active ? "rgba(100,210,255,0.07)" : T.bgCard,
            },
          },
          h("div", { style: { fontSize: 28, marginBottom: 8 } }, t.icon),
          h("div", { style: { fontWeight: 650, fontSize: 16 } }, t.title),
          h("div", { style: { fontSize: 13, color: T.textDim, marginTop: 4, lineHeight: 1.5 } }, t.intro),
          h("div", { style: { fontSize: 12.5, color: T.teal, marginTop: 10, fontWeight: 600 } }, active ? "▲ Schließen" : `${t.tips.length} Taktiken ansehen →`)
        );
        card.addEventListener("click", () => {
          openTopicId = active ? null : t.id;
          renderGrid();
          renderDetail();
          if (!active) detailSlot.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return reveal(card, { delay: i * 0.05 });
      })
    );
  }

  function renderDetail() {
    const topic = topics.find((t) => t.id === openTopicId);
    if (!topic) { mount(detailSlot); return; }

    const ai = aiResults[topic.id];
    let aiBtn;
    if (aiEnabled) {
      aiBtn = h(
        "button",
        { style: { ...S.btn, padding: "11px 22px", fontSize: 14 } },
        aiLoadingId === topic.id ? "⏳ KI recherchiert aktuelle Lage…" : "✦ Aktuelle Lage per KI recherchieren"
      );
      aiBtn.disabled = aiLoadingId === topic.id;
      aiBtn.addEventListener("click", () => runAiResearch(topic));
    } else {
      aiBtn = h("div", { style: { fontSize: 12.5, color: T.textFaint } }, "✦ Live-KI-Recherche ausgeschaltet — aktivierbar unter Einstellungen → KI-Funktionen.");
    }

    mount(
      detailSlot,
      h(
        "div",
        { style: { ...S.card, marginBottom: 24 } },
        h("div", { style: { fontWeight: 700, fontSize: 20, marginBottom: 4 } }, `${topic.icon} ${topic.title}`),
        h("p", { style: { fontSize: 13.5, color: T.textDim, margin: "0 0 18px" } }, topic.intro),
        h(
          "div",
          { style: { display: "grid", gap: 12, marginBottom: 20 } },
          ...topic.tips.map((tip) =>
            h(
              "div",
              { style: { padding: 16, background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}`, borderRadius: 14 } },
              h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 } },
                h("span", { style: { fontWeight: 650, fontSize: 14.5 } }, tip.title),
                tip.saving ? h("span", { style: S.tag(T.green) }, `💰 ${tip.saving}`) : null
              ),
              h("p", { style: { fontSize: 13.5, color: T.textDim, margin: 0, lineHeight: 1.55 } }, tip.text)
            )
          )
        ),
        aiBtn,
        ai
          ? ai.error
            ? h("div", { style: { color: T.red, fontSize: 13.5, marginTop: 14 } }, ai.error)
            : h(
                "div",
                { style: { marginTop: 18, padding: 18, background: "rgba(191,90,242,0.07)", border: "1px solid rgba(191,90,242,0.25)", borderRadius: 14 } },
                h("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 } },
                  h("span", { style: { ...S.tag(T.purple) } }, "✦ Live-KI-Recherche"),
                  ai.stand ? h("span", { style: { fontSize: 12, color: T.textFaint } }, `Stand: ${ai.stand}`) : null
                ),
                h("p", { style: { fontSize: 14, color: T.textDim, lineHeight: 1.55, margin: "0 0 12px" } }, ai.lage),
                h("div", { style: { display: "grid", gap: 10 } },
                  ...(ai.tipps || []).map((tip) =>
                    h("div", { style: { padding: 14, background: "rgba(0,0,0,0.04)", borderRadius: 12 } },
                      h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 } },
                        h("span", { style: { fontWeight: 650, fontSize: 13.5 } }, tip.titel),
                        tip.ersparnis ? h("span", { style: S.tag(T.green) }, `💰 ${tip.ersparnis}`) : null
                      ),
                      h("p", { style: { fontSize: 13, color: T.textDim, margin: 0, lineHeight: 1.5 } }, tip.text)
                    )
                  )
                )
              )
          : null
      )
    );
  }

  api.tips.list().then((list) => {
    topics = list;
    renderGrid();
  });

  const el = h(
    "div",
    {},
    h("h1", { style: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" } }, "🧭 Finanz-Radar"),
    h("p", { style: { color: T.textDim, margin: "0 0 24px", maxWidth: 640, lineHeight: 1.55 } },
      "Alltags-Taktiken, mit denen du bei Krediten, Währungen, Immobilien, Steuern und Versicherungen Geld liegen lässt — plus KI-Recherche zur aktuellen Marktlage pro Thema."
    ),
    gridSlot,
    detailSlot,
    h("p", { style: { fontSize: 11.5, color: T.textFaint, lineHeight: 1.6, maxWidth: 720 } },
      "Alle Inhalte sind allgemeine Informationen und Modellbeispiele — keine Rechts-, Steuer- oder Anlageberatung. Steuerliche Gestaltungen (z.B. Ehegattenschaukel, Schenkungen) immer mit Steuerberater:in umsetzen; Regeln und Freibeträge können sich ändern."
    )
  );

  return {
    el,
    update({ aiEnabled: newAi } = {}) {
      if (newAi !== undefined && newAi !== aiEnabled) {
        aiEnabled = newAi;
        renderDetail();
      }
    },
  };
}

import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { fmt } from "../shared/format.js";
import { api } from "../shared/api.js";

export function portfolioPage({ holdings = [], onReload }) {
  const root = h("div", {});

  const monthlyTotal = holdings.reduce((a, h) => a + (h.monthlyEUR || 0), 0);

  root.appendChild(
    h("div", { style: { marginBottom: 24 } },
      h("h1", { style: { fontSize: 28, fontWeight: 600, margin: "0 0 6px" } }, "Depot & Tausch-Historie"),
      h("p", { style: { color: T.textDim, margin: 0 } }, `${holdings.length} Positionen · ${fmt(monthlyTotal)}/Monat Sparplan-Umfang`)
    )
  );

  if (holdings.length === 0) {
    root.appendChild(
      h("div", { style: { ...S.card, padding: 32, textAlign: "center" } },
        h("p", { style: { color: T.textDim } }, "Noch keine Tausch-Positionen. Markiere ein Abo als „Tausch“ und bestätige einen ETF/Aktien-Sparplan — oder lege manuell an.")
      )
    );
  } else {
    holdings.forEach((item) => {
      root.appendChild(
        h("div", { style: { ...S.card, padding: 20, marginBottom: 12 } },
          h("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } },
            h("div", {},
              h("div", { style: { fontWeight: 650, fontSize: 16 } }, item.assetName),
              h("div", { style: { fontSize: 13, color: T.textDim } }, `${item.assetClass?.toUpperCase() || "ETF"}${item.isin ? ` · ISIN ${item.isin}` : ""}${item.broker ? ` · ${item.broker}` : ""}`)
            ),
            h("div", { style: { textAlign: "right" } },
              h("div", { style: { fontWeight: 700 } }, `${fmt(item.monthlyEUR)}/Mon.`),
              h("div", { style: { fontSize: 12, color: T.green } }, item.matchType || "Tausch")
            )
          ),
          item.swappedFromName
            ? h("div", { style: { marginTop: 10, fontSize: 13, color: T.textDim } }, `↳ Statt Abo „${item.swappedFromName}" (seit ${item.acquiredAt})`)
            : null,
          h("button", {
            style: { ...S.btnGhost, marginTop: 12, fontSize: 12, color: T.red },
            onClick: async () => {
              await api.holdings.remove(item.id);
              onReload?.();
            },
          }, "Entfernen")
        )
      );
    });
  }

  const form = h("div", { style: { ...S.card, padding: 20, marginTop: 24 } },
    h("div", { style: { fontWeight: 650, marginBottom: 12 } }, "Position manuell hinzufügen")
  );
  const nameInput = h("input", { style: S.input, placeholder: "z. B. MSCI World ETF" });
  const isinInput = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "ISIN (optional)" });
  const monthlyInput = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "Monatlicher Betrag", inputmode: "decimal" });
  const fromInput = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "Getauscht statt Abo (optional)" });
  form.append(nameInput, isinInput, monthlyInput, fromInput);
  const addBtn = h("button", { style: { ...S.btn, marginTop: 12 } }, "Hinzufügen");
  addBtn.addEventListener("click", async () => {
    await api.holdings.create({
      assetName: nameInput.value,
      isin: isinInput.value,
      monthlyEUR: Number(monthlyInput.value) || 0,
      swappedFromName: fromInput.value,
      assetClass: "etf",
    });
    onReload?.();
  });
  form.appendChild(addBtn);
  root.appendChild(form);

  // Broker-Angebote: KI recherchiert aktuelle Prämien; Links sind Affiliate-Links (Werbung).
  const brokerSlot = h("div", { style: { marginTop: 24 } });
  root.appendChild(brokerSlot);

  function renderBrokerCard(offer) {
    return h("div", { style: { ...S.card, padding: 18, marginBottom: 10 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" } },
        h("div", {},
          h("div", { style: { fontWeight: 650, fontSize: 15 } }, offer.name,
            offer.isAffiliate ? h("span", { style: { fontSize: 10.5, color: T.textFaint, marginLeft: 8, fontWeight: 400 } }, "Anzeige*") : null
          ),
          h("div", { style: { fontSize: 13, color: T.textDim, marginTop: 4 } }, offer.offer || offer.costs || ""),
          offer.fit ? h("div", { style: { fontSize: 12.5, color: T.green, marginTop: 4 } }, offer.fit) : null
        ),
        h("a", {
          href: offer.url,
          target: "_blank",
          rel: "noopener noreferrer",
          style: { ...S.btn, padding: "9px 18px", fontSize: 13.5, textDecoration: "none", whiteSpace: "nowrap" },
        }, "Depot eröffnen →")
      )
    );
  }

  function renderBrokers(offers = null, note = "", loading = false) {
    const kiBtn = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13.5 }, disabled: loading },
      loading ? "⏳ KI recherchiert aktuelle Angebote…" : "✦ KI: Aktuelle Broker-Angebote finden");
    kiBtn.addEventListener("click", async () => {
      renderBrokers(offers, note, true);
      try {
        const res = await api.brokers.offers(monthlyTotal || 50);
        renderBrokers(res.offers, res.marktlage || res.note || "");
      } catch (e) {
        renderBrokers(offers, e.message);
      }
    });

    mount(brokerSlot,
      h("div", { style: { fontWeight: 650, fontSize: 17, marginBottom: 4 } }, "Noch kein Depot? Broker-Vergleich"),
      h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 12px", lineHeight: 1.5 } },
        "Für ETF-Sparpläne brauchst du ein Depot. Die KI recherchiert aktuelle Neukunden-Prämien und 0-€-Aktionen (kostet Prompts). *Mit Sternchen markierte Links sind Partner-Links."
      ),
      kiBtn,
      note ? h("div", { style: { fontSize: 12.5, color: T.textDim, margin: "10px 0" } }, note) : null,
      h("div", { style: { marginTop: 12 } }, ...(offers || []).map(renderBrokerCard))
    );

    if (!offers) {
      api.brokers.list().then((brokers) => {
        renderBrokers(brokers.map((b) => ({
          brokerId: b.id, name: b.name, url: b.url, isAffiliate: b.isAffiliate,
          offer: b.highlight, costs: b.sparplanCosts,
        })), note);
      }).catch(() => {});
    }
  }
  renderBrokers();

  return { el: root, update({ holdings: h2 }) { mount(root, portfolioPage({ holdings: h2, onReload }).el); } };
}

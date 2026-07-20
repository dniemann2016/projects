import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { fmt } from "../shared/format.js";
import { api } from "../shared/api.js";

// Impact-Tab (Produktplan Kap. 8, Weg A): kuratierte Startup-Projekte einer
// lizenzierten Partner-Plattform. Reines Tippgeber-Modell — investiert wird
// beim Partner, nie hier. Admin pflegt die Projekte.
export function impactPage({ isAdmin = false }) {
  const root = h("div", {});
  const listSlot = h("div", {});
  const adminSlot = h("div", {});
  let disclaimer = "";

  async function load() {
    try {
      const res = await api.impact.list();
      disclaimer = res.disclaimer || "";
      renderList(res.projects || []);
    } catch (e) {
      mount(listSlot, h("div", { style: { ...S.card, color: T.red } }, e.message));
    }
  }

  function renderList(projects) {
    mount(listSlot,
      projects.length === 0
        ? h("div", { style: { ...S.card, color: T.textDim, padding: 32, textAlign: "center" } },
            h("div", { style: { fontSize: 34, marginBottom: 8 } }, "🌱"),
            h("div", { style: { fontWeight: 600, fontSize: 16, marginBottom: 4 } }, "Noch keine Projekte kuratiert"),
            h("p", { style: { fontSize: 13.5, margin: 0, lineHeight: 1.5 } },
              "Hier erscheinen ausgewählte Startup-Projekte einer lizenzierten Crowdfunding-Plattform, sobald eine Partnerschaft steht."
            )
          )
        : h("div", { style: { display: "grid", gap: 12 } },
            ...projects.map((p) =>
              h("div", { style: { ...S.card, padding: 20 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" } },
                  h("div", { style: { flex: 1, minWidth: 220 } },
                    h("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
                      h("span", { style: { fontWeight: 650, fontSize: 16 } }, p.title),
                      h("span", { style: S.tag(T.teal) }, p.category || "startup"),
                      h("span", { style: { fontSize: 10.5, color: T.textFaint } }, "Anzeige*")
                    ),
                    p.partner ? h("div", { style: { fontSize: 12.5, color: T.textFaint, marginTop: 4 } }, `über Partner-Plattform: ${p.partner}`) : null,
                    p.pitch ? h("p", { style: { fontSize: 13.5, color: T.textDim, margin: "8px 0 0", lineHeight: 1.55 } }, p.pitch) : null,
                    p.minInvest ? h("div", { style: { fontSize: 12.5, color: T.green, marginTop: 6 } }, `ab ${fmt(p.minInvest)}`) : null
                  ),
                  h("a", {
                    href: p.url, target: "_blank", rel: "noopener noreferrer",
                    style: { ...S.btn, padding: "9px 18px", fontSize: 13.5, textDecoration: "none", whiteSpace: "nowrap" },
                  }, "Zum Projekt →")
                )
              )
            )
          ),
      disclaimer ? h("p", { style: { fontSize: 11.5, color: T.textFaint, marginTop: 16, lineHeight: 1.6 } }, "*" + disclaimer) : null
    );
  }

  function renderAdmin() {
    if (!isAdmin) { mount(adminSlot); return; }
    const title = h("input", { style: S.input, placeholder: "Projekt-Titel" });
    const partner = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "Partner-Plattform (z. B. Companisto)" });
    const url = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "https://… (dein Tippgeber-/Affiliate-Link)" });
    const pitch = h("textarea", { style: { ...S.input, marginTop: 8, minHeight: 60 }, placeholder: "Kurz-Pitch (max. 500 Zeichen)" });
    const minInvest = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "Mindestbetrag € (optional)", inputmode: "decimal" });
    const msg = h("div", { style: { fontSize: 13, marginTop: 8, minHeight: 16 } });
    const addBtn = h("button", { style: { ...S.btn, marginTop: 10 } }, "Projekt veröffentlichen");
    addBtn.addEventListener("click", async () => {
      try {
        await api.impact.create({ title: title.value, partner: partner.value, url: url.value, pitch: pitch.value, minInvest: minInvest.value });
        msg.style.color = T.green;
        msg.textContent = "✓ Veröffentlicht";
        title.value = partner.value = url.value = pitch.value = minInvest.value = "";
        load();
      } catch (e) {
        msg.style.color = T.red;
        msg.textContent = e.message;
      }
    });
    mount(adminSlot,
      h("div", { style: { ...S.card, marginTop: 24 } },
        h("div", { style: { fontWeight: 600, fontSize: 16, marginBottom: 4 } }, "Projekt kuratieren (Admin)"),
        h("p", { style: { fontSize: 12.5, color: T.textDim, margin: "0 0 10px", lineHeight: 1.5 } },
          "Nur Projekte lizenzierter ECSP-Plattformen verlinken (Tippgeber-Modell). Vertrag mit dem Partner vorher fixieren."
        ),
        title, partner, url, pitch, minInvest, addBtn, msg
      )
    );
  }

  mount(root,
    h("h1", { style: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" } }, "Impact"),
    h("p", { style: { color: T.textDim, margin: "0 0 20px", maxWidth: 620, lineHeight: 1.5 } },
      "Kuratierte Startup-Projekte von lizenzierten Crowdfunding-Plattformen — investiere direkt beim Partner, ab kleinen Beträgen."
    ),
    listSlot,
    adminSlot
  );

  load();
  renderAdmin();

  return {
    el: root,
    update({ isAdmin: newAdmin } = {}) {
      if (newAdmin !== undefined && newAdmin !== isAdmin) { isAdmin = newAdmin; renderAdmin(); }
    },
  };
}

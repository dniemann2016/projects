import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { fmt } from "../shared/format.js";
import { api } from "../shared/api.js";
import { EXPORT_GUIDES } from "../shared/cancelLinks.js";

// Konten & Umsätze: connect providers, inspect transactions, import statements
// and run the pure-algorithm recurring-payment scan. No AI on this page.
export function accountsPage({ accounts: initialAccounts, onAccountsChanged, onScanned }) {
  let accounts = initialAccounts;
  let providers = [];
  let transactions = [];
  let selectedAccountId = null;
  let showCatalog = false;
  let importOpenId = null;

  const accountsSlot = h("div", {});
  const catalogSlot = h("div", {});
  const txSlot = h("div", {});
  const scanResultSlot = h("div", {});

  const scanBtn = h("button", { style: { ...S.btn, fontSize: 15 } }, "◎ Jetzt scannen — ohne KI");
  scanBtn.addEventListener("click", async () => {
    scanBtn.disabled = true;
    scanBtn.style.opacity = "0.6";
    scanBtn.textContent = "⏳ Algorithmus prüft alle Umsätze…";
    try {
      const res = await api.scan.run();
      mount(
        scanResultSlot,
        h("div", { style: { ...S.card, background: "#eef6ee", marginTop: 14 } },
          h("div", { style: { fontWeight: 600, color: T.green, marginBottom: 6 } }, `✓ ${res.found} wiederkehrende Zahlungen erkannt`),
          h("p", { style: { fontSize: 13.5, color: T.textDim, margin: 0, lineHeight: 1.5 } }, res.summary),
          res.detected?.length
            ? h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
                ...res.detected.map((d) => h("span", { style: S.tag(d.status === "warning" ? T.red : T.text) }, `${d.name} · ${fmt(d.amount)} ${d.cycle}`))
              )
            : null
        )
      );
      onScanned?.();
    } catch (e) {
      mount(scanResultSlot, h("div", { style: { color: T.red, marginTop: 12, fontSize: 13.5 } }, e.message));
    }
    scanBtn.disabled = false;
    scanBtn.style.opacity = "1";
    scanBtn.textContent = "◎ Jetzt scannen — ohne KI";
  });

  function providerOf(id) {
    return providers.find((p) => p.id === id) || { name: id, color: "#999", letter: "?" };
  }

  function loadTransactions() {
    api.accounts.transactions(selectedAccountId).then((txs) => {
      transactions = txs;
      renderTransactions();
    });
  }

  function renderAccounts() {
    const addBtn = h("button", { style: { ...S.btnGhost, padding: "10px 20px", fontSize: 14 } }, showCatalog ? "▲ Katalog schließen" : "＋ Konto verbinden");
    addBtn.addEventListener("click", () => { showCatalog = !showCatalog; renderAccounts(); renderCatalog(); });

    mount(
      accountsSlot,
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 } },
        h("div", { style: { fontWeight: 600, fontSize: 19, letterSpacing: "-0.01em" } }, "Verbundene Konten"),
        addBtn
      ),
      accounts.length === 0
        ? h("div", { style: { ...S.card, color: T.textDim, fontSize: 14 } }, "Noch kein Konto verbunden. Öffne den Katalog und wähle deine Bank.")
        : h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 } },
            ...accounts.map((a) => {
              const prov = providerOf(a.provider);
              const active = selectedAccountId === a.id;
              const importBtn = h("button", { style: { ...S.btnGhost, padding: "5px 12px", fontSize: 12 } }, "Import");
              importBtn.addEventListener("click", (ev) => { ev.stopPropagation(); importOpenId = importOpenId === a.id ? null : a.id; renderTransactions(); });
              const removeBtn = h("button", { style: { ...S.btnGhost, padding: "5px 12px", fontSize: 12, color: T.red, borderColor: T.red + "66" } }, "Trennen");
              removeBtn.addEventListener("click", async (ev) => {
                ev.stopPropagation();
                await api.accounts.remove(a.id);
                accounts = accounts.filter((x) => x.id !== a.id);
                if (selectedAccountId === a.id) selectedAccountId = null;
                renderAccounts();
                loadTransactions();
                onAccountsChanged?.();
              });
              const card = h(
                "div",
                { style: { ...S.card, padding: 18, cursor: "pointer", border: `1px solid ${active ? T.blue : "transparent"}`, background: active ? "#eef4fc" : T.bgCard } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 } },
                  h("span", { style: { width: 40, height: 40, borderRadius: 12, background: prov.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17 } }, prov.letter),
                  h("div", {},
                    h("div", { style: { fontWeight: 600, fontSize: 15 } }, a.label),
                    h("div", { style: { fontSize: 12, color: T.textFaint } }, a.iban ? `${a.iban.slice(0, 12)}…` : prov.name)
                  )
                ),
                h("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" } },
                  h("span", { style: S.tag(a.status === "connected" ? T.green : T.textFaint) }, a.status === "connected" ? "Verbunden" : "Getrennt"),
                  importBtn,
                  removeBtn
                )
              );
              card.addEventListener("click", () => {
                selectedAccountId = active ? null : a.id;
                renderAccounts();
                loadTransactions();
              });
              return card;
            })
          )
    );
  }

  function renderCatalog() {
    if (!showCatalog) { mount(catalogSlot); return; }
    const groups = [
      ["bank", "Banken"],
      ["wallet", "Wallets & Zahlungsdienste"],
      ["card", "Kreditkarten"],
      ["broker", "Broker"],
    ];
    mount(
      catalogSlot,
      h("div", { style: { ...S.card, marginTop: 14, marginBottom: 6 } },
        h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 14px", lineHeight: 1.5 } },
          "Wähle deinen Anbieter. Ohne hinterlegte Bank-API (Admin → APIs) wird das Konto im Demo-Modus verbunden — Umsätze kommen dann per Import (Einfügen/CSV). Mit API-Zugang läuft die echte PSD2-Anbindung darüber."
        ),
        ...groups.map(([type, label]) => {
          const items = providers.filter((p) => p.type === type);
          if (items.length === 0) return null;
          return h("div", { style: { marginBottom: 12 } },
            h("div", { style: { fontSize: 12.5, color: T.textFaint, fontWeight: 600, marginBottom: 8 } }, label),
            h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
              ...items.map((p) => {
                const chip = h(
                  "button",
                  { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#fff", border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 980, cursor: "pointer", fontSize: 13.5, color: T.text } },
                  h("span", { style: { width: 22, height: 22, borderRadius: 7, background: p.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 } }, p.letter),
                  p.name
                );
                chip.addEventListener("click", async () => {
                  const acc = await api.accounts.connect({ provider: p.id });
                  accounts = [...accounts, acc];
                  showCatalog = false;
                  renderAccounts();
                  renderCatalog();
                  onAccountsChanged?.();
                });
                return chip;
              })
            )
          );
        }),
        h("div", { style: { fontSize: 12, color: T.textFaint } }, "… und viele weitere über den Import-Weg: Jede Bank, die CSV/Text-Exporte anbietet, funktioniert sofort.")
      )
    );
  }

  function renderTransactions() {
    const list = transactions;
    const account = accounts.find((a) => a.id === importOpenId);
    let importBox = null;
    if (account) {
      const guide = EXPORT_GUIDES[account.provider] || EXPORT_GUIDES.default;
      const ta = h("textarea", {
        style: { ...S.input, minHeight: 120, fontFamily: "ui-monospace, monospace", fontSize: 12.5, marginTop: 4 },
        placeholder: "15.06.2026  NETFLIX INTERNATIONAL B.V.  NL91ABNA0417164300  Netflix Abo  -17,99\n01.06.2026  Wohnbau GmbH  Miete Juni  -950,00\n…",
      });
      const importBtn2 = h("button", { style: { ...S.btn, padding: "10px 20px", fontSize: 14, marginTop: 10 } }, `In „${account.label}" importieren`);
      const msg = h("div", { style: { fontSize: 13, marginTop: 8 } });
      importBtn2.addEventListener("click", async () => {
        try {
          const res = await api.accounts.import(account.id, ta.value);
          msg.style.color = T.green;
          msg.textContent = `✓ ${res.imported} Umsätze importiert. Jetzt oben scannen.`;
          loadTransactions();
        } catch (e) {
          msg.style.color = T.red;
          msg.textContent = e.message;
        }
      });
      importBox = h("div", { style: { ...S.card, marginBottom: 14 } },
        h("div", { style: { fontWeight: 600, marginBottom: 4 } }, `Umsätze importieren — ${account.label}`),
        h("div", { style: { padding: "10px 14px", background: "rgba(0,113,227,0.06)", border: "1px solid rgba(0,113,227,0.2)", borderRadius: 12, marginBottom: 10 } },
          h("div", { style: { fontSize: 12.5, fontWeight: 650, color: T.blue, marginBottom: 6 } }, "📋 So exportierst du deine Umsätze in 30 Sekunden:"),
          ...guide.map((step, i) => h("div", { style: { fontSize: 12.5, color: T.textDim, lineHeight: 1.7 } }, `${i + 1}. ${step}`))
        ),
        h("p", { style: { fontSize: 12.5, color: T.textDim, margin: "0 0 4px" } }, "Text oder CSV einfügen (eine Buchung pro Zeile: Datum, Name, optional IBAN/Verwendungszweck, Betrag). Rein algorithmische Auswertung, keine KI."),
        ta, importBtn2, msg
      );
    }

    mount(
      txSlot,
      importBox,
      h("div", { style: { fontWeight: 600, fontSize: 19, letterSpacing: "-0.01em", margin: "6px 0 12px" } },
        selectedAccountId ? `Umsätze — ${accounts.find((a) => a.id === selectedAccountId)?.label || ""}` : "Alle Umsätze"
      ),
      list.length === 0
        ? h("div", { style: { ...S.card, color: T.textDim, fontSize: 14 } }, "Keine Umsätze vorhanden. Importiere welche über den Import-Button eines Kontos.")
        : h("div", { style: { ...S.card, padding: 0, overflow: "hidden" } },
            h("div", { style: { maxHeight: 420, overflowY: "auto" } },
              ...list.map((t, i) =>
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 18px", borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)", fontSize: 13.5, alignItems: "center" } },
                  h("div", { style: { minWidth: 74, color: T.textFaint, fontSize: 12.5 } }, new Date(t.date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })),
                  h("div", { style: { flex: 1 } },
                    h("div", { style: { fontWeight: 550 } }, t.name),
                    h("div", { style: { fontSize: 12, color: T.textFaint } }, [t.subject, t.iban ? `IBAN ${t.iban.slice(0, 8)}…` : null].filter(Boolean).join(" · "))
                  ),
                  h("div", { style: { fontWeight: 650, color: t.amount < 0 ? T.text : T.green, whiteSpace: "nowrap" } }, `${t.amount < 0 ? "−" : "+"}${fmt(Math.abs(t.amount))}`)
                )
              )
            )
          )
    );
  }

  api.accounts.providers().then((list) => {
    providers = list;
    renderAccounts();
    renderCatalog();
  });
  loadTransactions();

  const el = h(
    "div",
    {},
    h("h1", { style: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" } }, "Konten & Umsätze"),
    h("p", { style: { color: T.textDim, margin: "0 0 20px", maxWidth: 640, lineHeight: 1.5 } },
      "Verbinde Bankkonten, Wallets und Karten. Der Scanner erkennt wiederkehrende Zahlungen rein algorithmisch — wiederholte IBANs, Namen, Betreffe und regelmäßige Beträge."
    ),
    h("div", { style: { ...S.card, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" } },
      h("div", { style: { maxWidth: 520 } },
        h("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Wiederkehrende Zahlungen erkennen"),
        h("div", { style: { fontSize: 13, color: T.textDim, lineHeight: 1.5 } }, "Prüft alle Umsätze deiner Konten mit Algorithmen — komplett ohne KI und ohne Datenübertragung.")
      ),
      scanBtn
    ),
    scanResultSlot,
    h("div", { style: { marginTop: 8 } }, accountsSlot),
    catalogSlot,
    h("div", { style: { marginTop: 28 } }, txSlot)
  );

  renderAccounts();
  renderTransactions();

  return {
    el,
    update({ accounts: newAccounts } = {}) {
      if (newAccounts) { accounts = newAccounts; renderAccounts(); }
    },
  };
}

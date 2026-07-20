import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { api, setToken } from "../shared/api.js";

// Einstellungen: profile data, the KI opt-in switch, data export and
// profile switching. API keys live in the admin area, not here.
export function settingsPage({ me: initialMe, onUserChanged, onSwitchProfile, onLegal }) {
  let me = initialMe;

  const profileSlot = h("div", {});
  const securitySlot = h("div", {});
  const billingSlot = h("div", {});
  const aiSlot = h("div", {});
  const dataSlot = h("div", {});

  const legalSlot = h("div", {});

  function renderLegal() {
    const termsLine = me?.termsAcceptedAt
      ? `AGB akzeptiert am ${new Date(me.termsAcceptedAt).toLocaleDateString("de-DE")} (Version ${me.userTermsVersion || me.termsVersion || "—"})`
      : "AGB noch nicht akzeptiert — bitte Profil neu wählen.";
    mount(legalSlot,
      h("div", { class: "aw-card", style: { marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 8 } }, "Rechtliches"),
        h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 12px", lineHeight: 1.55 } }, termsLine),
        h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
          h("button", { class: "aw-btn aw-btn-ghost", style: { padding: "8px 14px", fontSize: 13 }, onClick: () => onLegal?.("agb") }, "AGB"),
          h("button", { class: "aw-btn aw-btn-ghost", style: { padding: "8px 14px", fontSize: 13 }, onClick: () => onLegal?.("datenschutz") }, "Datenschutz"),
          h("button", { class: "aw-btn aw-btn-ghost", style: { padding: "8px 14px", fontSize: 13 }, onClick: () => onLegal?.("impressum") }, "Impressum")
        ),
        h("p", { style: { fontSize: 12, color: T.textFaint, margin: "12px 0 0", lineHeight: 1.5 } },
          "Keine Finanz-, Anlage-, Rechts- oder Steuerberatung. Modellrechnungen und KI-Ausgaben ohne Gewähr."
        )
      )
    );
  }

  function renderSecurity() {
    const currentPw = h("input", { type: "password", style: { ...S.input, marginTop: 4 }, placeholder: me?.hasPassword ? "Aktuelles Passwort" : "— noch kein Passwort gesetzt —", disabled: !me?.hasPassword });
    const newPw = h("input", { type: "password", style: { ...S.input, marginTop: 8 }, placeholder: "Neues Passwort (min. 8 Zeichen)" });
    const msg = h("span", { style: { fontSize: 13, marginLeft: 10 } });
    const saveBtn = h("button", { style: { ...S.btn, padding: "10px 22px", fontSize: 14, marginTop: 12 } }, me?.hasPassword ? "Passwort ändern" : "Passwort setzen");
    saveBtn.addEventListener("click", async () => {
      try {
        const res = await api.user.setPassword(currentPw.value, newPw.value);
        if (res.token) setToken(res.token);
        msg.style.color = T.green;
        msg.textContent = "✓ Konto geschützt";
        currentPw.value = "";
        newPw.value = "";
        onUserChanged?.();
      } catch (e) {
        msg.style.color = T.red;
        msg.textContent = e.message;
      }
      setTimeout(() => (msg.textContent = ""), 4000);
    });

    mount(securitySlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 6 } }, "Konto-Sicherheit"),
        h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 10px", lineHeight: 1.55 } },
          "Mit Passwort ist dein Konto geschützt: Anmeldung nur mit Session-Token, Profil-Wechsel ohne Passwort ist dann nicht mehr möglich. Passwörter werden als scrypt-Hash gespeichert — niemand (auch kein Admin) kann sie einsehen."
        ),
        currentPw,
        newPw,
        h("div", { style: { display: "flex", alignItems: "center" } }, saveBtn, msg)
      )
    );
  }

  function renderProfile() {
    const nameInput = h("input", { style: { ...S.input, marginTop: 4 }, value: me?.name || "", placeholder: "Dein Name" });
    const emailInputs = (me?.emails?.length ? me.emails : [""]).map((em) =>
      h("input", { style: { ...S.input, marginTop: 8 }, value: em, placeholder: "E-Mail (für Abo-Zuordnung)" })
    );
    const emailWrap = h("div", {}, ...emailInputs);
    const addEmailBtn = h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13, marginTop: 10 } }, "＋ Weitere E-Mail");
    addEmailBtn.addEventListener("click", () => {
      const inp = h("input", { style: { ...S.input, marginTop: 8 }, placeholder: "E-Mail" });
      emailInputs.push(inp);
      emailWrap.appendChild(inp);
    });
    const saveBtn = h("button", { style: { ...S.btn, padding: "10px 22px", fontSize: 14, marginTop: 14 } }, "Speichern");
    const msg = h("span", { style: { fontSize: 13, marginLeft: 10 } });
    saveBtn.addEventListener("click", async () => {
      try {
        me = { ...me, ...(await api.user.save({ name: nameInput.value, emails: emailInputs.map((i) => i.value) })) };
        msg.style.color = T.green;
        msg.textContent = "✓ Gespeichert";
        onUserChanged?.();
        renderLegal();
      } catch (e) {
        msg.style.color = T.red;
        msg.textContent = e.message;
      }
      setTimeout(() => (msg.textContent = ""), 3000);
    });

    const switchBtn = h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13 } }, "Profil wechseln");
    switchBtn.addEventListener("click", () => onSwitchProfile?.());

    mount(profileSlot,
      h("div", { style: S.card },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 } },
          h("div", { style: { fontWeight: 600, fontSize: 17 } }, "Profil"),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            me?.role === "admin" ? h("span", { style: S.tag(T.blue) }, "Admin") : null,
            switchBtn
          )
        ),
        h("label", { style: { fontSize: 12.5, color: T.textFaint } }, "Name"),
        nameInput,
        h("label", { style: { fontSize: 12.5, color: T.textFaint, display: "block", marginTop: 14 } }, "E-Mail-Adressen (werden Abos zugeordnet)"),
        emailWrap,
        h("div", {}, addEmailBtn),
        h("div", { style: { display: "flex", alignItems: "center" } }, saveBtn, msg)
      )
    );
  }

  function renderBilling() {
    const b = me?.billing || {};
    const msg = h("div", { style: { fontSize: 13, marginTop: 10 } });
    const overageToggle = h("input", { type: "checkbox", checked: b.allowOverage !== false });
    overageToggle.addEventListener("change", async () => {
      try {
        const updated = await api.billing.updateSettings({ allowOverage: overageToggle.checked });
        me = { ...me, billing: updated };
        msg.style.color = T.green;
        msg.textContent = "✓ Gespeichert";
      } catch (e) {
        msg.style.color = T.red;
        msg.textContent = e.message;
      }
    });

    const checkoutBtn = (plan, label, interval) => {
      const btn = h("button", { style: { ...S.btnGhost, padding: "8px 14px", fontSize: 13, marginRight: 8, marginTop: 8 } }, label);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          if (!b.hasStripe) await api.billing.createCustomer();
          const { url } = await api.billing.checkout(plan, interval);
          window.open(url, "_blank");
          msg.textContent = "Stripe Checkout geöffnet — Plan wird nach Zahlung aktiv.";
        } catch (e) {
          msg.style.color = T.red;
          msg.textContent = e.message;
        }
        btn.disabled = false;
      });
      return btn;
    };

    const portalBtn = h("button", { style: { ...S.btnGhost, padding: "8px 14px", fontSize: 13, marginTop: 8 } }, "Abo verwalten (Stripe-Portal)");
    portalBtn.addEventListener("click", async () => {
      portalBtn.disabled = true;
      try {
        const { url } = await api.billing.portal();
        window.open(url, "_blank");
      } catch (e) {
        msg.style.color = T.red;
        msg.textContent = e.message;
      }
      portalBtn.disabled = false;
    });

    mount(billingSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 8 } }, "Abo & KI-Wallet"),
        h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 12px", lineHeight: 1.55 } },
          `Plan: ${b.planLabel || "Gratis"} · Wallet: ${(b.walletBalanceEUR ?? 0).toFixed(2)} € / ${(b.walletGrantedEUR ?? 0).toFixed(2)} € · Overage 0,05 €/Prompt über Stripe (sofort vor KI).`
        ),
        h("label", { style: { fontSize: 13, display: "flex", alignItems: "center", gap: 8 } }, overageToggle, " Overage-Zahlung erlauben"),
        h("div", { style: { marginTop: 12 } },
          checkoutBtn("check", "Einmal-Analyse 9,99 € (kein Abo)"),
          checkoutBtn("pro", "Pro 4,99 €/Monat"),
          checkoutBtn("pro", "Pro 39 €/Jahr", "year"),
          b.hasStripe ? portalBtn : null
        ),
        msg
      )
    );
  }

  function renderAi() {
    const enabled = Boolean(me?.settings?.aiEnabled);
    const toggle = h(
      "button",
      {
        style: {
          width: 52, height: 32, borderRadius: 980, border: "none", cursor: "pointer", position: "relative",
          background: enabled ? T.green : "rgba(0,0,0,0.2)", transition: "background 0.25s", flexShrink: 0,
        },
        title: enabled ? "KI ausschalten" : "KI einschalten",
      },
      h("span", { style: { position: "absolute", top: 3, left: enabled ? 23 : 3, width: 26, height: 26, borderRadius: "50%", background: "#fff", transition: "left 0.25s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" } })
    );
    toggle.addEventListener("click", async () => {
      const settings = await api.user.saveSettings({ aiEnabled: !enabled });
      me = { ...me, settings };
      renderAi();
      onUserChanged?.();
    });

    mount(aiSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" } },
          h("div", { style: { maxWidth: 560 } },
            h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 4 } }, "KI-Funktionen"),
            h("p", { style: { fontSize: 13, color: T.textDim, margin: 0, lineHeight: 1.55 } },
              "Standardmäßig arbeitet AboWandler rein algorithmisch — ohne KI, ohne Datenübertragung. Schaltest du die KI ein, kannst du zusätzlich: Firmen & IBANs auf Seriosität recherchieren lassen, Kündigungsbriefe generieren, den KI-Anlage-Finder und die Live-Recherche im Finanz-Radar nutzen. Dafür wird ein Anthropic-API-Schlüssel benötigt (Admin → APIs); Daten gehen nur bei aktiver Analyse an die KI."
            )
          ),
          toggle
        ),
        h("div", { style: { marginTop: 10 } }, h("span", { style: S.tag(enabled ? T.green : T.textFaint) }, enabled ? "KI aktiviert" : "KI deaktiviert — nur Algorithmen"))
      )
    );
  }

  function renderData() {
    const exportBtn = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13 } }, "⬇ Meine Daten als JSON exportieren");
    exportBtn.addEventListener("click", async () => {
      const [subs, accounts, txs] = await Promise.all([api.subscriptions.list(), api.accounts.list(), api.accounts.transactions()]);
      const blob = new Blob([JSON.stringify({ profil: me, konten: accounts, umsaetze: txs, abos: subs }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: "abowandler_export.json" });
      a.click();
      URL.revokeObjectURL(url);
    });

    // DSGVO (Produktplan Screen 6): ein Klick, wirklich alles weg.
    const deleteMsg = h("div", { style: { fontSize: 13, color: T.red, marginTop: 8, minHeight: 16 } });
    const deleteBtn = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13, color: T.red, borderColor: T.red + "66" } }, "🗑 Alle meine Daten endgültig löschen");
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Wirklich ALLE deine Daten löschen? Konto, Konten, Umsätze, Abos, Depot — unwiderruflich.")) return;
      if (!confirm("Letzte Bestätigung: Dieser Schritt kann nicht rückgängig gemacht werden.")) return;
      try {
        await api.user.deleteSelf();
        localStorage.removeItem("abw_user");
        localStorage.removeItem("abw_token");
        location.reload();
      } catch (e) {
        deleteMsg.textContent = e.message;
      }
    });

    mount(dataSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 6 } }, "Daten & Sicherheit"),
        h("p", { style: { fontSize: 13, color: T.textDim, margin: "0 0 14px", lineHeight: 1.55 } },
          "Alle Daten liegen lokal auf diesem Gerät — kein Cloud-Server. Passwörter werden AES-256-verschlüsselt gespeichert. Hochgeladene Kontoauszüge werden nach der Analyse sofort verworfen und nie gespeichert."
        ),
        h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } }, exportBtn, deleteBtn),
        deleteMsg
      )
    );
  }

  renderProfile();
  renderSecurity();
  renderBilling();
  renderAi();
  renderLegal();
  renderData();

  const el = h(
    "div",
    {},
    h("h1", { style: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" } }, "Einstellungen"),
    h("p", { style: { color: T.textDim, margin: "0 0 20px" } }, "Profil, Abo, KI-Freischaltung und deine Daten."),
    profileSlot,
    securitySlot,
    billingSlot,
    aiSlot,
    legalSlot,
    dataSlot
  );

  return {
    el,
    update({ me: newMe } = {}) {
      if (newMe) {
        me = newMe;
        renderProfile();
        renderSecurity();
        renderBilling();
        renderAi();
        renderLegal();
      }
    },
  };
}

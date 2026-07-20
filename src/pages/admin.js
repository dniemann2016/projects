import { h, mount } from "../shared/dom.js";
import { T, S } from "../shared/tokens.js";
import { api } from "../shared/api.js";

// Admin area: user management, API management (Anthropic + bank aggregators),
// system info and demo reset. Backend enforces role=admin on every route.
export function adminPage() {
  let data = null;

  const usersSlot = h("div", {});
  const launchSlot = h("div", {});
  const funnelSlot = h("div", {});
  const apisSlot = h("div", {});
  const customApisSlot = h("div", {});
  const affiliateSlot = h("div", {});
  const systemSlot = h("div", {});
  const msgSlot = h("div", { style: { minHeight: 20, fontSize: 13, marginBottom: 8 } });

  function flash(text, ok = true) {
    msgSlot.style.color = ok ? T.green : T.red;
    msgSlot.textContent = text;
    setTimeout(() => { if (msgSlot.textContent === text) msgSlot.textContent = ""; }, 4000);
  }

  async function reload() {
    try {
      data = await api.admin.overview();
      renderUsers();
      renderLaunch();
      renderFunnel();
      renderApis();
      renderCustomApis();
      renderAffiliates();
      renderSystem();
    } catch (e) {
      mount(usersSlot, h("div", { style: { ...S.card, color: T.red } }, e.message));
      mount(launchSlot);
      mount(funnelSlot);
      mount(apisSlot);
      mount(customApisSlot);
      mount(affiliateSlot);
      mount(systemSlot);
    }
  }

  // Launch-Checkliste aus server/lib/legal.js — fehlende .env-Werte.
  function renderLaunch() {
    const launch = data.launch;
    if (!launch) { mount(launchSlot); return; }
    const ok = launch.launchReady;
    mount(launchSlot,
      h("div", {
        class: "aw-card",
        style: {
          marginTop: 20,
          borderColor: ok ? "rgba(29,154,70,0.35)" : "rgba(255,159,10,0.45)",
          background: ok ? "rgba(29,154,70,0.06)" : "rgba(255,159,10,0.07)",
        },
      },
        h("div", { style: { fontWeight: 650, fontSize: 17, marginBottom: 8, color: ok ? T.green : T.orange } },
          ok ? "✓ Launch-Checkliste: bereit" : "⚠ Launch-Checkliste: noch offen"
        ),
        ok
          ? h("p", { style: { fontSize: 13, color: T.textDim, margin: 0 } }, "Stripe, Impressum und PUBLIC_URL sind konfiguriert.")
          : h("ul", { style: { margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: T.textDim, lineHeight: 1.7 } },
              ...(launch.missing || []).map((item) => h("li", {}, item))
            )
      )
    );
  }

  // Funnel & Kill-Kriterien (Produktplan 6.3/6.4).
  function renderFunnel() {
    const f = data.funnel;
    if (!f) { mount(funnelSlot); return; }
    const planTags = Object.entries(f.payersByPlan || {}).map(([plan, n]) =>
      h("span", { style: S.tag(T.green) }, `${plan}: ${n}`)
    );
    mount(funnelSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 12 } }, "Funnel & Kill-Kriterien"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 14 } },
          ...[
            ["Analysen gesamt", f.analysesTotal],
            ["Analysen (30 Tage)", f.analyses30d],
            ["Zahler", f.payers],
            ["Konversion", f.conversionPct === null ? "—" : `${f.conversionPct} %`],
          ].map(([l, v]) =>
            h("div", { style: { background: "#fff", borderRadius: 12, padding: 14 } },
              h("div", { style: { fontSize: 12, color: T.textFaint } }, l),
              h("div", { style: { fontSize: 22, fontWeight: 700 } }, String(v))
            )
          )
        ),
        planTags.length ? h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 } }, ...planTags) : null,
        h("div", { style: { fontSize: 12.5, color: f.killCriteria?.status?.startsWith("⚠") ? T.red : T.green, fontWeight: 600, marginBottom: 6 } }, f.killCriteria?.status || ""),
        h("div", { style: { fontSize: 12, color: T.textFaint, lineHeight: 1.6 } },
          h("div", {}, `Regel 1: ${f.killCriteria?.rule30d || ""}`),
          h("div", {}, `Regel 2: ${f.killCriteria?.rule90d || ""}`)
        )
      )
    );
  }

  async function renderAffiliates() {
    let brokers = [];
    try {
      brokers = await api.brokers.list();
    } catch {
      mount(affiliateSlot);
      return;
    }
    const rows = brokers.map((b) => {
      const input = h("input", { style: { ...S.input, flex: 1, minWidth: 220, padding: "8px 12px", fontSize: 13 }, placeholder: "https://… (dein Affiliate-Link)", value: b.isAffiliate ? b.url : "" });
      const saveBtn = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5 } }, "Speichern");
      saveBtn.addEventListener("click", async () => {
        try {
          await api.brokers.setAffiliate(b.id, input.value.trim());
          flash(`${b.name}: Affiliate-Link ${input.value.trim() ? "gespeichert" : "entfernt"}.`);
          renderAffiliates();
        } catch (e) { flash(e.message, false); }
      });
      return h("div", { style: { padding: "12px 0", borderTop: "1px solid rgba(0,0,0,0.06)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" } },
          h("span", { style: { fontWeight: 600, fontSize: 14 } }, b.name),
          h("span", { style: S.tag(b.isAffiliate ? T.green : T.textFaint) }, b.isAffiliate ? "Affiliate aktiv 💰" : "Standard-Link"),
          h("span", { style: { fontSize: 11.5, color: T.textFaint } }, b.affiliateHint || "")
        ),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, input, saveBtn)
      );
    });

    mount(affiliateSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 6 } }, "Broker-Affiliate-Links 💰"),
        h("p", { style: { fontSize: 12.5, color: T.textDim, margin: "0 0 4px", lineHeight: 1.5 } },
          "Deine Partner-Links je Broker (10–80 € Provision pro vermitteltem Depot). Melde dich bei den Partnerprogrammen an (Hinweis je Broker) und trage hier deine Tracking-URL ein — alle „Depot eröffnen“-Buttons in der App nutzen dann automatisch deinen Link. Werbekennzeichnung („Anzeige*“) wird automatisch angezeigt."
        ),
        ...rows
      )
    );
  }

  function renderUsers() {
    const rows = data.users.map((u) => {
      const roleSelect = h(
        "select",
        { style: { ...S.input, width: "auto", padding: "6px 10px", fontSize: 12.5 } },
        h("option", { value: "user", selected: u.role === "user" }, "Nutzer"),
        h("option", { value: "admin", selected: u.role === "admin" }, "Admin")
      );
      roleSelect.addEventListener("change", async () => {
        try {
          await api.admin.updateUser(u.id, { role: roleSelect.value });
          flash(`Rolle von ${u.name} geändert.`);
          reload();
        } catch (e) { flash(e.message, false); reload(); }
      });

      const aiToggle = h("button", { style: { ...S.btnGhost, padding: "6px 12px", fontSize: 12, color: u.aiEnabled ? T.green : T.textFaint, borderColor: u.aiEnabled ? T.green : "rgba(0,0,0,0.2)" } }, u.aiEnabled ? "KI an" : "KI aus");
      aiToggle.addEventListener("click", async () => {
        try {
          await api.admin.updateUser(u.id, { aiEnabled: !u.aiEnabled });
          reload();
        } catch (e) { flash(e.message, false); }
      });

      const delBtn = h("button", { style: { ...S.btnGhost, padding: "6px 12px", fontSize: 12, color: T.red, borderColor: T.red + "66" } }, "Löschen");
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Profil „${u.name}" und alle zugehörigen Daten (Konten, Umsätze, Abos) endgültig löschen?`)) return;
        try {
          await api.admin.deleteUser(u.id);
          flash(`${u.name} gelöscht.`);
          reload();
        } catch (e) { flash(e.message, false); }
      });

      return h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" } },
        h("span", { style: { width: 34, height: 34, borderRadius: "50%", background: u.role === "admin" ? T.blue : "#c7c7cc", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 } }, u.name[0].toUpperCase()),
        h("div", { style: { flex: 1, minWidth: 140 } },
          h("div", { style: { fontWeight: 600, fontSize: 14.5 } }, u.name),
          h("div", { style: { fontSize: 12, color: T.textFaint } }, `seit ${u.createdAt} · ${u.accounts} Konten · ${u.transactions} Umsätze · ${u.subscriptions} Abos`)
        ),
        roleSelect, aiToggle, delBtn
      );
    });

    mount(usersSlot,
      h("div", { style: S.card },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 6 } }, "Nutzerkonten"),
        h("p", { style: { fontSize: 12.5, color: T.textDim, margin: "0 0 4px" } }, "Rollen ändern, KI pro Nutzer freischalten/sperren, Profile löschen. Neue Profile werden auf der Profil-Auswahlseite angelegt."),
        ...rows
      )
    );
  }

  function renderApis() {
    const rows = data.apis.map((a) => {
      const input = h("input", { style: { ...S.input, flex: 1, minWidth: 180, padding: "8px 12px", fontSize: 13 }, placeholder: a.name === "anthropic" ? "sk-ant-…" : "API-Schlüssel", type: "password" });
      const saveBtn = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5 } }, a.configured ? "Ändern" : "Speichern");
      saveBtn.addEventListener("click", async () => {
        if (!input.value.trim()) return;
        try {
          await api.admin.setApi(a.name, input.value.trim());
          flash(`${a.label}: Schlüssel gespeichert.`);
          reload();
        } catch (e) { flash(e.message, false); }
      });
      const delBtn = a.configured
        ? (() => {
            const b = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: T.red, borderColor: T.red + "66" } }, "Entfernen");
            b.addEventListener("click", async () => {
              try {
                await api.admin.deleteApi(a.name);
                flash(`${a.label}: Schlüssel entfernt.`);
                reload();
              } catch (e) { flash(e.message, false); }
            });
            return b;
          })()
        : null;

      return h("div", { style: { padding: "14px 0", borderTop: "1px solid rgba(0,0,0,0.06)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" } },
          h("span", { style: { fontWeight: 600, fontSize: 14 } }, a.label),
          h("span", { style: S.tag(a.configured ? T.green : T.textFaint) }, a.configured ? `Aktiv · ${a.masked}` : "Nicht konfiguriert"),
          a.live ? null : h("span", { style: S.tag(T.orange) }, "Vorbereitet für echte Anbindung")
        ),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, input, saveBtn, delBtn)
      );
    });

    mount(apisSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 6 } }, "APIs"),
        h("p", { style: { fontSize: 12.5, color: T.textDim, margin: "0 0 4px", lineHeight: 1.5 } },
          "Schlüssel werden nur lokal auf diesem Gerät gespeichert. Anthropic treibt die KI-Funktionen an; die Bank-Aggregatoren (FinAPI/Tink/GoCardless/PayPal) sind die Slots für die echte Konto-Anbindung per PSD2/OAuth."
        ),
        ...rows
      )
    );
  }

  function renderCustomApis() {
    const rows = (data.customApis || []).map((a) =>
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" } },
        h("div", { style: { flex: 1, minWidth: 140 } },
          h("div", { style: { fontWeight: 600, fontSize: 14 } }, a.label),
          h("div", { style: { fontSize: 11.5, color: T.textFaint } }, a.baseUrl ? `${a.baseUrl} · ${a.masked}` : a.masked)
        ),
        (() => {
          const b = h("button", { style: { ...S.btnGhost, padding: "6px 12px", fontSize: 12, color: T.red, borderColor: T.red + "66" } }, "Entfernen");
          b.addEventListener("click", async () => {
            try {
              await api.admin.deleteCustomApi(a.id);
              flash(`${a.label}: entfernt.`);
              reload();
            } catch (e) { flash(e.message, false); }
          });
          return b;
        })()
      )
    );

    const nameInput = h("input", { style: { ...S.input, flex: 1, minWidth: 140, padding: "8px 12px", fontSize: 13 }, placeholder: "Name (z.B. Grok, DeepSeek, Base44 …)" });
    const keyInput = h("input", { style: { ...S.input, flex: 1, minWidth: 160, padding: "8px 12px", fontSize: 13 }, placeholder: "API-Schlüssel", type: "password" });
    const urlInput = h("input", { style: { ...S.input, flex: 1, minWidth: 160, padding: "8px 12px", fontSize: 13 }, placeholder: "Basis-URL (optional)" });
    const addBtn = h("button", { style: { ...S.btnGhost, padding: "8px 16px", fontSize: 13 } }, "＋ Hinzufügen");
    addBtn.addEventListener("click", async () => {
      if (!nameInput.value.trim() || !keyInput.value.trim()) { flash("Name und Schlüssel angeben.", false); return; }
      try {
        await api.admin.addCustomApi(nameInput.value.trim(), keyInput.value.trim(), urlInput.value.trim());
        flash(`${nameInput.value.trim()}: Schlüssel gespeichert.`);
        nameInput.value = ""; keyInput.value = ""; urlInput.value = "";
        reload();
      } catch (e) { flash(e.message, false); }
    });

    mount(customApisSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 6 } }, "Weitere APIs"),
        h("p", { style: { fontSize: 12.5, color: T.textDim, margin: "0 0 4px", lineHeight: 1.5 } },
          "Beliebige weitere Anbieter hinterlegen (z.B. Grok, DeepSeek, Base44 …) — frei benannt, nur lokal gespeichert. Aktuell treibt ausschließlich Anthropic die KI-Funktionen der App an; hier hinterlegte Schlüssel liegen bereit, falls weitere Anbieter angebunden werden."
        ),
        ...rows,
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 } }, nameInput, keyInput, urlInput, addBtn)
      )
    );
  }

  function renderSystem() {
    const resetBtn = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13, color: T.red, borderColor: T.red + "66" } }, "Alle Daten auf Demo-Stand zurücksetzen");
    resetBtn.addEventListener("click", async () => {
      if (!confirm("Wirklich ALLE Daten (alle Profile, Konten, Umsätze, Abos) löschen und den Demo-Datensatz neu laden?")) return;
      await api.admin.reset();
      flash("Zurückgesetzt. Lade neu …");
      setTimeout(() => location.reload(), 800);
    });

    const s = data.system;
    const st = data.stats;
    mount(systemSlot,
      h("div", { style: { ...S.card, marginTop: 20 } },
        h("div", { style: { fontWeight: 600, fontSize: 17, marginBottom: 12 } }, "System"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 } },
          ...[["Profile", st.users], ["Konten", st.accounts], ["Umsätze", st.transactions], ["Abos", st.subscriptions]].map(([l, v]) =>
            h("div", { style: { background: "#fff", borderRadius: 12, padding: 14 } },
              h("div", { style: { fontSize: 12, color: T.textFaint } }, l),
              h("div", { style: { fontSize: 22, fontWeight: 700 } }, String(v))
            )
          )
        ),
        h("div", { style: { fontSize: 12.5, color: T.textDim, lineHeight: 1.7, marginBottom: 14 } },
          h("div", {}, `Datenordner: ${s.dataDir}`),
          h("div", {}, `Server: Port ${s.port} · Host ${s.host} · Node ${s.node}`),
          s.lanIp ? h("div", {}, `Im WLAN erreichbar: http://${s.lanIp}:${s.port}`) : null
        ),
        resetBtn
      )
    );
  }

  reload();

  const el = h(
    "div",
    {},
    h("h1", { style: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" } }, "Admin"),
    h("p", { style: { color: T.textDim, margin: "0 0 18px", maxWidth: 620, lineHeight: 1.5 } },
      "Nutzerkonten sichten und verwalten, API-Schlüssel einstellen, ändern oder löschen — und der Zustand des Systems auf einen Blick."
    ),
    msgSlot,
    launchSlot,
    usersSlot,
    funnelSlot,
    apisSlot,
    customApisSlot,
    affiliateSlot,
    systemSlot
  );

  return { el, update() { reload(); } };
}

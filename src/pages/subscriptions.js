import { h, mount } from "../shared/dom.js";
import { T, S, statusCfg } from "../shared/tokens.js";
import { fmt, yearsLabel, monthsSince, futureValue } from "../shared/format.js";
import { logo } from "../shared/logo.js";
import { api } from "../shared/api.js";
import { findCancelLink } from "../shared/cancelLinks.js";

function swapSuggestion(sub, etfs) {
  const popular = etfs.find((e) => e.tags?.includes("Beliebtester")) || etfs[0];
  const best = etfs.reduce((a, b) => (b.ret > (a?.ret ?? -Infinity) ? b : a), null);
  if (!popular || !best) return null;
  const rows = [popular, ...(best.id !== popular.id ? [best] : [])];
  return h(
    "div",
    { style: { marginTop: 14, padding: 16, background: "rgba(48,209,88,0.06)", border: "1px solid rgba(48,209,88,0.25)", borderRadius: 14 } },
    h("div", { style: { color: T.green, fontWeight: 650, marginBottom: 4, fontSize: 14 } }, `↗ Tausch-Vorschlag: Statt ${fmt(sub.amount)} für „${sub.name}“ …`),
    h("div", { style: { fontSize: 13, color: T.textDim, marginBottom: 12 } }, "… denselben Betrag monatlich in einen ETF-Sparplan:"),
    h(
      "div",
      { style: { display: "grid", gap: 10 } },
      ...rows.map((e) =>
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 12px", background: "rgba(0,0,0,0.04)", borderRadius: 10 } },
          h("div", {},
            h("div", { style: { fontWeight: 600, fontSize: 13.5 } }, `${e.name} `, h("span", { style: { color: T.green } }, `(${e.ret}% p.a.*)`)),
            h("div", { style: { fontSize: 12, color: T.textFaint } }, `Risiko: ${e.risk} · TER ${e.ter}%`)
          ),
          h(
            "div",
            { style: { display: "flex", gap: 16, fontSize: 12.5, alignItems: "center", flexWrap: "wrap" } },
            ...[10, 20, 30].map((y) =>
              h("div", { style: { textAlign: "right" } },
                h("div", { style: { color: T.textFaint } }, `${y} J.`),
                h("div", { style: { fontWeight: 700, color: T.green } }, fmt(futureValue(sub.amount, e.ret, y)))
              )
            )
          )
        )
      )
    ),
    h("div", { style: { fontSize: 11.5, color: T.textFaint, marginTop: 10 } },
      `Eingezahlt wären es ${fmt(sub.amount * 12 * 20)} in 20 Jahren — Renten-Boost nach 4%-Regel: +${fmt((futureValue(sub.amount, popular.ret, 20) * 0.04) / 12)}/Monat.* Modellrechnung, keine Anlageberatung.`
    )
  );
}

function credentialForm(sub, emails, draft, onSave, { isAdmin = false } = {}) {
  const state = draft;

  const emailField =
    emails.length > 1
      ? h(
          "select",
          { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 } },
          h("option", { value: "" }, "— auswählen —"),
          ...emails.map((em) => h("option", { value: em, selected: em === state.email }, em))
        )
      : h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: state.email, placeholder: "name@example.com" });
  emailField.addEventListener("input", () => { state.email = emailField.value; });
  emailField.addEventListener("change", () => { state.email = emailField.value; });

  const usernameInput = h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: state.username });
  usernameInput.addEventListener("input", () => { state.username = usernameInput.value; });

  const pwInput = h("input", {
    type: state.showPw ? "text" : "password",
    style: { ...S.input, padding: "9px 12px", fontSize: 13.5 },
    value: state.password,
    placeholder: sub.hasPassword ? (isAdmin ? "Neues Passwort setzen (nicht einsehbar)" : "••••••••") : "",
  });
  pwInput.addEventListener("input", () => { state.password = pwInput.value; state.loadedPw = true; });

  const pwToggle = isAdmin
    ? h("span", { style: { fontSize: 11, color: T.textFaint, padding: "0 8px" } }, "🔒 Admin sieht Passwörter nicht")
    : h("button", { style: { ...S.btnGhost, padding: "0 12px", fontSize: 12 }, type: "button" }, state.showPw ? "🙈" : "👁");
  if (!isAdmin) {
    pwToggle.addEventListener("click", async () => {
      if (!state.loadedPw && sub.hasPassword) {
        try {
          const res = await api.subscriptions.password(sub.id);
          state.password = res.password;
          state.loadedPw = true;
          pwInput.value = state.password;
        } catch (e) {
          alert(e.message);
          return;
        }
      }
      state.showPw = !state.showPw;
      pwInput.type = state.showPw ? "text" : "password";
      pwToggle.textContent = state.showPw ? "🙈" : "👁";
    });
  }

  const phoneInput = h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: state.phone, placeholder: "+49 …" });
  phoneInput.addEventListener("input", () => { state.phone = phoneInput.value; });

  const saveBtn = h("button", { style: { ...S.btnGhost, padding: "7px 16px", fontSize: 12.5, marginTop: 12 } }, "Speichern");
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Speichert…";
    try {
      await onSave({ email: state.email, username: state.username, phone: state.phone, password: state.password });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Speichern";
    }
  });

  return h(
    "div",
    { style: { marginTop: 14, padding: 16, background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}`, borderRadius: 14 } },
    h("div", { style: { fontSize: 13, color: T.textDim, marginBottom: 10 } }, "✉ Zugangsdaten (verschlüsselt gespeichert)"),
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 } },
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "E-Mail"), emailField),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Nutzername"), usernameInput),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Passwort"),
        h("div", { style: { display: "flex", gap: 6, marginTop: 4 } }, pwInput, pwToggle)
      ),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Handynummer"), phoneInput)
    ),
    saveBtn
  );
}

function manageForm(sub, draft, onSave) {
  const amountInput = h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: draft.amount, inputmode: "decimal" });
  amountInput.addEventListener("input", () => { draft.amount = amountInput.value; });

  const categoryInput = h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: draft.category, placeholder: "z.B. Streaming" });
  categoryInput.addEventListener("input", () => { draft.category = categoryInput.value; });

  const dayInput = h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: draft.paymentDay, placeholder: "1-28", inputmode: "numeric" });
  dayInput.addEventListener("input", () => { draft.paymentDay = dayInput.value; });

  const cycleSelect = h(
    "select",
    { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 } },
    ...["monatlich", "vierteljährlich", "jährlich"].map((c) => h("option", { value: c, selected: c === draft.cycle }, c))
  );
  cycleSelect.addEventListener("change", () => { draft.cycle = cycleSelect.value; });

  const noteInput = h("input", { style: { ...S.input, padding: "9px 12px", fontSize: 13.5, marginTop: 4 }, value: draft.note, placeholder: "Eigene Notiz…" });
  noteInput.addEventListener("input", () => { draft.note = noteInput.value; });

  const saveBtn = h("button", { style: { ...S.btnGhost, padding: "7px 16px", fontSize: 12.5, marginTop: 12 } }, "Änderungen speichern");
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Speichert…";
    try {
      await onSave(draft);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Änderungen speichern";
    }
  });

  return h(
    "div",
    { style: { marginTop: 14, padding: 16, background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}`, borderRadius: 14 } },
    h("div", { style: { fontSize: 13, color: T.textDim, marginBottom: 10 } }, "⚙ Zahlung verwalten"),
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 } },
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Betrag (€)"), amountInput),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Kategorie"), categoryInput),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Abbuchungstag"), dayInput),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Zahlungsrhythmus"), cycleSelect),
      h("div", {}, h("label", { style: { fontSize: 12, color: T.textFaint } }, "Notiz"), noteInput)
    ),
    saveBtn
  );
}

// Next debit date derived from paymentDay (today or later this month, else next month).
function nextPaymentDate(paymentDay) {
  if (!paymentDay) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), paymentDay);
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setMonth(d.getMonth() + 1);
  return d;
}

export function subscriptionsPage({ subs, emails, aiEnabled: initialAi, isAdmin = false, forceFilter, onForceFilterApplied, onSubsChanged }) {
  let currentSubs = subs;
  let currentEmails = emails;
  let aiEnabled = Boolean(initialAi);

  let search = "";
  let sortBy = "amount";
  let filterStatus = "all";

  const uiState = {
    openCredsId: null,
    openSwapId: null,
    openManageId: null,
    reportLoadingId: null,
    letterLoadingId: null,
    reports: {},
    letters: {},
    drafts: {},
    isAdmin, // id -> { email, username, phone, password, showPw, loadedPw }
    manageDrafts: {}, // id -> { amount, category, paymentDay, cycle, note }
  };

  let etfs = [];
  api.etfs.list().then((list) => { etfs = list; }).catch(() => {});

  function draftFor(sub) {
    if (!uiState.drafts[sub.id]) {
      uiState.drafts[sub.id] = { email: sub.email || "", username: sub.username || "", phone: sub.phone || "", password: "", showPw: false, loadedPw: false };
    }
    return uiState.drafts[sub.id];
  }

  function manageDraftFor(sub) {
    if (!uiState.manageDrafts[sub.id]) {
      uiState.manageDrafts[sub.id] = {
        amount: String(sub.amount), category: sub.category || "", paymentDay: String(sub.paymentDay || ""),
        cycle: sub.cycle || "monatlich", note: sub.note || "",
      };
    }
    return uiState.manageDrafts[sub.id];
  }

  const togglePause = async (sub) => {
    const paused = !sub.paused;
    currentSubs = currentSubs.map((s) => (s.id === sub.id ? { ...s, paused } : s));
    renderList();
    const updated = await api.subscriptions.update(sub.id, { paused });
    currentSubs = currentSubs.map((s) => (s.id === sub.id ? { ...s, ...updated } : s));
    onSubsChanged?.(currentSubs);
  };

  const saveManage = async (id, draft) => {
    const body = {
      amount: Number(String(draft.amount).replace(",", ".")) || 0,
      category: draft.category,
      paymentDay: draft.paymentDay ? Number(draft.paymentDay) : null,
      cycle: draft.cycle,
      note: draft.note,
    };
    const updated = await api.subscriptions.update(id, body);
    currentSubs = currentSubs.map((s) => (s.id === id ? { ...s, ...updated } : s));
    delete uiState.manageDrafts[id];
    uiState.openManageId = null;
    onSubsChanged?.(currentSubs);
    renderList();
  };

  const setStatus = async (id, status) => {
    currentSubs = currentSubs.map((s) => (s.id === id ? { ...s, status } : s));
    renderList();
    const updated = await api.subscriptions.update(id, { status });
    onSubsChanged?.(currentSubs.map((s) => (s.id === id ? { ...s, ...updated } : s)));
  };

  const removeSub = async (id) => {
    currentSubs = currentSubs.filter((s) => s.id !== id);
    renderList();
    await api.subscriptions.remove(id);
    onSubsChanged?.(currentSubs);
  };

  const saveCreds = async (id, body) => {
    const updated = await api.subscriptions.update(id, body);
    currentSubs = currentSubs.map((s) => (s.id === id ? { ...s, ...updated } : s));
    onSubsChanged?.(currentSubs);
  };

  const generateReport = async (sub) => {
    uiState.reportLoadingId = sub.id;
    renderList();
    try {
      const { report } = await api.ai.companyReport(sub.id);
      uiState.reports[sub.id] = report;
    } catch (e) {
      uiState.reports[sub.id] = e.message;
    }
    uiState.reportLoadingId = null;
    renderList();
  };

  const generateLetter = async (sub) => {
    uiState.letterLoadingId = sub.id;
    renderList();
    try {
      uiState.letters[sub.id] = await api.ai.cancellationLetter(sub.id);
    } catch (e) {
      uiState.letters[sub.id] = { subject: "Fehler", body: e.message };
    }
    uiState.letterLoadingId = null;
    renderList();
  };

  const exportCsv = () => {
    const header = ["Name", "Betrag", "Zyklus", "Seit", "Kategorie", "Status", "Notiz"];
    const rows = currentSubs.map((s) => [s.name, s.amount, s.cycle, s.since, s.category, s.status, s.note || ""]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: "abowandler_abos.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadLetter = (sub, letter) => {
    const blob = new Blob([`Betreff: ${letter.subject}\n\n${letter.body}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: `Kuendigung_${sub.name.replace(/\s+/g, "_")}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  function buildCard(sub) {
    const cfg = statusCfg[sub.status];
    const priceHike = sub.priceHistory && sub.priceHistory.length > 1 && sub.priceHistory[sub.priceHistory.length - 1].amount > sub.priceHistory[0].amount;

    const statusButtons = Object.entries(statusCfg).map(([k, v]) => {
      const btn = h(
        "button",
        {
          style: {
            ...S.btnGhost, padding: "7px 14px", fontSize: 12.5,
            borderColor: sub.status === k ? v.color : T.border,
            color: sub.status === k ? v.color : T.textDim,
            background: sub.status === k ? `${v.color}15` : "transparent",
          },
        },
        `${v.icon} ${v.label}`
      );
      btn.addEventListener("click", () => setStatus(sub.id, k));
      return btn;
    });

    // KI actions only exist when the user has enabled KI in Einstellungen.
    const reportBtn = aiEnabled
      ? (() => {
          const b = h(
            "button",
            { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: T.purple, borderColor: T.purple + "55" } },
            uiState.reportLoadingId === sub.id ? "⏳ KI recherchiert…" : "📄 KI-Firmenbericht"
          );
          b.disabled = uiState.reportLoadingId === sub.id;
          b.addEventListener("click", () => generateReport(sub));
          return b;
        })()
      : null;

    const letterBtn = aiEnabled
      ? (() => {
          const b = h(
            "button",
            { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: T.teal, borderColor: T.teal + "55" } },
            uiState.letterLoadingId === sub.id ? "⏳ KI schreibt…" : "✉ Kündigungsbrief"
          );
          b.disabled = uiState.letterLoadingId === sub.id;
          b.addEventListener("click", () => generateLetter(sub));
          return b;
        })()
      : null;

    const swapBtn = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: T.green, borderColor: T.green + "55" } }, "↗ ETF-Tausch");
    swapBtn.addEventListener("click", () => { uiState.openSwapId = uiState.openSwapId === sub.id ? null : sub.id; renderList(); });

    const cancelLink = findCancelLink(sub.name);
    const cancelBtn = cancelLink
      ? (() => {
          const b = h("a", {
            href: cancelLink.url,
            target: "_blank",
            rel: "noopener noreferrer",
            style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: T.red, borderColor: T.red + "55", textDecoration: "none", display: "inline-block" },
          }, "✂ Jetzt kündigen →");
          return b;
        })()
      : null;

    const credsBtn = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5 } }, "🔑 Zugangsdaten");
    credsBtn.addEventListener("click", () => { uiState.openCredsId = uiState.openCredsId === sub.id ? null : sub.id; renderList(); });

    const pauseBtn = h(
      "button",
      { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: sub.paused ? T.green : T.orange, borderColor: (sub.paused ? T.green : T.orange) + "55" } },
      sub.paused ? "▶ Fortsetzen" : "⏸ Pausieren"
    );
    pauseBtn.addEventListener("click", () => togglePause(sub));

    const manageBtn = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5 } }, "⚙ Verwalten");
    manageBtn.addEventListener("click", () => { uiState.openManageId = uiState.openManageId === sub.id ? null : sub.id; renderList(); });

    const removeBtn = h("button", { style: { ...S.btnGhost, padding: "7px 14px", fontSize: 12.5, color: T.textFaint } }, "Entfernen");
    removeBtn.addEventListener("click", () => removeSub(sub.id));

    const nextDate = !sub.paused && sub.paymentDay ? nextPaymentDate(sub.paymentDay) : null;
    const card = h(
      "div",
      { style: { ...S.card, padding: 20, opacity: sub.paused ? 0.55 : 1 } },
      h(
        "div",
        { style: { display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" } },
        logo({ domain: sub.domain, letter: sub.letter, color: sub.color }),
        h(
          "div",
          { style: { flex: 1, minWidth: 200 } },
          h(
            "div",
            { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
            h("span", { style: { fontWeight: 650, fontSize: 17 } }, sub.name),
            h("span", { style: S.tag(cfg.color) }, `${cfg.icon} ${cfg.label}`),
            sub.paused ? h("span", { style: S.tag(T.orange) }, "⏸ Pausiert") : null
          ),
          h("div", { style: { fontSize: 13.5, color: T.textDim, marginTop: 4 } },
            `${fmt(sub.amount)} ${sub.cycle} · läuft seit ${yearsLabel(sub.since)} · ${sub.category}`,
            sub.iban ? ` · IBAN: ${sub.iban.slice(0, 8)}…` : "",
            nextDate ? ` · nächste Abbuchung: ${nextDate.toLocaleDateString("de-DE", { day: "numeric", month: "short" })}` : ""
          ),
          sub.note ? h("div", { style: { fontSize: 13, color: sub.status === "warning" ? T.red : T.orange, marginTop: 6 } }, sub.note) : null,
          priceHike ? h("div", { style: { fontSize: 13, color: T.orange, marginTop: 6 } }, `📈 Preis gestiegen: ${fmt(sub.priceHistory[0].amount)} → ${fmt(sub.amount)} seit ${sub.priceHistory[0].date}`) : null,
          monthsSince(sub.since) >= 48 && sub.status === "pending"
            ? h("div", { style: { fontSize: 13, color: T.orange, marginTop: 6 } }, `🕰 Läuft seit über ${Math.floor(monthsSince(sub.since) / 12)} Jahren — Zeit für einen Check?`)
            : null
        ),
        h(
          "div",
          { style: { textAlign: "right", flexShrink: 0 } },
          h("div", { style: { fontSize: 20, fontWeight: 700 } }, fmt(sub.amount)),
          h("div", { style: { fontSize: 12, color: T.textFaint } }, `= ${fmt(sub.amount * 12)}/Jahr`)
        )
      ),
      h("div", { style: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" } }, ...statusButtons, cancelBtn, reportBtn, letterBtn, swapBtn, credsBtn, pauseBtn, manageBtn, removeBtn),
      uiState.openSwapId === sub.id && etfs.length > 0 ? swapSuggestion(sub, etfs) : null,
      uiState.openManageId === sub.id ? manageForm(sub, manageDraftFor(sub), (draft) => saveManage(sub.id, draft)) : null,
      uiState.openCredsId === sub.id ? credentialForm(sub, currentEmails, draftFor(sub), (body) => saveCreds(sub.id, body), { isAdmin: uiState.isAdmin }) : null,
      uiState.reports[sub.id]
        ? h("div", { style: { marginTop: 14, padding: 16, background: "rgba(191,90,242,0.07)", border: "1px solid rgba(191,90,242,0.25)", borderRadius: 14, fontSize: 14, lineHeight: 1.6, color: T.textDim, whiteSpace: "pre-wrap" } },
            h("div", { style: { color: T.purple, fontWeight: 650, marginBottom: 8 } }, `📄 KI-Bericht: ${sub.name}`),
            uiState.reports[sub.id]
          )
        : null,
      uiState.letters[sub.id]
        ? (() => {
            const dlBtn = h("button", { style: { ...S.btnGhost, padding: "6px 14px", fontSize: 12.5 } }, "Als TXT herunterladen");
            dlBtn.addEventListener("click", () => downloadLetter(sub, uiState.letters[sub.id]));
            return h("div", { style: { marginTop: 14, padding: 16, background: "rgba(100,210,255,0.07)", border: "1px solid rgba(100,210,255,0.25)", borderRadius: 14, fontSize: 14, lineHeight: 1.6, color: T.textDim, whiteSpace: "pre-wrap" } },
              h("div", { style: { color: T.teal, fontWeight: 650, marginBottom: 8 } }, `✉ ${uiState.letters[sub.id].subject}`),
              uiState.letters[sub.id].body,
              h("div", { style: { marginTop: 10 } }, dlBtn)
            );
          })()
        : null
    );
    return card;
  }

  const listContainer = h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } });
  const planSlot = h("div", {});

  // Payment plan: upcoming debits, active/paused totals and category breakdown.
  function renderPlan() {
    const active = currentSubs.filter((s) => !s.paused);
    const paused = currentSubs.filter((s) => s.paused);
    const monthlyOf = (s) => (s.cycle === "jährlich" ? s.amount / 12 : s.cycle === "vierteljährlich" ? s.amount / 3 : s.amount);
    const activeSum = active.reduce((a, s) => a + monthlyOf(s), 0);
    const pausedSum = paused.reduce((a, s) => a + monthlyOf(s), 0);

    const upcoming = active
      .map((s) => ({ sub: s, date: nextPaymentDate(s.paymentDay) }))
      .filter((u) => u.date)
      .sort((a, b) => a.date - b.date)
      .slice(0, 6);

    const byCategory = {};
    for (const s of active) byCategory[s.category || "Sonstiges"] = (byCategory[s.category || "Sonstiges"] || 0) + monthlyOf(s);
    const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const maxCat = categories[0]?.[1] || 1;

    mount(
      planSlot,
      h(
        "div",
        { style: { ...S.card, marginBottom: 20 } },
        h("div", { style: { fontWeight: 650, marginBottom: 14 } }, "📅 Dein Zahlungsplan"),
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 16 } },
          h("div", {},
            h("div", { style: { fontSize: 12.5, color: T.textDim } }, "Aktive Zahlungen/Monat"),
            h("div", { style: { fontSize: 22, fontWeight: 700 } }, fmt(activeSum))
          ),
          h("div", {},
            h("div", { style: { fontSize: 12.5, color: T.textDim } }, "Aufs Jahr gerechnet"),
            h("div", { style: { fontSize: 22, fontWeight: 700, color: T.orange } }, fmt(activeSum * 12))
          ),
          h("div", {},
            h("div", { style: { fontSize: 12.5, color: T.textDim } }, `Pausiert gespart (${paused.length})`),
            h("div", { style: { fontSize: 22, fontWeight: 700, color: T.green } }, `${fmt(pausedSum)}/Mon.`)
          )
        ),
        upcoming.length > 0
          ? h("div", { style: { marginBottom: 16 } },
              h("div", { style: { fontSize: 12.5, color: T.textDim, marginBottom: 8 } }, "Nächste Abbuchungen"),
              h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                ...upcoming.map(({ sub, date }) =>
                  h("div", { style: { padding: "8px 14px", background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 12.5 } },
                    h("span", { style: { color: T.teal, fontWeight: 650 } }, date.toLocaleDateString("de-DE", { day: "numeric", month: "short" })),
                    ` ${sub.name} `,
                    h("b", {}, fmt(sub.amount))
                  )
                )
              )
            )
          : null,
        categories.length > 0
          ? h("div", {},
              h("div", { style: { fontSize: 12.5, color: T.textDim, marginBottom: 8 } }, "Nach Kategorie"),
              h("div", { style: { display: "grid", gap: 6 } },
                ...categories.map(([cat, sum]) =>
                  h("div", { style: { display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 } },
                    h("div", { style: { minWidth: 110, color: T.textDim } }, cat),
                    h("div", { style: { flex: 1, height: 8, background: "rgba(0,0,0,0.04)", borderRadius: 99 } },
                      h("div", { style: { width: `${Math.round((sum / maxCat) * 100)}%`, height: 8, background: `linear-gradient(90deg, ${T.teal}, ${T.green})`, borderRadius: 99 } })
                    ),
                    h("div", { style: { minWidth: 80, textAlign: "right", fontWeight: 650 } }, fmt(sum))
                  )
                )
              )
            )
          : null
      )
    );
  }

  function renderList() {
    renderPlan();
    let list = currentSubs.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "all") list = list.filter((s) => s.status === filterStatus);
    list.sort((a, b) => {
      if (sortBy === "amount") return b.amount - a.amount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "age") return monthsSince(b.since) - monthsSince(a.since);
      return 0;
    });

    if (list.length === 0) {
      mount(listContainer, h("div", { style: { ...S.card, textAlign: "center", color: T.textDim } }, 'Keine Abos gefunden. Nutze „Konten" um Kontoauszüge zu importieren.'));
      return;
    }
    mount(listContainer, ...list.map(buildCard));
  }

  const searchInput = h("input", { style: { ...S.input, maxWidth: 280 }, placeholder: "🔍 Abo suchen…" });
  searchInput.addEventListener("input", () => { search = searchInput.value; renderList(); });

  const sortSelect = h(
    "select",
    { style: { ...S.input, maxWidth: 180 } },
    h("option", { value: "amount" }, "Nach Preis"),
    h("option", { value: "name" }, "Nach Name"),
    h("option", { value: "age" }, "Nach Alter")
  );
  sortSelect.addEventListener("change", () => { sortBy = sortSelect.value; renderList(); });

  const filterSelect = h(
    "select",
    { style: { ...S.input, maxWidth: 200 } },
    h("option", { value: "all" }, "Alle Status"),
    ...Object.entries(statusCfg).map(([k, v]) => h("option", { value: k }, v.label))
  );
  filterSelect.addEventListener("change", () => { filterStatus = filterSelect.value; renderList(); });

  const exportBtn = h("button", { style: { ...S.btnGhost, padding: "9px 18px", fontSize: 13.5 } }, "⬇ Als CSV exportieren");
  exportBtn.addEventListener("click", exportCsv);

  const el = h(
    "div",
    {},
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 } },
      h("h1", { style: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 } }, "Deine Abos & Zahlungen"),
      exportBtn
    ),
    planSlot,
    h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 } }, searchInput, sortSelect, filterSelect),
    listContainer
  );

  function applyForceFilter(ff) {
    if (!ff) return;
    filterStatus = ff;
    filterSelect.value = ff;
    onForceFilterApplied?.();
  }

  applyForceFilter(forceFilter);
  renderList();

  return {
    el,
    update({ subs: newSubs, emails: newEmails, aiEnabled: newAi, forceFilter: ff } = {}) {
      if (newAi !== undefined) aiEnabled = newAi;
      if (newSubs) currentSubs = newSubs;
      if (newEmails) currentEmails = newEmails;
      applyForceFilter(ff);
      renderList();
    },
  };
}

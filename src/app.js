import { h, mount } from "./shared/dom.js";
import { T, S } from "./shared/tokens.js";
import { api, getCurrentUserId, setCurrentUserId, setToken } from "./shared/api.js";
import { landingPage } from "./pages/landing.js";
import { dashboardPage } from "./pages/dashboard.js";
import { subscriptionsPage } from "./pages/subscriptions.js";
import { accountsPage } from "./pages/accounts.js";
import { etfExplorerPage } from "./pages/etfExplorer.js";
import { financeRadarPage } from "./pages/financeRadar.js";
import { settingsPage } from "./pages/settings.js";
import { adminPage } from "./pages/admin.js";
import { portfolioPage } from "./pages/portfolio.js";
import { legalPage } from "./pages/legal.js";
import { analysePage } from "./pages/analyse.js";
import { impactPage } from "./pages/impact.js";
import { NAV_PRIMARY, NAV_MORE, loadingView, toast, tabLabel, termsAcceptanceUI, legalFooterBar } from "./shared/ui.js";
import { loadLegalInfo, getLegalInfoSync } from "./shared/legalInfo.js";

export class AboWandlerApp {
  constructor(root) {
    this.root = root;
    // Stripe-Rückkehr (?checkout=success): direkt in die App, Plan ist per
    // Webhook aktiviert; kurze Bestätigung statt Landing.
    const params = new URLSearchParams(location.search);
    this.checkoutResult = params.get("checkout");
    if (this.checkoutResult) history.replaceState(null, "", location.pathname);

    this.state = {
      page: this.checkoutResult && getCurrentUserId() ? "app" : "landing", // landing | login | terms | legal | analyse-public | app
      tab: this.checkoutResult ? "settings" : "dashboard",
      me: null, // full current-user profile incl. role + settings
      subs: [],
      accounts: [],
      holdings: [],
      loading: true,
      error: null,
      filterOverride: null,
    };
    this.pageInstances = {};
    this.navButtons = {};
    this.render();
    if (this.state.page === "app") this.loadAll();
  }

  get aiEnabled() {
    return Boolean(this.state.me?.settings?.aiEnabled);
  }

  get switchedSum() {
    return this.state.subs.filter((s) => s.status === "switch").reduce((a, s) => a + s.amount, 0);
  }

  get emails() {
    return (this.state.me?.emails || []).filter(Boolean);
  }

  loadAll(silent = false) {
    if (!silent) {
      this.state.loading = true;
      this.renderMain();
    }
    Promise.all([api.subscriptions.list(), api.accounts.list(), api.user.get(), api.holdings.list().catch(() => [])])
      .then(([s, a, me, holdings]) => {
        this.state.subs = s;
        this.state.accounts = a;
        this.state.me = me;
        this.state.holdings = holdings;
        this.state.error = null;
      })
      .catch((e) => {
        if (/AGB|Haftung|TERMS/i.test(e.message)) {
          this.state.page = "terms";
          this.state.loading = false;
          this.render();
          return;
        }
        this.state.error = e.message;
      })
      .finally(() => {
        this.state.loading = false;
        this.updateAllInstances();
        this.renderMain();
        this.updateNavUser();
      });
  }

  updateAllInstances() {
    const { subs, accounts, me } = this.state;
    this.pageInstances.dashboard?.update({ subs, aiEnabled: this.aiEnabled, holdings: this.state.holdings });
    this.pageInstances.analyse?.update({ me });
    this.pageInstances.abos?.update({ subs, emails: this.emails, aiEnabled: this.aiEnabled });
    this.pageInstances.konten?.update({ accounts });
    this.pageInstances.etf?.update({ subs, switchedSum: this.switchedSum, aiEnabled: this.aiEnabled });
    this.pageInstances.depot?.update({ holdings: this.state.holdings });
    this.pageInstances.impact?.update({ isAdmin: me?.role === "admin" });
    this.pageInstances.radar?.update({ aiEnabled: this.aiEnabled });
    this.pageInstances.settings?.update({ me });
  }

  goToLegal(doc, returnPage) {
    this.state.legalReturnPage = returnPage || this.state.page;
    this.state.legalDoc = doc;
    this.state.page = "legal";
    this.render();
  }

  legalBack() {
    const back = this.state.legalReturnPage || "landing";
    this.state.page = back;
    this.render();
  }

  async proceedAfterAuth({ userId, token } = {}) {
    if (userId) setCurrentUserId(userId);
    if (token !== undefined) setToken(token);
    try {
      const me = await api.user.get();
      if (me.needsTermsAcceptance) {
        this.state.page = "terms";
        this.render();
        return;
      }
      this.enterApp();
    } catch {
      setCurrentUserId(null);
      setToken(null);
      this.state.page = "login";
      this.render();
    }
  }

  render() {
    if (this.state.page === "landing") {
      mount(this.root, landingPage({
        onStart: () => this.goToLogin(),
        onAnalyse: () => { this.state.page = "analyse-public"; this.render(); },
        onLegal: (doc) => this.goToLegal(doc, "landing"),
      }));
      return;
    }
    if (this.state.page === "analyse-public") {
      this.renderPublicAnalyse();
      return;
    }
    if (this.state.page === "terms") {
      this.renderTermsGate();
      return;
    }
    if (this.state.page === "legal") {
      mount(this.root, legalPage({
        doc: this.state.legalDoc || "agb",
        onBack: () => this.legalBack(),
      }));
      return;
    }
    if (this.state.page === "login") {
      this.renderLogin();
      return;
    }
    this.buildAppShell();
    this.renderMain();
  }

  goToLogin() {
    loadLegalInfo().catch(() => {});
    const stored = getCurrentUserId();
    if (stored) {
      this.state.page = "login";
      this.render();
      this.proceedAfterAuth({ userId: stored });
      return;
    }
    this.state.page = "login";
    this.render();
  }

  enterApp() {
    this.state.page = "app";
    this.pageInstances = {};
    this.render();
    this.loadAll();
  }

  goToLanding() {
    this.state.page = "landing";
    this.render();
  }

  // Der öffentliche Analyse-Funnel (Plan Screen 1–3): keine Registrierung
  // für die erste Analyse — Konto erst beim Speichern/Bezahlen.
  renderPublicAnalyse() {
    const brand = h("button", { class: "aw-brand", type: "button" }, "Abo", h("span", {}, "Wandler"));
    brand.addEventListener("click", () => this.goToLanding());
    const loginBtn = h("button", { class: "aw-btn aw-btn-primary", style: { padding: "7px 16px", fontSize: 13 } }, "Konto / Anmelden");
    loginBtn.addEventListener("click", () => this.goToLogin());

    const page = analysePage({
      me: null,
      onNeedAccount: () => this.goToLogin(),
      onUpgrade: () => this.goToLogin(),
      onDone: () => this.goToLogin(),
      onLegal: (doc) => this.goToLegal(doc, "analyse-public"),
    });

    mount(this.root,
      h("div", { style: S.page },
        h("header", { class: "aw-topnav" },
          h("div", { class: "aw-topnav-inner" }, brand, loginBtn)
        ),
        h("main", { class: "aw-app-main", style: { maxWidth: 860 } }, page.el),
        legalFooterBar({ onLegal: (doc) => this.goToLegal(doc, "analyse-public"), compact: true })
      )
    );
  }

  renderTermsGate() {
    const legal = getLegalInfoSync();
    const msg = h("div", { style: { color: T.red, fontSize: 13, minHeight: 18, marginTop: 10 } });
    let termsChecked = false;
    const acceptBtn = h("button", {
      class: "aw-btn aw-btn-primary",
      style: { marginTop: 16, width: "100%" },
      disabled: true,
    }, "Akzeptieren & fortfahren");
    acceptBtn.addEventListener("click", async () => {
      if (!termsChecked || !legal?.termsVersion) return;
      acceptBtn.disabled = true;
      try {
        await api.user.acceptTerms(legal.termsVersion);
        toast("AGB und Haftungsausschluss akzeptiert.", { type: "ok" });
        this.enterApp();
      } catch (e) {
        msg.textContent = e.message;
        acceptBtn.disabled = false;
      }
    });
    const termsBlock = termsAcceptanceUI({
      legal,
      checkboxId: "aw-terms-gate",
      onChange: (v) => {
        termsChecked = v;
        acceptBtn.disabled = !v;
      },
      onLegal: (doc) => this.goToLegal(doc, "terms"),
    });
    const backBtn = h("button", {
      class: "aw-btn aw-btn-ghost",
      style: { marginTop: 12, width: "100%" },
      onClick: () => {
        setCurrentUserId(null);
        setToken(null);
        this.state.page = "login";
        this.render();
      },
    }, "← Anderes Profil wählen");

    mount(this.root,
      h("div", { style: { ...S.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } },
        h("div", { class: "aw-login-card", style: { width: "100%", maxWidth: 520 } },
          h("h1", { style: { fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px" } }, "Bevor es losgeht"),
          h("p", { style: { color: T.textDim, margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.55 } },
            "Für die Nutzung von AboWandler brauchst du die Zustimmung zu AGB und Haftungsausschluss. Das gilt für jedes Profil — auch wenn du die App nur lokal nutzt."
          ),
          termsBlock,
          acceptBtn,
          msg,
          backBtn,
          legalFooterBar({ onLegal: (doc) => this.goToLegal(doc, "terms"), compact: true })
        )
      )
    );
  }

  renderLogin() {
    loadLegalInfo().catch(() => {});
    const legal = getLegalInfoSync();
    const slot = h("div", { style: { display: "grid", gap: 12, maxWidth: 420, margin: "0 auto" } }, h("div", { style: { color: T.textDim, textAlign: "center" } }, "Lade Profile…"));

    const loginWithPassword = (u) => {
      const pwInput = h("input", { type: "password", style: { ...S.input, flex: 1 }, placeholder: "Passwort", autofocus: true });
      const msg = h("div", { style: { color: T.red, fontSize: 13, minHeight: 18 } });
      const doLogin = async () => {
        try {
          const res = await api.users.login(u.id, pwInput.value);
          await this.proceedAfterAuth({ userId: u.id, token: res.token ?? null });
        } catch (e) {
          msg.textContent = e.message;
        }
      };
      const loginBtn = h("button", { class: "aw-btn aw-btn-primary" }, "Anmelden");
      loginBtn.addEventListener("click", doLogin);
      pwInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") doLogin(); });
      const backBtn = h("button", { class: "aw-btn aw-btn-ghost", style: { fontSize: 13 } }, "← Zurück");
      backBtn.addEventListener("click", () => this.renderLogin());
      mount(slot,
        h("div", { style: { textAlign: "center", fontWeight: 600, fontSize: 17, marginBottom: 4 } }, `Passwort für ${u.name}`),
        h("div", { style: { display: "flex", gap: 10 } }, pwInput, loginBtn),
        msg,
        backBtn
      );
    };

    api.users.list().then((users) => {
      const newName = h("input", { style: { ...S.input, flex: 1 }, placeholder: "Name des neuen Profils" });
      const newPw = h("input", { type: "password", style: { ...S.input, flex: 1 }, placeholder: "Passwort (optional, min. 8 Zeichen)" });
      const createBtn = h("button", { class: "aw-btn aw-btn-primary", style: { whiteSpace: "nowrap" } }, "Konto anlegen");
      const createMsg = h("div", { style: { color: T.red, fontSize: 13 } });
      let createTermsOk = false;
      const createTerms = termsAcceptanceUI({
        legal,
        checkboxId: "aw-terms-create",
        onChange: (v) => { createTermsOk = v; },
        onLegal: (doc) => this.goToLegal(doc, "login"),
      });
      createBtn.addEventListener("click", async () => {
        if (!newName.value.trim()) return;
        if (!createTermsOk) {
          createMsg.textContent = "Bitte AGB und Haftungsausschluss akzeptieren.";
          return;
        }
        if (!legal?.termsVersion) {
          createMsg.textContent = "Rechtstexte werden geladen — bitte kurz warten.";
          return;
        }
        try {
          const u = await api.users.create({
            name: newName.value.trim(),
            password: newPw.value || undefined,
            termsAccepted: true,
            termsVersion: legal.termsVersion,
          });
          setCurrentUserId(u.id);
          if (u.token) setToken(u.token);
          this.enterApp();
        } catch (e) {
          createMsg.textContent = e.message;
        }
      });
      mount(
        slot,
        ...users.map((u) => {
          const row = h("button", { class: "aw-profile-row", type: "button" },
            h("span", { class: "aw-avatar", style: { background: u.role === "admin" ? T.blue : "#c7c7cc" } }, u.name[0].toUpperCase()),
            h("span", { style: { flex: 1, fontWeight: 550 } }, u.name),
            u.hasPassword ? h("span", { title: "Passwortgeschützt" }, "🔒") : null,
            u.role === "admin" ? h("span", { style: S.tag(T.blue) }, "Admin") : null
          );
          row.addEventListener("click", () => {
            if (u.hasPassword) {
              loginWithPassword(u);
            } else {
              this.proceedAfterAuth({ userId: u.id, token: null });
            }
          });
          return row;
        }),
        h("div", { style: { display: "grid", gap: 8, marginTop: 10 } },
          h("div", { style: { fontSize: 13, fontWeight: 600, color: T.textDim, marginTop: 8 } }, "Neues Profil"),
          h("div", { style: { display: "flex", gap: 10 } }, newName, createBtn),
          newPw,
          createTerms,
          createMsg
        )
      );
    });

    mount(
      this.root,
      h("div", { style: { ...S.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px 48px", minHeight: "100vh", boxSizing: "border-box" } },
        h("div", { class: "aw-login-card", style: { width: "100%", maxWidth: 520 } },
          h("h1", { style: { fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", textAlign: "center", margin: "0 0 6px" } }, "Wer nutzt AboWandler?"),
          h("p", { style: { color: T.textDim, textAlign: "center", margin: "0 0 28px", fontSize: 15 } }, "Wähle dein Profil oder lege ein neues an. Alle Daten bleiben auf diesem Gerät."),
          slot
        ),
        legalFooterBar({ onLegal: (doc) => this.goToLegal(doc, "login"), compact: true })
      )
    );
  }

  setTab(tab) {
    this.state.tab = tab;
    this.closeMoreMenu();
    this.updateNavHighlight();
    this.renderMain();
  }

  updateNavHighlight() {
    const tab = this.state.tab;
    for (const [id, btns] of Object.entries(this.navButtons || {})) {
      if (id.startsWith("_")) continue;
      const active = id === tab;
      for (const btn of btns) btn.classList.toggle("is-active", active);
    }
    const inMore = NAV_MORE.some((t) => t.id === tab);
    this.deskMoreBtn?.classList.toggle("is-active", inMore);
    this.mobileMoreBtn?.classList.toggle("is-active", inMore);
    for (const btn of this.moreMenuButtons || []) {
      btn.classList.toggle("is-active", btn.dataset.tab === tab);
    }
  }

  registerNavBtn(id, btn) {
    if (!this.navButtons[id]) this.navButtons[id] = [];
    this.navButtons[id].push(btn);
  }

  closeMoreMenu() {
    this.moreMenu?.classList.remove("is-open");
    if (this.moreMenu) {
      this.moreMenu.style.position = "";
      this.moreMenu.style.right = "";
      this.moreMenu.style.bottom = "";
      this.moreMenu.style.top = "";
      this.moreMenu.style.left = "";
    }
  }

  openMoreMenu(anchorBtn) {
    if (!this.moreMenu || !anchorBtn) return;
    const open = !this.moreMenu.classList.contains("is-open");
    this.closeMoreMenu();
    if (!open) return;
    const rect = anchorBtn.getBoundingClientRect();
    this.moreMenu.classList.add("is-open");
    this.moreMenu.style.position = "fixed";
    if (window.innerWidth < 900) {
      this.moreMenu.style.right = "12px";
      this.moreMenu.style.bottom = "calc(72px + env(safe-area-inset-bottom, 0px))";
      this.moreMenu.style.top = "";
      this.moreMenu.style.left = "";
    } else {
      this.moreMenu.style.top = `${rect.bottom + 8}px`;
      this.moreMenu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
      this.moreMenu.style.bottom = "";
      this.moreMenu.style.left = "";
    }
  }

  updateNavUser() {
    if (!this.userChip) return;
    const me = this.state.me;
    if (!me) return;
    mount(
      this.userChip,
      h("span", { class: "aw-avatar", style: { background: me.role === "admin" ? T.blue : "#c7c7cc" } }, (me.name || "?")[0].toUpperCase()),
      h("span", { style: { fontSize: 13 } }, me.name)
    );
  }

  buildAppShell() {
    const brand = h("button", { class: "aw-brand", type: "button" }, "Abo", h("span", {}, "Wandler"));
    brand.addEventListener("click", () => this.goToLanding());

    this.navButtons = {};

    const deskTabs = h("div", { class: "aw-desk-tabs" });
    for (const t of NAV_PRIMARY) {
      const btn = h("button", { class: "aw-desk-tab", type: "button" }, `${t.icon} ${t.label}`);
      btn.addEventListener("click", () => this.setTab(t.id));
      this.registerNavBtn(t.id, btn);
      deskTabs.appendChild(btn);
    }

    const moreItems = NAV_MORE.filter((t) => !t.adminOnly || this.state.me?.role === "admin");
    this.moreMenu = h("div", { class: "aw-more-menu" });
    this.moreMenuButtons = moreItems.map((t) => {
      const btn = h("button", { class: "aw-more-item", type: "button", "data-tab": t.id }, `${t.icon} ${t.label}`);
      btn.addEventListener("click", () => this.setTab(t.id));
      this.moreMenu.appendChild(btn);
      return btn;
    });

    this.deskMoreBtn = h("button", { class: "aw-desk-tab", type: "button" }, "⋯ Mehr");
    this.deskMoreBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.openMoreMenu(this.deskMoreBtn);
    });
    deskTabs.appendChild(h("div", { class: "aw-more-wrap" }, this.deskMoreBtn));

    if (!this._moreMenuCloser) {
      this._moreMenuCloser = () => this.closeMoreMenu();
      document.addEventListener("click", this._moreMenuCloser);
    }

    const mobileNav = h("nav", { class: "aw-mobile-nav" });
    for (const t of NAV_PRIMARY) {
      const btn = h("button", { class: "aw-mobile-tab", type: "button" },
        h("span", {}, t.icon),
        h("span", {}, t.label)
      );
      btn.addEventListener("click", () => this.setTab(t.id));
      this.registerNavBtn(t.id, btn);
      mobileNav.appendChild(btn);
    }
    this.mobileMoreBtn = h("button", { class: "aw-mobile-tab", type: "button" },
      h("span", {}, "⋯"),
      h("span", {}, "Mehr")
    );
    this.mobileMoreBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.openMoreMenu(this.mobileMoreBtn);
    });
    mobileNav.appendChild(this.mobileMoreBtn);

    this.userChip = h("button", { class: "aw-user-chip", type: "button", title: "Abmelden / Profil wechseln" });
    this.userChip.addEventListener("click", () => {
      api.users.logout().catch(() => {});
      setCurrentUserId(null);
      setToken(null);
      this.state.page = "login";
      this.render();
    });

    const topNav = h("header", { class: "aw-topnav" },
      h("div", { class: "aw-topnav-inner" }, brand, deskTabs, this.userChip)
    );

    this.mainSlot = h("main", { class: "aw-app-main" });
    const appFooter = legalFooterBar({ onLegal: (doc) => this.goToLegal(doc, "app"), compact: true });
    mount(this.root, h("div", { style: S.page }, topNav, this.mainSlot, appFooter, this.moreMenu, mobileNav));
    this.updateNavHighlight();
  }

  getOrCreatePage(tab) {
    if (this.pageInstances[tab]) return this.pageInstances[tab];
    const { subs, accounts, me } = this.state;
    let instance;
    if (tab === "dashboard") {
      instance = dashboardPage({
        subs,
        aiEnabled: this.aiEnabled,
        onFilterWarning: () => { this.state.filterOverride = "warning"; this.setTab("abos"); },
        onRefresh: () => this.loadAll(true),
        onGoTo: (t) => this.setTab(t),
      });
    } else if (tab === "abos") {
      instance = subscriptionsPage({
        subs, emails: this.emails, aiEnabled: this.aiEnabled,
        isAdmin: this.state.me?.role === "admin",
        forceFilter: this.state.filterOverride,
        onForceFilterApplied: () => { this.state.filterOverride = null; },
        onSubsChanged: (newSubs) => { this.state.subs = newSubs; },
      });
    } else if (tab === "analyse") {
      instance = analysePage({
        me,
        onNeedAccount: () => {},
        onUpgrade: () => this.setTab("settings"),
        onDone: (t) => this.setTab(t || "depot"),
        onLegal: (doc) => this.goToLegal(doc, "app"),
      });
    } else if (tab === "konten") {
      instance = accountsPage({
        accounts,
        onAccountsChanged: () => this.loadAll(true),
        onScanned: () => this.loadAll(true),
      });
    } else if (tab === "depot") {
      instance = portfolioPage({
        holdings: this.state.holdings,
        onReload: () => this.loadAll(true),
      });
    } else if (tab === "etf") {
      instance = etfExplorerPage({ subs, switchedSum: this.switchedSum, aiEnabled: this.aiEnabled });
    } else if (tab === "impact") {
      instance = impactPage({ isAdmin: this.state.me?.role === "admin" });
    } else if (tab === "radar") {
      instance = financeRadarPage({ aiEnabled: this.aiEnabled });
    } else if (tab === "settings") {
      instance = settingsPage({
        me,
        onUserChanged: () => this.loadAll(true),
        onSwitchProfile: () => { setCurrentUserId(null); this.state.page = "login"; this.render(); },
        onLegal: (doc) => this.goToLegal(doc, "app"),
      });
    } else if (tab === "admin") {
      instance = adminPage();
    }
    this.pageInstances[tab] = instance;
    return instance;
  }

  renderMain() {
    if (!this.mainSlot) return;

    if (this.state.error) {
      mount(this.mainSlot,
        h("div", { class: "aw-card", style: { marginBottom: 24, border: `1px solid ${T.red}44`, color: T.red } },
          h("strong", {}, "Server nicht erreichbar"),
          h("p", { style: { margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 } },
            `${this.state.error}. Starte das Backend mit: cd server && node index.js`
          ),
          h("button", { class: "aw-btn aw-btn-primary", style: { marginTop: 14 }, onClick: () => this.loadAll() }, "Erneut versuchen")
        )
      );
      return;
    }
    if (this.state.loading) {
      mount(this.mainSlot, loadingView("Deine Daten werden geladen…"));
      return;
    }
    const instance = this.getOrCreatePage(this.state.tab);
    if (this.state.tab === "abos" && this.state.filterOverride) {
      instance.update({ forceFilter: this.state.filterOverride });
    }
    const checkoutBanner = this.checkoutResult
      ? h("div", { class: "aw-card", style: { marginBottom: 24, border: `1px solid ${this.checkoutResult === "success" ? T.green : T.orange}55`, background: this.checkoutResult === "success" ? "rgba(52,199,89,0.07)" : "rgba(255,159,10,0.07)" } },
          this.checkoutResult === "success"
            ? "✓ Zahlung erfolgreich — dein Plan wird in wenigen Sekunden aktiv."
            : "Zahlung abgebrochen — es wurde nichts abgebucht."
        )
      : null;
    if (this.checkoutResult === "success") toast("Zahlung erfolgreich — Plan wird gleich aktiv.", { type: "ok" });
    else if (this.checkoutResult === "cancel") toast("Zahlung abgebrochen.", { type: "err", ms: 2800 });
    this.checkoutResult = null;
    mount(this.mainSlot, checkoutBanner, instance.el);
  }
}

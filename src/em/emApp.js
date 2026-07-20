import { h, mount } from "../shared/dom.js";
import { api, getCurrentUserId, setCurrentUserId, getToken, setToken, getImpersonateId, setImpersonateId } from "../shared/api.js";
import { toast, loadingView, legalFooterBar } from "../shared/ui.js";
import { legalPage } from "../pages/legal.js";
import { loadLegalInfo, getLegalInfoSync } from "../shared/legalInfo.js";
import { emLandingPage } from "./landing.js";
import { formatEUR, catLabel, projectTags, workModeTag } from "./format.js";
import { FEATURES, HIRING_MODE_LABEL } from "./features.js";
import { renderGuidePage } from "./guide.js";
import { renderProjectHub } from "./projectHub.js";
import { PAY_MODELS, WINNER_CRITERIA, TASK_MODES, renderBigPick, payModelLabel } from "./workModels.js";
import { mountHeroCanvas } from "./heroCanvas.js";
import {
  renderTeamWayPicker, renderBundleList, renderCreateTeamForm,
  renderSimpleDelegateForm, renderSimpleTaskForm,
} from "./teamFlow.js";
import { mountNetworkMap } from "./networkMap.js";
import {
  applePageHero, appleProductTile, applePersonTile, appleFilterPills, appleFilterSelect, appleFilterGrid,
  appleSpecRow, appleSpecSheet, appleSectionHeadline, appleBtn, appleLink,
  appleWizardBar, appleBidCard, appleNdaBlind, applePanel,
  appleBreadcrumb, appleEmptyState, appleErsteSchritte, appleTrustRow,
  applePromoBar, appleStoreHero, appleCategoryChip, appleCategoryRow,
  appleInsertCard, appleCarousel, appleHelpCard, appleLockedField,
} from "./components.js";
import { NAV, TAB_COPY, GRUNDREGELN, VERSPRECHEN, ERSTE_SCHRITTE, EMPTY } from "./nav.js";
import "./em.css";

const STATUS_LABEL = {
  draft: "Entwurf",
  pending_review: "In Prüfung",
  open: "Offen",
  assigned: "Vergeben",
  completed: "Abgeschlossen",
  rejected: "Abgelehnt",
};

const MILESTONE_LABEL = {
  held: "Hinterlegt",
  submitted: "Zur Prüfung",
  released: "Ausgezahlt",
  disputed: "Beanstandet",
};

export class ProjectsApp {
  constructor(root) {
    this.root = root;
    this.state = {
      page: "landing",
      tab: "entdecken",
      detailId: null,
      detailKind: null,
      legalDoc: "agb",
      legalReturn: "landing",
      me: null,
      myProfile: null,
      categories: [],
      projects: [],
      discover: { projects: [], teams: [], profiles: [], offers: [] },
      offers: [],
      verification: null,
      verificationProviders: [],
      teams: [],
      myTeams: [],
      network: null,
      mine: { owned: [], assigned: [] },
      adminQueue: [],
      organon: { contacts: [], requests: { incoming: [], outgoing: [] }, delegations: { sent: [], received: [] }, bookings: { sent: [], received: [] } },
      intent: null,
      profileSection: "profil",
      myTasks: [],
      collabSuggestions: null,
      userMode: localStorage.getItem("em-user-mode") || "arbeiten",
      weekStats: null,
      teamRequests: { received: [], sent: [] },
    };
    this._landingDestroy = null;
    this._networkDestroy = null;
    this._appHero = null;
    this._refreshGen = 0;
    this.render();
  }

  /** Vollständige Abmeldung — Session löschen, UI zurücksetzen, Login anzeigen. */
  signOut() {
    this._refreshGen += 1;
    api.users.logout().catch(() => {});
    this.destroyAppHero();
    if (this._networkDestroy) { this._networkDestroy(); this._networkDestroy = null; }
    if (this._stripHeroStop) { this._stripHeroStop(); this._stripHeroStop = null; }
    setCurrentUserId(null);
    setToken(null);
    setImpersonateId(null);
    this.state.me = null;
    this.state.myProfile = null;
    this.state.detailId = null;
    this.state.detailKind = null;
    this.state.adminQueue = [];
    this.state.authMode = "login";
    this.state.authChallenge = null;
    this.state.page = "login";
    this._shellBuilt = false;
    this.render();
  }

  async loadMe() {
    try {
      this.state.me = await api.user.get();
      return this.state.me;
    } catch (e) {
      this.state.me = null;
      return null;
    }
  }

  goToLegal(doc, returnPage) {
    this.state.legalReturn = returnPage || this.state.page;
    this.state.legalDoc = doc;
    this.state.page = "legal";
    this.render();
  }

  async proceedAfterAuth({ userId, token, silent = false } = {}) {
    if (userId) setCurrentUserId(userId);
    if (token !== undefined) setToken(token);
    else if (userId) setToken(null);

    const me = await this.loadMe();
    if (!me) {
      setCurrentUserId(null);
      setToken(null);
      if (!silent) toast("Anmeldung fehlgeschlagen — bitte erneut versuchen.", { type: "err" });
      this.state.page = "login";
      this.state.authMode = "login";
      this.render();
      return;
    }
    if (me.needsTermsAcceptance) {
      this.state.page = "terms";
      this.render();
      return;
    }
    this._shellBuilt = false;
    this.enterApp();
  }

  enterApp() {
    this.state.page = "app";
    if (this.state.intent === "guide") this.state.tab = "anleitung";
    else if (this.state.intent === "hire") {
      this.state.tab = "erstellen";
      this.state.userMode = "vergeben";
      localStorage.setItem("em-user-mode", "vergeben");
    } else if (this.state.intent === "offer") {
      this.state.tab = "markt";
      this.state.marketMode = "talent";
      this.state.userMode = "arbeiten";
      localStorage.setItem("em-user-mode", "arbeiten");
    } else this.state.tab = "entdecken";
    this.state.detailId = null;
    this.state.detailKind = null;
    this._openMarktAfter = false;
    this._shellBuilt = false;
    this.render();
    this.refreshData();
  }

  /** Projekte, zu denen eingeladen / Aufgaben verteilt werden dürfen */
  inviteableOwnedProjects() {
    return (this.state.mine?.owned || []).filter((p) =>
      ["pending_review", "open", "assigned"].includes(p.status)
    );
  }

  teamRequestProjects() {
    return this.inviteableOwnedProjects().filter((p) =>
      p.hiringMode === "team" || p.hiringMode === "both" || p.teamRecommended
    );
  }

  projectPickLabel(p) {
    const st = STATUS_LABEL[p.status] || p.status;
    return `${p.title} · ${st}`;
  }

  syncModeSwitch() {
    this.root.querySelectorAll(".em-mode-btn").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.mode === this.state.userMode);
    });
    const hero = this.root.querySelector(".em-app-hero-content");
    if (!hero) return;
    const h1 = hero.querySelector("h1");
    const p = hero.querySelector("p");
    if (h1) h1.textContent = this.state.userMode === "vergeben" ? "Arbeit vergeben." : "Arbeit findet dich.";
    if (p) {
      p.textContent = this.state.userMode === "vergeben"
        ? "Projekte einstellen, Teams holen, sicher über Treuhand abrechnen — ohne Arbeitsvertrag."
        : "Passende Projekte und Angebote — von 30 € bis 300.000 €. Solo oder als Team.";
    }
  }

  async refreshData() {
    const gen = ++this._refreshGen;
    try {
      const results = await Promise.all([
        api.market.meta(),
        api.market.list(),
        api.market.mine(),
        api.market.discover(),
        api.market.teams.list(),
        api.market.teams.mine().catch(() => []),
        api.market.profiles.me().catch(() => null),
        api.market.offers.list().catch(() => []),
        api.market.verification.me().catch(() => null),
        api.market.verification.providers().catch(() => ({ providers: [] })),
        api.market.collab.tasks.mine().catch(() => []),
        api.market.collab.suggestions().catch(() => ({ incoming: [], outgoing: [], forOwner: [] })),
        api.market.teams.requests().catch(() => ({ received: [], sent: [] })),
        api.market.payments.status().catch(() => null),
        api.market.notifications.list().catch(() => ({ items: [], unread: 0 })),
        api.market.workSamples.mine().catch(() => []),
        ...(FEATURES.showNetworkUi ? [
          api.market.organon.network().catch(() => []),
          api.market.organon.requests().catch(() => ({ incoming: [], outgoing: [] })),
          api.market.organon.delegations().catch(() => ({ sent: [], received: [] })),
          api.market.organon.bookings().catch(() => ({ sent: [], received: [] })),
        ] : []),
      ]);
      const [meta, projects, mine, discover, teams, myTeams, myProfile, offers, verif, verifProviders, myTasks, collabSugg, teamReq, paymentStatus, notifData, workSamples] = results;
      this.state.categories = meta.categories || [];
      this.state.weekStats = meta.weekStats || null;
      this.state.projects = projects;
      this.state.mine = mine;
      this.state.discover = discover;
      this.state.offers = offers;
      this.state.verification = verif;
      this.state.verificationProviders = verifProviders?.providers || [];
      this.state.teams = teams;
      this.state.myTeams = myTeams;
      this.state.myProfile = myProfile;
      this.state.myTasks = myTasks;
      this.state.collabSuggestions = collabSugg;
      this.state.teamRequests = teamReq || { received: [], sent: [] };
      this.state.paymentStatus = paymentStatus;
      this.state.notifications = notifData?.items || [];
      this.state.unreadNotifications = notifData?.unread || 0;
      this.state.workSamples = workSamples || [];
      if (FEATURES.showNetworkUi && results.length >= 20) {
        this.state.organon = {
          contacts: results[16] || [],
          requests: results[17] || { incoming: [], outgoing: [] },
          delegations: results[18] || { sent: [], received: [] },
          bookings: results[19] || { sent: [], received: [] },
        };
      } else {
        this.state.organon = { contacts: [], requests: { incoming: [], outgoing: [] }, delegations: { sent: [], received: [] }, bookings: { sent: [], received: [] } };
      }
      if (this.state.me?.role === "admin") {
        this.state.adminQueue = await api.market.adminQueue();
      }
      if (gen !== this._refreshGen || this.state.page !== "app") return;
      this.renderMain();
    } catch (e) {
      if (gen !== this._refreshGen) return;
      const msg = e?.message || "Daten konnten nicht geladen werden.";
      // Netzwerkfehler nur einmal zeigen (Login zeigt sie bereits im Formular)
      if (/Server nicht erreichbar|Failed to fetch/i.test(msg)) {
        if (!this._netToastAt || Date.now() - this._netToastAt > 8000) {
          this._netToastAt = Date.now();
          toast(msg.replace(/^Failed to fetch$/i, "Server nicht erreichbar — App neu starten."), { type: "err" });
        }
        return;
      }
      toast(msg, { type: "err" });
    }
  }

  destroyAppHero() {
    this._appHero?.destroy?.();
    this._appHero = null;
  }

  updateAppHeroVisibility() {
    const hero = this.root.querySelector("#em-app-hero");
    if (!hero) return;
    // Discover hat eigenen LegalBay-Hero — App-Canvas-Hero ausblenden
    hero.classList.add("is-hidden");
    this._appHero?.pause?.();
  }

  render() {
    if (this._landingDestroy) {
      this._landingDestroy();
      this._landingDestroy = null;
    }
    if (this.state.page !== "app") this.destroyAppHero();
    if (this.state.page === "landing") {
      const el = emLandingPage({
        onStart: () => { this.state.intent = null; this.goLogin(); },
        onBrowse: () => { this.state.intent = "offer"; this.goLogin(true); },
        onPath: (path) => { this.state.intent = path; this.goLogin(path === "offer"); },
        onLegal: (d) => this.goToLegal(d, "landing"),
      });
      this._landingDestroy = () => el.destroy?.();
      mount(this.root, el);
      return;
    }
    if (this.state.page === "legal") {
      mount(this.root, legalPage({ doc: this.state.legalDoc, onBack: () => { this.state.page = this.state.legalReturn; this.render(); } }));
      return;
    }
    if (this.state.page === "terms") {
      this.renderTerms();
      return;
    }
    if (this.state.page === "login") {
      this.renderLogin();
      return;
    }
    this.renderAppShell();
    this.renderMain();
  }

  goLogin(openMarkt = false) {
    loadLegalInfo().catch(() => {});
    this.state.page = "login";
    this._openMarktAfter = openMarkt;
    const stored = getCurrentUserId();
    const token = localStorage.getItem("abw_token");
    if (stored && token) {
      this.render();
      // Silent: bei totem Backend keine Extra-Toast neben dem Login-Formular
      this.proceedAfterAuth({ userId: stored, token, silent: true });
      return;
    }
    setCurrentUserId(null);
    setToken(null);
    this.render();
  }

  renderTerms() {
    const legal = getLegalInfoSync();
    let checked = false;
    const msg = h("div", { style: { color: "#ff3b30", fontSize: 13, minHeight: 18, marginTop: 10 } });
    const btn = h("button", { class: "em-btn em-btn-primary", style: { width: "100%", marginTop: 16 }, disabled: true }, "Akzeptieren & fortfahren");
    btn.addEventListener("click", async () => {
      if (!checked) return;
      btn.disabled = true;
      try {
        await api.user.acceptTerms(legal.termsVersion);
        toast("AGB akzeptiert.", { type: "ok" });
        this.enterApp();
      } catch (e) {
        msg.textContent = e.message;
        btn.disabled = false;
      }
    });
    mount(this.root,
      h("div", { class: "em-page" },
        h("nav", { class: "em-nav" },
          h("div", { class: "em-nav-inner" },
            h("button", { class: "em-brand", type: "button", onClick: () => { this.state.page = "landing"; this.render(); } }, "Projects")
          )
        ),
        h("main", { style: { maxWidth: 520, margin: "calc(var(--apple-nav-h) + 48px) auto 60px", padding: "0 22px" } },
          h("div", { class: "em-login-card" },
            h("h1", {}, "Bevor es losgeht"),
            h("p", {}, "Projects vermittelt Projekte zwischen Auftraggebern und Fachmenschen."),
          h("label", { style: { display: "flex", gap: 10, marginTop: 20, fontSize: 14, lineHeight: 1.5 } },
            h("input", { type: "checkbox", onChange: (ev) => { checked = ev.target.checked; btn.disabled = !checked; } }),
            h("span", {},
              "Ich akzeptiere ",
              h("button", { type: "button", style: { background: "none", border: "none", color: "var(--apple-blue)", cursor: "pointer", padding: 0 }, onClick: () => this.goToLegal("agb", "terms") }, "AGB"),
              ", ",
              h("button", { type: "button", style: { background: "none", border: "none", color: "var(--apple-blue)", cursor: "pointer", padding: 0 }, onClick: () => this.goToLegal("haftung", "terms") }, "Haftungsausschluss"),
              " und ",
              h("button", { type: "button", style: { background: "none", border: "none", color: "var(--apple-blue)", cursor: "pointer", padding: 0 }, onClick: () => this.goToLegal("datenschutz", "terms") }, "Datenschutz"),
              ". Keine Rechtsberatung — Nutzung auf eigenes Risiko. Projects haftet nicht für Leistungen Dritter."
            )
          ),
          btn, msg,
          h("button", { class: "em-btn em-btn-ghost", style: { width: "100%", marginTop: 12 }, onClick: () => this.signOut() }, "← Anderes Konto")
          )
        )
      )
    );
  }

  renderLogin() {
    loadLegalInfo().catch(() => {});
    const slot = h("div");
    const tabsEl = h("div", { class: "em-auth-tabs" });
    let mode = this.state.authMode || "login"; // login | register | forgot | verify | reset

    mount(this.root,
      h("div", { class: "em-page em-auth-page" },
        h("nav", { class: "em-nav" },
          h("div", { class: "em-nav-inner" },
            h("button", { class: "em-brand", type: "button", onClick: () => { this.state.page = "landing"; this.render(); } }, "Projects")
          )
        ),
        h("main", { class: "em-login-main" },
          h("div", { class: "em-auth-card" },
            tabsEl,
            slot
          ),
          legalFooterBar({ onLegal: (d) => this.goToLegal(d, "login"), compact: true })
        )
      )
    );

    const setMode = (next) => {
      mode = next;
      this.state.authMode = next;
      render();
    };

    const errorLine = () => h("div", { class: "em-auth-error" });
    const hintLine = (msg) => h("div", { class: "em-auth-hint" }, msg);

    const render = () => {
      mount(tabsEl,
        h("button", { class: `em-auth-tab ${mode === "login" || mode === "verify" || mode === "forgot" || mode === "reset" ? "is-active" : ""}`, type: "button", onClick: () => setMode("login") }, "Anmelden"),
        h("button", { class: `em-auth-tab ${mode === "register" ? "is-active" : ""}`, type: "button", onClick: () => setMode("register") }, "Registrieren"),
      );

      if (mode === "login") return renderLogin();
      if (mode === "verify") return renderVerify();
      if (mode === "register") return renderRegister();
      if (mode === "forgot") return renderForgot();
      if (mode === "reset") return renderReset();
    };

    const renderLogin = () => {
      const idIn = h("input", { class: "em-input", placeholder: "Benutzername oder E-Mail", autocomplete: "username" });
      const pwIn = h("input", { class: "em-input", type: "password", placeholder: "Passwort", autocomplete: "current-password" });
      const err = errorLine();
      const btn = h("button", { class: "em-btn em-btn-primary", type: "button", style: { width: "100%", marginTop: 8 } }, "Weiter");
      btn.addEventListener("click", async () => {
        err.textContent = "";
        btn.disabled = true;
        try {
          const res = await api.users.login(idIn.value.trim(), pwIn.value);
          if (res.twoFactorRequired) {
            this.state.authChallenge = { token: res.challengeToken, hint: res.hint, demoCode: res.demoCode };
            setMode("verify");
            return;
          }
          await this.proceedAfterAuth({ userId: res.id, token: res.token });
        } catch (e) {
          err.textContent = e.message;
        } finally {
          btn.disabled = false;
        }
      });
      const submit = (ev) => { if (ev.key === "Enter") btn.click(); };
      idIn.addEventListener("keydown", submit);
      pwIn.addEventListener("keydown", submit);

      mount(slot,
        h("h1", { class: "em-auth-title" }, "Willkommen zurück"),
        h("p", { class: "em-auth-lead" }, "Benutzername oder E-Mail eingeben."),
        h("label", { class: "em-label" }, "Benutzername oder E-Mail"),
        idIn,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "Passwort"),
        pwIn,
        btn,
        err,
        h("button", { class: "em-btn em-btn-ghost", type: "button", style: { width: "100%", marginTop: 12 }, onClick: () => setMode("forgot") }, "Passwort vergessen?"),
      );
      setTimeout(() => idIn.focus(), 0);
    };

    const renderRegister = () => {
      const legal = getLegalInfoSync();
      const nameIn = h("input", { class: "em-input", placeholder: "Vor- und Nachname" });
      const userIn = h("input", { class: "em-input", placeholder: "z. B. maria_mueller", autocomplete: "username" });
      const mailIn = h("input", { class: "em-input", type: "email", placeholder: "du@example.com", autocomplete: "email" });
      const pwIn = h("input", { class: "em-input", type: "password", placeholder: "mind. 8 Zeichen", autocomplete: "new-password" });
      const termsCb = h("input", { type: "checkbox" });
      const err = errorLine();
      const btn = h("button", { class: "em-btn em-btn-primary", type: "button", style: { width: "100%", marginTop: 12 }, disabled: true }, "Konto anlegen");
      termsCb.addEventListener("change", () => { btn.disabled = !termsCb.checked; });
      btn.addEventListener("click", async () => {
        err.textContent = "";
        btn.disabled = true;
        try {
          const res = await api.users.register({
            name: nameIn.value.trim(),
            loginName: userIn.value.trim(),
            email: mailIn.value.trim(),
            password: pwIn.value,
            termsAccepted: true,
            termsVersion: legal?.termsVersion,
          });
          toast("Konto angelegt — willkommen!", { type: "ok" });
          await this.proceedAfterAuth({ userId: res.id, token: res.token });
        } catch (e) {
          err.textContent = e.message;
          btn.disabled = false;
        }
      });

      mount(slot,
        h("h1", { class: "em-auth-title" }, "Neues Konto"),
        h("p", { class: "em-auth-lead" }, "Nur wenige Angaben — 2-Faktor-Schutz aktiv."),
        h("label", { class: "em-label" }, "Name"), nameIn,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "Benutzername"), userIn,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "E-Mail"), mailIn,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "Passwort"), pwIn,
        h("label", { class: "em-auth-terms" },
          termsCb,
          h("span", {},
            "Ich stimme den ",
            h("button", { type: "button", class: "em-auth-link", onClick: () => this.goToLegal("agb", "login") }, "AGB"),
            ", dem ",
            h("button", { type: "button", class: "em-auth-link", onClick: () => this.goToLegal("haftung", "login") }, "Haftungsausschluss"),
            " und der ",
            h("button", { type: "button", class: "em-auth-link", onClick: () => this.goToLegal("datenschutz", "login") }, "Datenschutzerklärung"),
            " zu."
          )
        ),
        btn, err
      );
    };

    const renderVerify = () => {
      const ch = this.state.authChallenge;
      if (!ch) { setMode("login"); return; }
      const codeIn = h("input", { class: "em-input em-input-code", placeholder: "6-stelliger Code", inputmode: "numeric", maxlength: 6, autocomplete: "one-time-code" });
      const err = errorLine();
      const btn = h("button", { class: "em-btn em-btn-primary", type: "button", style: { width: "100%", marginTop: 8 } }, "Anmelden");
      btn.addEventListener("click", async () => {
        err.textContent = "";
        btn.disabled = true;
        try {
          const res = await api.users.verify2fa(ch.token, codeIn.value.trim());
          this.state.authChallenge = null;
          toast("Angemeldet.", { type: "ok" });
          await this.proceedAfterAuth({ userId: res.id, token: res.token });
        } catch (e) {
          err.textContent = e.message;
          btn.disabled = false;
        }
      });
      codeIn.addEventListener("keydown", (ev) => { if (ev.key === "Enter") btn.click(); });

      const resendBtn = h("button", { class: "em-btn em-btn-ghost", type: "button", style: { width: "100%", marginTop: 8 } }, "Neuen Code senden");
      resendBtn.addEventListener("click", async () => {
        try {
          const r = await api.users.resend2fa(ch.token);
          this.state.authChallenge = { token: r.challengeToken, hint: ch.hint, demoCode: r.demoCode };
          codeIn.value = "";
          renderVerify();
          toast("Neuer Code gesendet.", { type: "ok" });
        } catch (e) { err.textContent = e.message; }
      });

      mount(slot,
        h("h1", { class: "em-auth-title" }, "Bestätigung"),
        h("p", { class: "em-auth-lead" }, ch.hint || "6-stelligen Code aus der E-Mail eingeben."),
        ch.demoCode ? h("div", { class: "em-auth-demo-code" },
          h("span", { class: "em-auth-demo-label" }, "Demo-Code"),
          h("code", {}, ch.demoCode),
          h("span", { class: "em-auth-demo-meta" }, "In Produktion: E-Mail-Zustellung.")
        ) : null,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "Code"), codeIn,
        btn, err, resendBtn,
        h("button", { class: "em-btn em-btn-ghost", type: "button", style: { width: "100%", marginTop: 4 }, onClick: () => { this.state.authChallenge = null; setMode("login"); } }, "← Zurück")
      );
      setTimeout(() => codeIn.focus(), 0);
    };

    const renderForgot = () => {
      const idIn = h("input", { class: "em-input", placeholder: "Benutzername oder E-Mail" });
      const err = errorLine();
      const btn = h("button", { class: "em-btn em-btn-primary", type: "button", style: { width: "100%", marginTop: 12 } }, "Reset-Code anfordern");
      btn.addEventListener("click", async () => {
        err.textContent = "";
        btn.disabled = true;
        try {
          const res = await api.users.forgot(idIn.value.trim());
          if (res.resetToken) {
            this.state.authReset = { token: res.resetToken, hint: res.hint, demoCode: res.demoCode };
            setMode("reset");
          } else {
            err.textContent = "";
            const hint = hintLine(res.message || "Falls das Konto existiert, wurde ein Code gesendet.");
            btn.insertAdjacentElement("afterend", hint);
            toast(res.message || "Falls das Konto existiert, wurde ein Code gesendet.", { type: "ok" });
          }
        } catch (e) {
          err.textContent = e.message;
        } finally { btn.disabled = false; }
      });
      mount(slot,
        h("h1", { class: "em-auth-title" }, "Passwort zurücksetzen"),
        h("p", { class: "em-auth-lead" }, "Wir senden dir einen Code."),
        h("label", { class: "em-label" }, "Benutzername oder E-Mail"), idIn,
        btn, err,
        h("button", { class: "em-btn em-btn-ghost", type: "button", style: { width: "100%", marginTop: 8 }, onClick: () => setMode("login") }, "← Zurück")
      );
    };

    const renderReset = () => {
      const info = this.state.authReset;
      if (!info) { setMode("forgot"); return; }
      const codeIn = h("input", { class: "em-input em-input-code", placeholder: "6-stelliger Code", inputmode: "numeric", maxlength: 6 });
      const pwIn = h("input", { class: "em-input", type: "password", placeholder: "neues Passwort (min. 8 Zeichen)" });
      const err = errorLine();
      const btn = h("button", { class: "em-btn em-btn-primary", type: "button", style: { width: "100%", marginTop: 12 } }, "Passwort setzen");
      btn.addEventListener("click", async () => {
        err.textContent = "";
        btn.disabled = true;
        try {
          await api.users.reset(info.token, codeIn.value.trim(), pwIn.value);
          this.state.authReset = null;
          toast("Passwort geändert — bitte einloggen.", { type: "ok" });
          setMode("login");
        } catch (e) {
          err.textContent = e.message;
        } finally { btn.disabled = false; }
      });
      mount(slot,
        h("h1", { class: "em-auth-title" }, "Neues Passwort"),
        info.hint ? h("p", { class: "em-auth-lead" }, info.hint) : null,
        info.demoCode ? h("div", { class: "em-auth-demo-code" },
          h("span", { class: "em-auth-demo-label" }, "Demo-Code"),
          h("code", {}, info.demoCode)
        ) : null,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "Code"), codeIn,
        h("label", { class: "em-label", style: { marginTop: 12 } }, "Neues Passwort"), pwIn,
        btn, err,
        h("button", { class: "em-btn em-btn-ghost", type: "button", style: { width: "100%", marginTop: 8 }, onClick: () => setMode("login") }, "← Zurück")
      );
    };

    render();
  }

  renderAppShell() {
    const tabs = [
      ...NAV.mobile,
      { ...NAV.primary, primary: true },
      { id: "anleitung", label: "Hilfe" },
    ];
    if (this.state.me?.role === "admin") tabs.push({ id: "admin", label: "Admin" });
    const deskTabs = [...NAV.desktop];
    if (FEATURES.showNetworkUi) {
      deskTabs.splice(4, 0, { id: "organon", label: "Netzwerk" }, { id: "netzwerk", label: "Karte" });
    }
    if (this.state.me?.role === "admin") deskTabs.push({ id: "admin", label: "Admin" });

    if (this._shellBuilt && this.root.querySelector(".em-app-wrap")) {
      this.syncNavActive();
      this.syncModeSwitch();
      // Admin-Tab nachträglich einhängen, falls Rolle erst nach Shell-Bau bekannt war
      const deskNavEl = this.root.querySelector(".em-desk-tabs");
      if (this.state.me?.role === "admin" && deskNavEl && !deskNavEl.querySelector('[data-tab="admin"]')) {
        const btn = h("button", { class: "em-desk-tab", type: "button", "data-tab": "admin" }, "Admin");
        btn.addEventListener("click", () => this.goTab("admin"));
        deskNavEl.appendChild(btn);
      }
      const mobileNav = this.root.querySelector(".em-tabs");
      if (this.state.me?.role === "admin" && mobileNav && !mobileNav.querySelector('[data-tab="admin"]')) {
        const btn = h("button", { class: "em-tab", type: "button", "data-tab": "admin" }, "Admin");
        btn.addEventListener("click", () => this.goTab("admin"));
        mobileNav.appendChild(btn);
      }
      this.updateAppHeroVisibility();
      return;
    }

    const main = h("main", { class: "em-app-main", id: "em-main" });
    const goTab = (id) => this.goTab(id);

    const appHero = h("section", { id: "em-app-hero", class: "em-app-hero" },
      h("canvas", {
        class: "em-hero-canvas",
        ref: (canvas) => {
          if (!canvas || this._appHero) return;
          import("./heroCanvas.js").then((m) => {
            this._appHero = m.mountHeroCanvas(canvas, { compact: true });
            this.updateAppHeroVisibility();
          });
        },
      }),
      h("div", { class: "em-app-hero-overlay" }),
      h("div", { class: "em-app-hero-content" },
        h("p", { class: "em-app-hero-greet" }, `Hallo, ${this.state.me?.name || "willkommen"}`),
        h("h1", {}, this.state.userMode === "vergeben" ? "Arbeit vergeben." : "Arbeit findet dich."),
        h("p", {}, this.state.userMode === "vergeben"
          ? "Projekte einstellen, Teams holen, sicher über Treuhand abrechnen — ohne Arbeitsvertrag."
          : "Passende Projekte und Angebote — von 30 € bis 300.000 €. Solo oder als Team."),
        h("div", { class: "em-app-hero-actions" },
          this.state.userMode === "vergeben"
            ? appleBtn("Neues Projekt", { onClick: () => goTab("erstellen") })
            : appleBtn("Projekte finden", { onClick: () => goTab("markt") }),
          appleBtn(this.state.userMode === "vergeben" ? "Meine Projekte" : "Leistungsangebote", {
            variant: "secondary",
            onClick: () => {
              if (this.state.userMode === "vergeben") {
                this.state.profileSection = "projekte";
                goTab("profil");
              } else goTab("angebote");
            },
          }),
        )
      )
    );

    const tabBar = h("nav", { class: "em-tabs" },
      ...tabs.map((t) => {
        const btn = h("button", {
          class: `em-tab${t.primary ? " em-tab-primary" : ""}${this.state.tab === t.id ? " is-active" : ""}`,
          type: "button",
          "data-tab": t.id,
        }, t.label);
        btn.addEventListener("click", () => goTab(t.id));
        return btn;
      })
    );
    const deskNav = h("div", { class: "em-desk-tabs" },
      ...deskTabs.map((t) => {
        const btn = h("button", { class: "em-desk-tab", type: "button", "data-tab": t.id }, t.label);
        btn.addEventListener("click", () => goTab(t.id));
        return btn;
      }),
      appleBtn(NAV.primary.label, { onClick: () => goTab(NAV.primary.id), className: "em-desk-new-btn" })
    );

    const brand = h("button", { class: "em-brand-wrap", type: "button", onClick: () => {
      this.state.tab = "entdecken";
      this.state.detailId = null;
      this.state.detailKind = null;
      if (this._networkDestroy) { this._networkDestroy(); this._networkDestroy = null; }
      this.renderAppShell();
      this.renderMain();
    } },
      h("span", { class: "em-brand-mark", "aria-hidden": "true" }, "P"),
      h("span", { class: "em-brand" }, "Projects")
    );
    const searchBtn = h("button", {
      type: "button",
      class: "em-nav-search-btn",
      "aria-label": "Suchen",
      onClick: () => this.openSearchOverlay(),
    }, "⌕");
    const setMode = (mode) => {
      this.state.userMode = mode;
      localStorage.setItem("em-user-mode", mode);
      if (mode === "vergeben") {
        if (this.state.tab === "markt" || this.state.tab === "angebote") this.state.tab = "erstellen";
      } else if (mode === "arbeiten") {
        if (this.state.tab === "erstellen") this.state.tab = "markt";
      }
      this._shellBuilt = false;
      this.renderAppShell();
      this.renderMain();
    };
    const modeSwitch = h("div", { class: "em-mode-switch", role: "group", "aria-label": "Arbeitsmodus" },
      ...[
        { id: "arbeiten", label: "Ich arbeite" },
        { id: "vergeben", label: "Ich vergebe" },
      ].map((m) => {
        const btn = h("button", {
          type: "button",
          class: `em-mode-btn${this.state.userMode === m.id ? " is-active" : ""}`,
          "data-mode": m.id,
        }, m.label);
        btn.addEventListener("click", () => setMode(m.id));
        return btn;
      })
    );
    const logout = h("button", { class: "em-nav-link em-nav-logout", type: "button", onClick: () => this.signOut() }, "Abmelden");

    const impersonateId = getImpersonateId();
    const impersonateBanner = impersonateId ? h("div", { class: "em-impersonate-bar" },
      h("span", {}, `Als ${this.state.me?.name} eingeloggt (Admin-Ansicht)`),
      h("button", { type: "button", onClick: () => { setImpersonateId(null); this.loadMe().then(() => { this._shellBuilt = false; this.renderAppShell(); this.refreshData(); }); } }, "Zurück zum Admin")
    ) : null;

    mount(this.root,
      h("div", { class: "em-app-wrap em-page" },
        impersonateBanner,
        h("nav", { class: "em-nav" },
          h("div", { class: "em-nav-inner" },
            brand, deskNav,
            h("div", { class: "em-nav-links" },
              searchBtn,
              modeSwitch,
              h("span", { style: { fontSize: 13, color: "var(--em-text-dim)" } }, this.state.me?.name || ""),
              logout
            )
          )
        ),
        appHero, main, tabBar,
        h("footer", { class: "em-app-footer" },
          h("p", { class: "em-app-footer-rules" }, "© 2026 Projects · Arbeit fair vergeben und leisten — mit Treuhandschutz."),
          h("div", { class: "em-app-footer-links" },
            ...["agb", "haftung", "datenschutz", "impressum"].map((doc) =>
              h("button", {
                type: "button",
                class: "em-nav-link",
                onClick: () => this.goToLegal(doc, "app"),
              }, doc === "agb" ? "AGB" : doc.charAt(0).toUpperCase() + doc.slice(1))
            ),
            h("button", { type: "button", class: "em-nav-link", onClick: () => goTab("anleitung") }, "Hilfe")
          )
        )
      )
    );
    this._shellBuilt = true;
    this.updateAppHeroVisibility();
  }

  renderMain() {
    const main = this.root.querySelector("#em-main");
    if (!main) return;
    this.syncNavActive();
    this.updateAppHeroVisibility();
    if (this.state.detailId) {
      if (this.state.detailKind === "profile") this.renderProfileDetail(main);
      else if (this.state.detailKind === "team") this.renderTeamDetail(main);
      else if (this.state.detailKind === "offer") this.renderOfferDetail(main);
      else this.renderDetail(main);
      return;
    }
    if (this.state.tab === "entdecken") this.renderDiscover(main);
    else if (this.state.tab === "anleitung") this.renderGuide(main);
    else if (this.state.tab === "hub") this.renderHub(main);
    else if (this.state.tab === "angebote") this.renderOffers(main);
    else if (this.state.tab === "organon") this.renderOrganon(main);
    else if (this.state.tab === "netzwerk") this.renderNetwork(main);
    else if (this.state.tab === "markt") this.renderMarket(main);
    else if (this.state.tab === "profil") this.renderProfileEdit(main);
    else if (this.state.tab === "teams") this.renderTeams(main);
    else if (this.state.tab === "meine") this.renderMine(main);
    else if (this.state.tab === "erstellen") this.renderCreate(main);
    else if (this.state.tab === "chat") this.renderChatList(main);
    else if (this.state.tab === "admin") this.renderAdmin(main);
  }

  syncNavActive() {
    this.root.querySelectorAll(".em-tab, .em-desk-tab").forEach((el) => {
      const tid = el.dataset.tab;
      const on = tid === "talent"
        ? (this.state.tab === "markt" && this.state.marketMode === "talent")
        : tid === "markt"
          ? (this.state.tab === "markt" && this.state.marketMode !== "talent")
          : tid === this.state.tab;
      el.classList.toggle("is-active", on);
    });
  }

  goTab(id, opts = {}) {
    if (this._networkDestroy) { this._networkDestroy(); this._networkDestroy = null; }
    if (id === "talent") {
      this.state.tab = "markt";
      this.state.marketMode = "talent";
    } else if (id === "organon") {
      // Netzwerk-UI aus — Buchungen & Konto im Hub
      this.state.tab = "hub";
    } else {
      this.state.tab = id;
      if (id === "markt") this.state.marketMode = opts.marketMode || "projects";
    }
    if (opts.profileSection) this.state.profileSection = opts.profileSection;
    this.state.detailId = null;
    this.state.detailKind = null;
    this.state._openChat = false;
    this.renderAppShell();
    this.renderMain();
  }

  renderGuide(main) {
    const page = renderGuidePage({
      onGoTab: (tab) => this.goTab(tab),
      onStart: () => this.goTab("erstellen"),
    });
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Hilfe & Anleitung"),
        h("p", { class: "lb-page-sub" }, "Schritt für Schritt — Festpreis, Teams, Wettbewerbe, Treuhand.")
      ),
      page
    );
    requestAnimationFrame(() => {
      const el = main.querySelector(".em-guide-page");
      if (el) import("./heroCanvas.js").then((m) => m.initScrollReveal(el));
    });
  }

  openProject(id) { this.state.detailKind = "project"; this.state.detailId = id; this.renderMain(); }
  openProfile(userId) { this.state.detailKind = "profile"; this.state.detailId = userId; this.renderMain(); }
  openTeam(id) { this.state.detailKind = "team"; this.state.detailId = id; this.renderMain(); }
  goBack() { this.state.detailId = null; this.state.detailKind = null; this.state._openChat = false; this.renderMain(); }

  showModal(innerEl, { wide } = {}) {
    const box = h("div", { class: `em-modal-inner${wide ? " em-modal-wide" : ""}` }, innerEl);
    const overlay = h("div", {
      class: "em-modal-overlay",
      onClick: (e) => { if (e.target === e.currentTarget) e.currentTarget.remove(); },
    }, box);
    document.body.appendChild(overlay);
    return overlay;
  }

  /** Person per Name suchen und einladen — ohne User-ID */
  renderPersonInviteSearch({ placeholder, hint, onInvite }) {
    const search = h("input", {
      class: "em-input em-input-big",
      placeholder: placeholder || "Name oder Skill eingeben …",
    });
    const results = h("div", { class: "em-team-search-results" });
    const run = async () => {
      try {
        const hits = await api.market.search.talent({ q: search.value.trim(), kind: "person" });
        const people = hits.filter((x) => x.userId);
        if (!people.length) {
          results.replaceChildren(h("p", { class: "em-muted" }, search.value.trim() ? "Keine Person gefunden." : "Tippe einen Namen — z. B. „Maria“, „Design“ …"));
          return;
        }
        results.replaceChildren(...people.slice(0, 6).map((person) =>
          h("div", { class: "em-team-search-row em-simple-card" },
            h("div", { class: "em-person-avatar" }, (person.name || "?")[0]),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { class: "em-person-name" }, person.name),
              h("div", { class: "em-person-headline" }, person.headline || "")
            ),
            appleBtn("Einladen", {
              onClick: async () => {
                try {
                  await onInvite(person.userId, person.name);
                } catch (e) { toast(e.message, { type: "err" }); }
              },
            }),
            appleBtn("Profil", { variant: "secondary", onClick: () => this.openProfile(person.userId) })
          )
        ));
      } catch (e) {
        results.replaceChildren(h("p", { class: "em-muted" }, e.message));
      }
    };
    search.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    return h("div", { class: "em-invite-search" },
      hint ? h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, hint) : null,
      h("div", { class: "em-invite-search-row" }, search, appleBtn("Suchen", { onClick: run })),
      results
    );
  }

  openSimpleTaskModal(participants, { projectId, onDone }) {
    this.showModal(renderSimpleTaskForm(participants, {
      onCancel: () => document.querySelector(".em-modal-overlay")?.remove(),
      onSubmit: async (data) => {
        await api.market.collab.tasks.create({
          projectId,
          assigneeUserId: data.assigneeUserId,
          title: data.title,
          outcome: data.outcome,
          dueDate: data.dueDate,
          description: data.outcome,
        });
        toast("Aufgabe gesendet", { type: "ok" });
        document.querySelector(".em-modal-overlay")?.remove();
        onDone?.();
      },
    }), { wide: true });
  }

  tabHero(tabId, extraSubtitle, { canvas = false } = {}) {
    const copy = TAB_COPY[tabId] || { title: tabId, subtitle: "" };
    const sub = typeof copy.subtitle === "function"
      ? copy.subtitle(this.state.userMode)
      : (extraSubtitle || copy.subtitle);
    if (!canvas) return applePageHero(copy.title, sub);
    const wrap = h("section", { class: "em-hero-strip-wrap" });
    const canvasEl = h("canvas", { class: "em-hero-strip-canvas", "aria-hidden": "true" });
    wrap.appendChild(canvasEl);
    wrap.appendChild(h("div", { class: "em-hero-strip-inner em-hero-compact" },
      h("h1", {}, copy.title),
      h("p", {}, sub)
    ));
    const stop = mountHeroCanvas(canvasEl, { strip: true });
    this._stripHeroStop?.();
    this._stripHeroStop = stop;
    return wrap;
  }

  pageHeroStrip(title, subtitle) {
    const wrap = h("section", { class: "em-hero-strip-wrap" });
    const canvasEl = h("canvas", { class: "em-hero-strip-canvas", "aria-hidden": "true" });
    wrap.appendChild(canvasEl);
    wrap.appendChild(h("div", { class: "em-hero-strip-inner em-hero-compact" },
      h("h1", {}, title),
      subtitle ? h("p", {}, subtitle) : null
    ));
    const stop = mountHeroCanvas(canvasEl, { strip: true });
    this._stripHeroStop?.();
    this._stripHeroStop = stop;
    return wrap;
  }

  breadcrumbNav(items) {
    return appleBreadcrumb(items, {
      onNavigate: (item) => {
        if (item.tab) {
          this.state.tab = item.tab;
          if (item.section) this.state.profileSection = item.section;
          this.goBack();
        }
      },
    });
  }

  openOffer(id) { this.state.detailKind = "offer"; this.state.detailId = id; this.renderMain(); }

  profileCard(p) {
    const wm = workModeTag(p.workMode);
    return applePersonTile({
      name: p.verified ? `${p.name} · GEPRÜFT` : p.name,
      headline: p.headline || "Fachmensch",
      badge: [wm.label, p.rank ? p.rank.toUpperCase() : null].filter(Boolean).join(" · "),
      rating: p.rating || null,
      meta: p.location || null,
      onClick: () => this.openProfile(p.userId),
    });
  }

  teamCard(t) {
    const kindLabel = t.preset ? "EINGESPIELT · Bündnis" : "Festes Team";
    return appleInsertCard({
      eyebrow: kindLabel,
      title: t.name,
      subtitle: t.tagline || "",
      priceLine: `${t.memberCount} Mitglieder${t.openToJoin ? " · Offen" : ""}`,
      ratelLine: t.teamRating ? `★ ${t.teamRating}` : null,
      badge: t.preset ? "Bündnis" : "Team",
      emoji: t.heroEmoji || (t.preset ? "🤝" : "👥"),
      accent: t.heroAccent || "#0071e3",
      theme: t.heroTheme || (t.preset ? "dark" : "light"),
      cta: "Team ansehen",
      paymentHint: t.openToJoin ? "Beitritt möglich" : "Auf Anfrage",
      onClick: () => this.openTeam(t.id),
    });
  }

  hubCard(title, subtitle, onClick, badge) {
    return h("button", { type: "button", class: "lb-listing-card lb-hub-tile", onClick },
      badge ? h("div", { class: "lb-listing-badges" }, h("span", { class: "lb-badge lb-badge-pay" }, badge)) : null,
      h("h3", { class: "lb-listing-title" }, title),
      h("p", { class: "lb-listing-desc" }, subtitle)
    );
  }

  renderHub(main) {
    const tasks = this.state.myTasks?.filter((t) => t.status === "open").length || 0;
    const owned = this.state.mine?.owned?.length || 0;
    const pendingReq = this.state.teamRequests?.received?.length || 0;
    const unread = this.state.unreadNotifications || 0;
    const pay = this.state.paymentStatus || {};
    const go = (tab, profileSection) => this.goTab(tab, { profileSection });
    const reqSection = pendingReq ? applePanel("Team-Anfragen", (this.state.teamRequests.received || []).map((r) =>
      h("div", { class: "em-request-card" },
        h("h3", {}, r.type === "project_team" ? `Projekt: ${r.projectTitle || "Team-Anfrage"}` : `Team: ${r.teamName}`),
        h("p", { class: "em-muted" }, r.message || `Von ${r.fromName}`),
        r.projectBudgetCents ? h("p", {}, formatEUR(r.projectBudgetCents)) : null,
        h("div", { class: "em-request-actions" },
          appleBtn("Annehmen", {
            onClick: async () => {
              try {
                const res = await api.market.teams.acceptRequest(r.id);
                toast(res.staffed ? "Angenommen — Projekt besetzt" : "Angenommen", { type: "ok" });
                this.refreshData();
              } catch (e) { toast(e.message, { type: "err" }); }
            },
          }),
          appleBtn("Ablehnen", {
            variant: "secondary",
            onClick: async () => {
              try {
                await api.market.teams.declineRequest(r.id);
                toast("Abgelehnt", { type: "ok" });
                this.refreshData();
              } catch (e) { toast(e.message, { type: "err" }); }
            },
          })
        )
      )
    )) : null;
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Konto"),
        h("p", { class: "lb-page-sub" }, "Profil, Zahlung, Anfragen und Schnellzugriff — ein Konto für beide Rollen.")
      ),
      applePanel("Grundregeln", [
        h("ul", { class: "em-guide-rules" }, ...GRUNDREGELN.map((r) => h("li", {}, r))),
      ]),
      appleErsteSchritte(
        ERSTE_SCHRITTE.map((s) => ({ ...s, done: s.check(this.state) })),
        {
          done: ERSTE_SCHRITTE.filter((s) => s.check(this.state)).length,
          total: ERSTE_SCHRITTE.length,
          onStep: (s) => go(s.tab, s.section),
        }
      ),
      reqSection,
      applePanel("Zahlung & Auszahlung (Treuhand)", [
        h("p", { class: "em-muted" }, pay.mode === "simulation"
          ? "Demo-Modus — Stripe-Keys in .env für Live-Zahlungen."
          : "Stripe Connect — echte Treuhand aktiv."),
        h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 } },
          appleBtn(pay.payoutReady ? "Auszahlung ✓" : "Auszahlungskonto verbinden", {
            variant: pay.payoutReady ? "secondary" : "primary",
            onClick: async () => {
              try {
                const r = await api.market.payments.onboardPayout();
                if (r.url) window.open(r.url, "_blank");
                toast(r.message || "Auszahlung eingerichtet", { type: "ok" });
                this.refreshData();
              } catch (e) { toast(e.message, { type: "err" }); }
            },
          }),
          appleBtn(pay.paymentReady ? "Zahlungsmittel ✓" : "Zahlungsmittel hinterlegen", {
            variant: pay.paymentReady ? "secondary" : "primary",
            onClick: async () => {
              try {
                const r = await api.market.payments.setupClient();
                if (r.url) window.open(r.url, "_blank");
                toast(r.message || "Zahlungsmittel hinterlegt", { type: "ok" });
                this.refreshData();
              } catch (e) { toast(e.message, { type: "err" }); }
            },
          }),
        ),
      ]),
      unread ? applePanel("Benachrichtigungen", [
        h("p", { class: "em-muted" }, `${unread} ungelesen`),
        ...(this.state.notifications || []).filter((n) => !n.read).slice(0, 5).map((n) =>
          h("div", { class: "em-request-card", style: { marginTop: 8 } },
            h("strong", {}, n.title),
            h("p", { class: "em-muted" }, n.body),
            n.linkProjectId ? appleBtn("Öffnen", {
              variant: "secondary",
              onClick: () => { this.openProject(n.linkProjectId); api.market.notifications.read(n.id); },
            }) : null
          )
        ),
        appleBtn("Alle gelesen", {
          variant: "secondary",
          onClick: async () => { await api.market.notifications.readAll(); this.refreshData(); },
        }),
      ]) : null,
      h("div", { class: "lb-card-grid", style: { marginTop: 8 } },
        this.hubCard("Meine Projekte", `${owned} erstellt · vergeben & offen`, () => go("profil", "projekte"), owned ? String(owned) : null),
        this.hubCard("Profil bearbeiten", "Skills, Verfügbarkeit, Arbeitsweise", () => go("profil", "profil")),
        this.hubCard("Aufgaben", tasks ? `${tasks} offen` : "Keine offenen To-dos", () => go("profil", "aufgaben"), tasks ? String(tasks) : null),
        this.hubCard("Nachrichten", "Chats zu laufenden Projekten", () => go("chat")),
        this.hubCard("Teams & Bündnisse", "Übersicht, Anfragen, Delegation", () => go("teams"), pendingReq ? String(pendingReq) : null),
        this.hubCard("Leistungsangebote", "Festpreis-Pakete buchen", () => go("angebote")),
        this.state.me?.role === "admin"
          ? this.hubCard("Administration", `${(this.state.adminQueue || []).length} in Prüfung · Nutzer & Freigaben`, () => go("admin"), (this.state.adminQueue || []).length ? String(this.state.adminQueue.length) : "Admin")
          : null,
      ),
      applePanel("Schnellstart", [
        h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
          appleBtn("Projekt einstellen", { onClick: () => go("erstellen") }),
          appleBtn("Marktplatz", { variant: "secondary", onClick: () => go("markt") }),
          appleBtn("Hilfe", { variant: "secondary", onClick: () => go("anleitung") }),
          this.state.me?.role === "admin"
            ? appleBtn("Admin", { variant: "secondary", onClick: () => go("admin") })
            : null,
        ),
      ])
    );
  }

  renderDiscover(main) {
    const { projects = [], teams = [], profiles = [] } = this.state.discover;
    const offers = this.state.discover.offers || [];
    const go = (tab, section, marketMode) => {
      if (marketMode === "talent") this.goTab("talent");
      else this.goTab(tab, { profileSection: section, marketMode });
    };
    const catFilter = this.state.discoverCat || "all";
    const filteredProjects = catFilter === "all"
      ? projects
      : projects.filter((p) => p.category === catFilter);
    const cats = [
      { id: "all", label: "Alle", icon: "✨", grad: "from-blue-500 to-blue-600" },
      { id: "software", label: "Software", icon: "💻", grad: "from-blue-500 to-indigo-600" },
      { id: "design", label: "Design", icon: "🎨", grad: "from-pink-500 to-rose-600" },
      { id: "management", label: "Management", icon: "📊", grad: "from-slate-600 to-slate-800" },
      { id: "handwerk", label: "Handwerk", icon: "🔧", grad: "from-green-500 to-emerald-600" },
      { id: "recht", label: "Recht", icon: "⚖️", grad: "from-violet-500 to-purple-600" },
      { id: "wissenschaft", label: "Wissenschaft", icon: "🔬", grad: "from-cyan-500 to-teal-600" },
      { id: "sonstiges", label: "Sonstiges", icon: "💡", grad: "from-orange-500 to-amber-600" },
    ];
    const grads = [
      "linear-gradient(135deg,#0071e3,#2997ff)",
      "linear-gradient(135deg,#af52de,#ff375f)",
      "linear-gradient(135deg,#ff375f,#ff9f0a)",
      "linear-gradient(135deg,#1d1d1f,#636366)",
      "linear-gradient(135deg,#34c759,#30b0c7)",
      "linear-gradient(135deg,#5e5ce6,#0071e3)",
      "linear-gradient(135deg,#30b0c7,#64d2ff)",
      "linear-gradient(135deg,#ff9f0a,#ffcc00)",
    ];

    mount(main,
      /* LegalBay-Home: weicher Intro-Block mit CTAs — Projects-Copy */
      h("section", { class: "lb-home-hero" },
        h("div", { class: "lb-home-hero-inner" },
          h("h1", { class: "lb-home-title" },
            "Arbeit finden.",
            h("br"),
            h("span", { class: "lb-home-title-accent" }, "Fair vergeben.")
          ),
          h("p", { class: "lb-home-sub" },
            "Stelle Projekte ein. Erhalte Bewerbungen von Fachleuten und Teams. Vergleiche Preise, NDA und Treuhand — ohne Arbeitsvertrag."
          ),
          h("div", { class: "lb-home-ctas" },
            appleBtn(this.state.userMode === "vergeben" ? "Projekt einstellen" : "Projekte durchsuchen", {
              onClick: () => go(this.state.userMode === "vergeben" ? "erstellen" : "markt", null, "projects"),
            }),
            appleBtn("Fachleute finden", {
              variant: "secondary",
              onClick: () => go("markt", null, "talent"),
            })
          )
        )
      ),

      /* Kategorien wie LegalBay Rechtsgebiete → Projects-Kategorien */
      h("section", { class: "lb-home-section" },
        h("h2", { class: "lb-section-title" }, "Kategorien"),
        h("p", { class: "lb-section-sub" }, "Finde Expertise für dein Vorhaben."),
        h("div", { class: "lb-cat-scroll" },
          ...cats.map((c, i) =>
            h("button", {
              type: "button",
              class: `lb-cat-tile${catFilter === c.id ? " is-on" : ""}`,
              onClick: () => {
                this.state.discoverCat = c.id;
                if (c.id !== "all") {
                  this.state.marketFilters = { ...(this.state.marketFilters || {}), category: c.id };
                  go("markt", null, "projects");
                } else this.renderMain();
              },
            },
              h("div", { class: "lb-cat-icon", style: { background: grads[i % grads.length] } }, c.icon),
              h("span", { class: "lb-cat-name" }, c.label)
            )
          )
        )
      ),

      /* Aktuelle Projekte = LegalBay „Aktuelle Fälle“ als Grid */
      h("section", { class: "lb-home-section lb-home-section-alt" },
        h("div", { class: "lb-section-head" },
          h("div", {},
            h("h2", { class: "lb-section-title" }, "Aktuelle Projekte"),
            h("p", { class: "lb-section-sub" }, "Offene Aufträge — Solo, Team oder Wettbewerb.")
          ),
          appleBtn("Alle anzeigen", {
            variant: "secondary",
            onClick: () => go("markt", null, "projects"),
          })
        ),
        filteredProjects.length
          ? h("div", { class: "lb-card-grid" },
            ...filteredProjects.slice(0, 6).map((p) => this.projectCard(p, () => this.openProject(p.id)))
          )
          : h("p", { class: "em-muted" }, "Keine offenen Projekte in dieser Kategorie.")
      ),

      /* Featured Karussell (Apple-Store-Feeling, Projects-Inhalt) */
      filteredProjects.length ? h("section", { class: "lb-home-section" },
        h("h2", { class: "lb-section-title" }, "Hervorgehoben"),
        h("p", { class: "lb-section-sub" }, "Große Karten — Preis, Zahlungsart und NDA auf einen Blick."),
        appleCarousel(filteredProjects.slice(0, 8).map((p) => this.buildInsertCard(p)))
      ) : null,

      /* Angebote + Teams kurz */
      offers.length ? h("section", { class: "lb-home-section lb-home-section-alt" },
        h("div", { class: "lb-section-head" },
          h("div", {},
            h("h2", { class: "lb-section-title" }, "Leistungsangebote"),
            h("p", { class: "lb-section-sub" }, "Festpreis-Pakete von Fachleuten.")
          ),
          appleBtn("Alle Angebote", { variant: "secondary", onClick: () => go("angebote") })
        ),
        h("div", { class: "lb-card-grid" },
          ...offers.slice(0, 3).map((o) =>
            h("article", {
              class: "lb-listing-card",
              onClick: () => this.openOffer(o.id),
            },
              h("div", { class: "lb-listing-badges" },
                h("span", { class: "lb-badge lb-badge-pay" }, "Paket"),
                h("span", { class: "lb-badge lb-badge-cat" }, catLabel(o.category))
              ),
              h("h3", { class: "lb-listing-title" }, o.title),
              h("p", { class: "lb-listing-desc" }, o.subtitle || o.sellerName || ""),
              h("div", { class: "lb-listing-meta" },
                h("div", { class: "lb-meta-row" },
                  h("span", { class: "lb-meta-label" }, "Ab"),
                  h("span", { class: "lb-meta-value" }, o.priceFromCents ? formatEUR(o.priceFromCents) : "—")
                )
              )
            )
          )
        )
      ) : null,

      /* Stats wie LegalBay */
      h("section", { class: "lb-home-section" },
        h("div", { class: "lb-stats" },
          h("div", { class: "lb-stat" },
            h("div", { class: "lb-stat-icon", style: { background: grads[0] } }, "📋"),
            h("p", { class: "lb-stat-num" }, String(Math.max(projects.length, 12)) + "+"),
            h("p", { class: "lb-stat-label" }, "Offene Projekte")
          ),
          h("div", { class: "lb-stat" },
            h("div", { class: "lb-stat-icon", style: { background: grads[5] } }, "👥"),
            h("p", { class: "lb-stat-num" }, String(Math.max(profiles.length, 20)) + "+"),
            h("p", { class: "lb-stat-label" }, "Fachleute & Teams")
          ),
          h("div", { class: "lb-stat" },
            h("div", { class: "lb-stat-icon", style: { background: grads[4] } }, "🔒"),
            h("p", { class: "lb-stat-num" }, "Treuhand"),
            h("p", { class: "lb-stat-label" }, "Geld erst nach Abnahme")
          )
        )
      ),

      /* Fachleute = LegalBay Anwaltsverzeichnis-Teaser */
      h("section", { class: "lb-home-section lb-home-section-alt" },
        h("div", { class: "lb-section-head" },
          h("div", {},
            h("h2", { class: "lb-section-title" }, "Fachleute"),
            h("p", { class: "lb-section-sub" }, "Geprüft, bewertet, bereit für Realisierung.")
          ),
          appleBtn("Alle Fachleute", {
            variant: "secondary",
            onClick: () => go("markt", null, "talent"),
          })
        ),
        h("div", { class: "lb-card-grid" },
          ...(profiles.length
            ? profiles.slice(0, 6).map((p) =>
              h("article", {
                class: "lb-person-card",
                onClick: () => this.openProfile(p.userId),
              },
                h("div", { class: "em-person-avatar", style: { width: 48, height: 48, fontSize: 20, marginBottom: 12 } }, (p.name || "?")[0]),
                h("h3", { class: "lb-listing-title", style: { fontSize: 17 } }, p.name),
                h("p", { class: "lb-listing-desc" }, p.headline || "Fachmensch"),
                h("div", { class: "lb-listing-meta", style: { marginTop: 12 } },
                  p.rating ? h("div", { class: "lb-meta-row" },
                    h("span", { class: "lb-meta-label" }, "Bewertung"),
                    h("span", { class: "lb-meta-value" }, `★ ${p.rating}`)
                  ) : null,
                  h("div", { class: "lb-meta-row" },
                    h("span", { class: "lb-meta-label" }, "Ort"),
                    h("span", { class: "lb-meta-value" }, p.location || "Remote")
                  )
                )
              )
            )
            : [h("p", { class: "em-muted" }, "Keine Profile.")])
        )
      ),

      /* Hilfe-Karten */
      h("section", { class: "lb-home-section" },
        h("h2", { class: "lb-section-title" }, "Schnellstart"),
        h("p", { class: "lb-section-sub" }, "Drei Wege — wie bei LegalBay Fälle, hier für Projekte."),
        h("div", { class: "apple-help-grid" },
          appleHelpCard({
            eyebrow: "Vergeben",
            title: "Projekt in 3 Schritten einstellen",
            text: "Titel, Budget, NDA — Zahlung erst nach Abnahme.",
            cta: "Jetzt starten",
            onClick: () => go("erstellen"),
            accent: "#f5f5f7",
          }),
          appleHelpCard({
            eyebrow: "Teams",
            title: "Bündnis buchen oder selbst gründen",
            text: "Eingespielte Teams anfragen — oder Mitglieder einladen.",
            cta: "Teams öffnen",
            onClick: () => go("teams"),
            accent: "#eef1ff",
          }),
          appleHelpCard({
            eyebrow: "Konto",
            title: "Treuhand & Auszahlung einrichten",
            text: "Einmal verknüpfen — dann läuft die Abrechnung.",
            cta: "Konto",
            onClick: () => go("hub"),
            accent: "#e8f6ec",
          })
        )
      )
    );
  }

  buildInsertCard(p) {
    const mode = p.hiringMode || (p.teamRecommended ? "team" : "solo");
    const nda = (p.ndaLevel || 0) > 0;
    const modeLabel = mode === "team" ? "Team" : mode === "both" ? "Solo oder Team" : "Solo";
    let priceLine = formatEUR(p.budgetCents);
    let rateLine = null;
    let payHint = null;
    if (p.payModel === "success") { payHint = "Erfolgsbasiert"; rateLine = p.successFee || null; }
    else if (p.payModel === "time") { payHint = "Auf Zeit"; rateLine = p.durationLabel; }
    else if (p.payModel === "contest") { payHint = "Wettbewerb"; rateLine = p.contestDeadline ? `Deadline: ${new Date(p.contestDeadline).toLocaleDateString("de-DE")}` : null; }
    else if (p.payModel === "quantity") { payHint = "Pro Einheit"; rateLine = p.unitPriceCents ? `${formatEUR(p.unitPriceCents)}/${p.unitLabel || "Einheit"}` : null; }
    else { payHint = `Festpreis · ${modeLabel}`; rateLine = p.durationLabel; }
    let splitHint = null;
    if (Array.isArray(p.splitAllocations) && p.splitAllocations.length >= 2) {
      const total = p.splitAllocations.reduce((s, a) => s + (a.amountCents || 0), 0) || 1;
      const parts = p.splitAllocations
        .map((a) => Math.round((a.amountCents / total) * 100))
        .join(" / ");
      splitHint = `${parts} Split`;
    } else if (p.splitMode === "equal") splitHint = "Gleichmäßig";
    else if (p.splitMode === "shares") splitHint = "Anteile";
    return appleInsertCard({
      eyebrow: p.eyebrowTag || catLabel(p.category),
      title: p.title,
      subtitle: p.location ? `${p.location} · ${p.durationLabel || ""}`.trim() : (p.durationLabel || "Remote"),
      priceLine: `Ab ${priceLine}`,
      ratelLine: rateLine,
      badge: nda ? (p.ndaLevel >= 3 ? "NEU · GEHEIM" : "NEU") : "NEU",
      emoji: p.heroEmoji,
      accent: p.heroAccent,
      theme: p.heroTheme,
      cta: "Details ansehen",
      paymentHint: payHint,
      splitHint,
      nda,
      onClick: () => this.openProject(p.id),
    });
  }

  buildOfferInsertCard(o) {
    return appleInsertCard({
      eyebrow: o.verified ? "GEPRÜFT" : catLabel(o.category),
      title: o.title,
      subtitle: o.subtitle,
      priceLine: o.priceFromCents ? `Ab ${formatEUR(o.priceFromCents)}` : "Preis auf Anfrage",
      ratelLine: `${o.sellerName} · ★ ${o.rating || "–"}`,
      badge: "Paket",
      emoji: o.category === "design" ? "🎨" : o.category === "recht" ? "⚖️" : o.category === "handwerk" ? "🔧" : "💼",
      accent: o.category === "design" ? "#ff375f" : "#0071e3",
      theme: "light",
      cta: "Paket ansehen",
      paymentHint: "Festpreis",
      onClick: () => this.openOffer(o.id),
    });
  }

  renderOffers(main) {
    const offers = this.state.offers || [];
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Leistungsangebote"),
        h("p", { class: "lb-page-sub" }, "Festpreis-Pakete mit Frist und Treuhand — Freigabe erst nach Abnahme.")
      ),
      offers.length
        ? h("div", { class: "lb-card-grid" },
          ...offers.map((o) => h("article", {
            class: "lb-listing-card",
            onClick: () => this.openOffer(o.id),
          },
            h("div", { class: "lb-listing-badges" },
              h("span", { class: "lb-badge lb-badge-pay" }, "Festpreis"),
              h("span", { class: "lb-badge lb-badge-cat" }, o.sellerVerified ? "Geprüft" : catLabel(o.category)),
              o.remote ? h("span", { class: "lb-badge lb-badge-success" }, "Remote") : null
            ),
            h("h3", { class: "lb-listing-title" }, o.title),
            h("p", { class: "lb-listing-desc" }, o.subtitle || `${o.sellerName || "Anbieter"}`),
            h("div", { class: "lb-listing-meta" },
              h("div", { class: "lb-meta-row" },
                h("span", { class: "lb-meta-label" }, "Ab"),
                h("span", { class: "lb-meta-value" }, o.tiers?.[0] ? formatEUR(o.tiers[0].priceCents) : "—")
              ),
              h("div", { class: "lb-meta-row" },
                h("span", { class: "lb-meta-label" }, "Anbieter"),
                h("span", { class: "lb-meta-value" }, `${o.sellerName || "—"} · ★ ${o.rating ?? "–"}`)
              )
            )
          ))
        )
        : appleEmptyState({
          title: "Noch keine Angebote",
          text: "Festpreis-Pakete erscheinen hier, sobald Fachleute welche einstellen.",
          ctaLabel: "Zur Anleitung",
          onCta: () => this.goTab("anleitung"),
        }),
      h("p", { class: "em-muted", style: { marginTop: 24, fontSize: 14, textAlign: "center" } },
        "Treuhand · Freigabe erst nach Abnahme · ",
        h("button", { type: "button", class: "apple-link", style: { fontSize: 14 }, onClick: () => this.goToLegal("haftung", "app") }, "Haftungsausschluss lesen")
      )
    );
  }

  async renderOfferDetail(main) {
    mount(main, loadingView());
    try {
      const o = await api.market.offers.get(this.state.detailId);
      mount(main,
        this.breadcrumbNav([
          { label: "Leistungsangebote", tab: "angebote" },
          { label: o.title, current: true },
        ]),
        h("div", { class: "apple-detail-hero" },
          h("p", { class: "apple-detail-price" }, o.sellerVerified ? "GEPRÜFT · " : "", `${o.sellerName} · ★ ${o.rating}`),
          h("h1", { class: "apple-detail-title" }, o.title),
          h("p", { class: "apple-page-sub" }, o.subtitle)
        ),
        o.process ? applePanel("So läuft es ab", [h("p", { style: { margin: 0, lineHeight: 1.5 } }, o.process)]) : null,
        applePanel("Pakete", (o.tiers || []).map((t) =>
          h("div", { class: "apple-bid-card" },
            h("div", { class: "apple-bid-head" },
              h("h3", { class: "apple-bid-name" }, t.name),
              h("div", { class: "apple-bid-price" }, formatEUR(t.priceCents))
            ),
            h("p", { class: "apple-bid-meta" }, `${t.days} Tage · ${(t.features || []).join(" · ")}`),
            appleBtn("Paket buchen — Geld liegt sicher", { onClick: async () => {
              try {
                await api.market.payments.setupClient().catch(() => {});
                const res = await api.market.offers.book(o.id, { tierId: t.id });
                toast(res.message || "Buchungsanfrage gesendet", { type: "ok" });
                if (res.bookingId && res.canPayNow) {
                  try {
                    const pay = await api.market.payments.payBooking(res.bookingId);
                    toast(`${formatEUR(pay.escrowHeldCents || t.priceCents)} in Treuhand — Leistung abwarten, dann freigeben.`, { type: "ok" });
                  } catch (payErr) {
                    toast(`Gebucht — Zahlung unter Konto: ${payErr.message}`, { type: "warn" });
                  }
                }
                this.state.tab = "hub";
                this.refreshData();
                this.renderMain();
              } catch (e) { toast(e.message, { type: "err" }); }
            } })
          )
        )),
        h("p", { class: "em-muted", style: { fontSize: 13, marginTop: 16 } },
          "Projects haftet nicht für die Erbringung der Leistung. ",
          h("button", { type: "button", class: "apple-link", style: { fontSize: 13 }, onClick: () => this.goToLegal("haftung", "app") }, "Haftungsausschluss")
        )
      );
    } catch (e) {
      mount(main, h("p", {}, e.message), appleLink("Zurück", () => this.goBack()));
    }
  }

  renderOrganon(main) {
    const { contacts = [], requests = { incoming: [], outgoing: [] }, delegations = { sent: [], received: [] }, bookings = { sent: [], received: [] } } = this.state.organon || {};
    const pending = requests.incoming?.length || 0;
    const children = [
      this.tabHero("organon"),
    ];
    if (pending) children.push(h("div", { class: "em-organon-alert" }, `${pending} offene Netz-Anfrage${pending > 1 ? "n" : ""}`));

    const netSection = [];
    if (contacts.length) {
      netSection.push(h("div", { class: "apple-person-grid" },
        ...contacts.map((c) => applePersonTile({
          name: c.name,
          headline: c.headline,
          onClick: () => this.openProfile(c.userId),
        }))
      ));
    } else netSection.push(h("p", { class: "em-muted" }, "Noch keine Verbindungen — sende Netz-Anfragen über Profile."));
    children.push(applePanel("Mein Netzwerk", netSection));

    const reqChildren = [];
    if (requests.incoming?.length) {
      for (const r of requests.incoming) {
        reqChildren.push(h("div", { class: "apple-bid-card" },
          h("h3", { class: "apple-bid-name" }, r.fromName),
          r.message ? h("p", { class: "apple-bid-msg" }, r.message) : null,
          h("div", { class: "apple-bid-actions" },
            appleBtn("Bestätigen", { onClick: async () => {
              await api.market.organon.acceptRequest(r.id);
              toast("Vernetzt", { type: "ok" });
              this.refreshData();
            } }),
            appleBtn("Ablehnen", { variant: "secondary", onClick: async () => {
              await api.market.organon.rejectRequest(r.id);
              this.refreshData();
            } })
          )
        ));
      }
    } else reqChildren.push(h("p", { class: "em-muted" }, "Keine offenen Anfragen."));
    children.push(applePanel("Eingehende Anfragen", reqChildren));

    const delItems = [...(delegations.received || []), ...(delegations.sent || [])];
    const delChildren = [];
    if (!delItems.length) delChildren.push(h("p", { class: "em-muted" }, "Keine delegierten Aufgaben."));
    else for (const d of delItems) {
      delChildren.push(h("div", { class: "apple-bid-card" },
        h("h3", { class: "apple-bid-name" }, d.title),
        h("p", { class: "apple-bid-meta" }, d.teamName ? `${d.fromName} → Team ${d.teamName}` : `${d.fromName} → ${d.toName}`),
        h("span", { class: "em-tag" }, d.status),
        d.status === "pending" && d.toUserId === this.state.me?.id ? h("div", { class: "apple-bid-actions" },
          appleBtn("Annehmen", { onClick: async () => { await api.market.organon.acceptDelegation(d.id); this.refreshData(); } }),
          appleBtn("Ablehnen", { variant: "secondary", onClick: async () => { await api.market.organon.declineDelegation(d.id); this.refreshData(); } })
        ) : null,
        d.status === "active" ? appleBtn("Als erledigt markieren", { onClick: async () => {
          await api.market.organon.completeDelegation(d.id);
          toast("Erledigt", { type: "ok" });
          this.refreshData();
        } }) : null
      ));
    }
    children.push(applePanel("Delegierte Aufgaben", delChildren));

    const bookItems = [...(bookings.received || []), ...(bookings.sent || [])];
    const bookChildren = [];
    if (!bookItems.length) bookChildren.push(h("p", { class: "em-muted" }, "Keine Buchungsanfragen."));
    else for (const b of bookItems) {
      const isOffer = Boolean(b.offerId);
      bookChildren.push(h("div", { class: "apple-bid-card" },
        h("h3", { class: "apple-bid-name" }, isOffer ? (b.message?.split(":")[0]?.replace("Buchungsanfrage", "Leistung") || "Leistungsangebot") : (b.slotLabel || "Terminanfrage")),
        h("p", { class: "apple-bid-msg" }, b.message),
        h("p", { class: "apple-bid-meta" }, `${b.fromName} → ${b.toName}`),
        h("span", { class: "em-tag" }, b.paymentStatus === "held" ? "Bezahlt (Treuhand)" : b.paymentStatus === "released" ? "Ausgezahlt" : b.status),
        b.status === "pending" && b.toUserId === this.state.me?.id && !isOffer ? h("div", { class: "apple-bid-actions" },
          appleBtn("Bestätigen", { onClick: async () => { await api.market.organon.confirmBooking(b.id); this.refreshData(); } }),
          appleBtn("Ablehnen", { variant: "secondary", onClick: async () => { await api.market.organon.declineBooking(b.id); this.refreshData(); } })
        ) : null,
        isOffer && b.fromUserId === this.state.me?.id && !b.paymentStatus ? h("div", { class: "apple-bid-actions" },
          appleBtn("Jetzt bezahlen (Treuhand)", { onClick: async () => {
            try {
              await api.market.payments.setupClient().catch(() => {});
              const pay = await api.market.payments.payBooking(b.id);
              toast(`${formatEUR(pay.escrowHeldCents)} in Treuhand`, { type: "ok" });
              this.refreshData();
            } catch (e) { toast(e.message, { type: "err" }); }
          } })
        ) : null,
        isOffer && b.fromUserId === this.state.me?.id && b.paymentStatus === "held" ? h("div", { class: "apple-bid-actions" },
          appleBtn("Leistung freigeben & auszahlen", { onClick: async () => {
            try {
              const rel = await api.market.payments.releaseBooking(b.id);
              toast(`${formatEUR(rel.netCents)} an Anbieter ausgezahlt`, { type: "ok" });
              this.refreshData();
            } catch (e) { toast(e.message, { type: "err" }); }
          } })
        ) : null
      ));
    }
    children.push(applePanel("Buchungen", bookChildren));

    mount(main, ...children);
  }

  async renderNetwork(main) {
    mount(main,
      applePageHero("Netzwerkkarte", "Personen, Teams und Projekte — verbunden und erkundbar."),
      h("div", { id: "em-network-host" })
    );
    try {
      const graph = await api.market.network();
      this.state.network = graph;
      const host = main.querySelector("#em-network-host");
      if (this._networkDestroy) this._networkDestroy();
      this._networkDestroy = mountNetworkMap(host, graph, {
        onNodeClick: (n) => {
          if (n.type === "person" && n.userId) this.openProfile(n.userId);
          else if (n.type === "team" && n.teamId) this.openTeam(n.teamId);
          else if (n.type === "project" && n.projectId) this.openProject(n.projectId);
        },
      });
    } catch (e) {
      toast(e.message, { type: "err" });
    }
  }

  renderProfileEdit(main) {
    const section = this.state.profileSection || "profil";
    const tabBar = h("div", { class: "em-profile-tabs" },
      ...[
        { id: "profil", label: "Profil" },
        { id: "projekte", label: "Meine Projekte" },
        { id: "aufgaben", label: "Aufgaben" },
        { id: "nachrichten", label: "Nachrichten" },
      ].map((t) => {
        const btn = h("button", { type: "button", class: `em-profile-tab${section === t.id ? " is-active" : ""}` }, t.label);
        btn.addEventListener("click", () => { this.state.profileSection = t.id; this.renderProfileEdit(main); });
        return btn;
      })
    );

    if (section === "projekte") {
      const owned = this.state.mine?.owned || [];
      mount(main,
        h("div", { class: "lb-page-head" },
          h("h1", { class: "lb-page-title" }, "Meine Projekte"),
          h("p", { class: "lb-page-sub" }, "Erstellte Projekte — Besetzung, Einladungen und Aufgaben.")
        ),
        tabBar,
        h("div", { style: { marginBottom: 16 } },
          appleBtn("Neues Projekt", { onClick: () => this.goTab("erstellen") })
        ),
        owned.length
          ? h("div", { class: "lb-card-grid" }, ...owned.map((p) => this.projectCard(p, () => this.openProject(p.id))))
          : h("p", { class: "em-muted" }, "Noch keine eigenen Projekte.")
      );
      return;
    }

    if (section === "aufgaben") {
      const tasks = this.state.myTasks || [];
      const sugg = this.state.collabSuggestions || {};
      mount(main,
        applePageHero("Aufgaben", "Konkrete To-dos von Auftraggebern — getrennt von Nachrichten."),
        tabBar,
        ...(tasks.length ? tasks.map((t) =>
          h("div", { class: "apple-bid-card", style: { marginTop: 8 } },
            h("h3", { class: "apple-bid-name" }, t.title),
            h("p", { class: "apple-bid-meta" }, `${t.projectTitle} · von ${t.fromName}`),
            t.description ? h("p", { class: "apple-bid-msg" }, t.description) : null,
            h("span", { class: "em-tag" }, t.status === "done" ? "Erledigt" : "Offen"),
            t.status === "open" ? appleBtn("Als erledigt markieren", {
              onClick: async () => {
                await api.market.collab.tasks.done(t.id);
                toast("Erledigt", { type: "ok" });
                this.refreshData();
              },
            }) : null
          )
        ) : [h("p", { class: "em-muted" }, "Noch keine Aufgaben.")]),
        (sugg.incoming?.length || sugg.forOwner?.length) ? applePanel("Offene Anfragen", [
          ...(sugg.incoming || []).map((s) =>
            h("div", { class: "apple-bid-card" },
              h("h3", { class: "apple-bid-name" }, s.projectTitle),
              h("p", { class: "apple-bid-msg" }, `${s.fromName}: ${s.message || "Kooperation"}`),
              h("div", { class: "apple-bid-actions" },
                appleBtn("Zustimmen", { onClick: async () => { await api.market.collab.acceptSuggestion(s.id); this.refreshData(); } }),
                appleBtn("Ablehnen", { variant: "secondary", onClick: async () => { await api.market.collab.declineSuggestion(s.id); this.refreshData(); } })
              )
            )
          ),
        ]) : null
      );
      return;
    }

    if (section === "nachrichten") {
      mount(main,
        applePageHero("Nachrichten", "Chats zu laufenden Projekten."),
        tabBar,
        appleBtn("Nachrichten öffnen", { onClick: () => { this.state.tab = "chat"; this.renderMain(); } })
      );
      return;
    }

    const p = this.state.myProfile || {};
    const verif = this.state.verification || {};
    const providers = this.state.verificationProviders || [];
    const headline = h("input", { class: "em-input", value: p.headline || "" });
    const bio = h("textarea", { class: "em-input", rows: 5 }, p.bio || "");
    const location = h("input", { class: "em-input", value: p.location || "" });
    const skills = h("input", { class: "em-input", value: (p.skills || []).join(", "), placeholder: "React, Management, …" });
    const rate = h("input", { class: "em-input", type: "number", value: p.hourlyRateCents ? p.hourlyRateCents / 100 : "" });
    const workMode = h("select", { class: "em-input" },
      h("option", { value: "solo", selected: p.workMode === "solo" }, "Nur solo arbeiten"),
      h("option", { value: "team", selected: p.workMode === "team" }, "Nur im Team"),
      h("option", { value: "both", selected: !p.workMode || p.workMode === "both" }, "Solo & Team")
    );
    const msg = h("div", { style: { color: "#ff3b30", fontSize: 13 } });
    const verifSlot = h("div");

    const renderVerif = () => {
      if (verif.status === "verified" || p.verified) {
        mount(verifSlot, h("div", { class: "em-organon-alert" }, "Profil verifiziert — Ausweis und Video bestätigt."));
        return;
      }
      const children = [
        h("p", { class: "em-muted", style: { margin: "0 0 16px" } },
          "Verifizierung über externen Anbieter: Ausweis-Scan + Video/Selfie. Projects speichert keine Ausweiskopien."
        ),
      ];
      if (verif.status === "pending" && verif.provider === "demo" && verif.demoSteps) {
        for (const step of verif.demoSteps) {
          children.push(h("div", { class: "apple-choice", style: { marginBottom: 8 } },
            h("span", {}, step.done ? "✓ " : "○ ", step.label),
            !step.done ? appleBtn("Abschließen", {
              onClick: async () => {
                await api.market.verification.demoStep(step.id);
                this.state.verification = await api.market.verification.me();
                await this.refreshData();
                renderVerif();
              },
            }) : null
          ));
        }
      } else if (verif.status === "pending" && verif.redirectUrl) {
        children.push(appleBtn("Weiter zur Verifizierung", { onClick: () => window.open(verif.redirectUrl, "_blank") }));
      } else {
        children.push(h("div", { class: "apple-filter-bar" },
          ...providers.filter((pr) => pr.available).map((pr) =>
            appleBtn(pr.name, {
              variant: "secondary",
              onClick: async () => {
                try {
                  const res = await api.market.verification.start(pr.id);
                  this.state.verification = res;
                  if (res.redirectUrl) window.open(res.redirectUrl, "_blank");
                  toast(res.message || "Verifizierung gestartet", { type: "ok" });
                  renderVerif();
                } catch (e) { toast(e.message, { type: "err" }); }
              },
            })
          )
        ));
      }
      children.push(h("p", { style: { fontSize: 12, color: "var(--apple-text-tertiary)", marginTop: 12 } },
        "Anbieter: Persona, Veriff, Onfido — API-Keys in .env konfigurieren."
      ));
      mount(verifSlot, ...children);
    };
    renderVerif();

    const samplesEl = h("div", { class: "em-work-samples" });
    const paintSamples = () => {
      const list = this.state.workSamples || [];
      samplesEl.replaceChildren(
        h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Fähigkeits-Beweis — nur Belegtes zählt. Mindestens eine Probe zum Bewerben."),
        ...(list.length ? list.map((s) =>
          h("div", { class: "em-simple-card", style: { marginBottom: 8 } },
            h("strong", {}, s.title),
            s.link ? h("p", {}, h("a", { href: s.link, target: "_blank", rel: "noopener" }, "Ansehen")) : null,
            h("p", { class: "em-muted" }, s.description?.slice(0, 120) || ""),
            appleBtn("Entfernen", {
              variant: "secondary",
              onClick: async () => {
                await api.market.workSamples.remove(s.id);
                this.state.workSamples = await api.market.workSamples.mine();
                paintSamples();
                this.refreshData();
              },
            })
          )
        ) : [h("p", { class: "em-muted" }, "Noch keine Arbeitsprobe.")]),
        appleBtn("+ Arbeitsprobe hinzufügen", {
          onClick: () => {
            const t = prompt("Titel der Arbeit (z. B. Logo fuer Startup X)");
            if (!t?.trim()) return;
            const link = prompt("Link (PDF, GitHub, Drive …)", "") || "";
            const desc = prompt("Kurzbeschreibung", "") || "";
            api.market.workSamples.add({ title: t.trim(), link, description: desc }).then(async () => {
              this.state.workSamples = await api.market.workSamples.mine();
              paintSamples();
              this.refreshData();
              toast("Arbeitsprobe gespeichert", { type: "ok" });
            }).catch((e) => toast(e.message, { type: "err" }));
          },
        })
      );
    };
    paintSamples();

    const save = h("button", { class: "em-btn em-btn-primary", style: { width: "100%", marginTop: 16 } }, "Profil speichern");
    save.addEventListener("click", async () => {
      try {
        this.state.myProfile = await api.market.profiles.save({
          headline: headline.value,
          bio: bio.value,
          location: location.value,
          skills: skills.value.split(",").map((s) => s.trim()).filter(Boolean),
          hourlyRateCents: Math.round(Number(rate.value || 0) * 100),
          workMode: workMode.value,
          public: true,
        });
        toast("Profil gespeichert", { type: "ok" });
        this.refreshData();
      } catch (e) { msg.textContent = e.message; }
    });
    mount(main,
      applePageHero("Dein Fachprofil", "Zeig, was du anbietest — und ob du solo oder im Team arbeitest."),
      tabBar,
      applePanel("Identität verifizieren", [verifSlot]),
      h("label", { class: "em-label" }, "Headline"), headline,
      h("label", { class: "em-label", style: { marginTop: 12 } }, "Über mich"), bio,
      h("label", { class: "em-label", style: { marginTop: 12 } }, "Skills (kommagetrennt)"), skills,
      h("label", { class: "em-label", style: { marginTop: 12 } }, "Ort"), location,
      h("label", { class: "em-label", style: { marginTop: 12 } }, "Stundensatz (€)"), rate,
      h("label", { class: "em-label", style: { marginTop: 12 } }, "Arbeitsweise"), workMode,
      applePanel("Arbeitsproben (Fähigkeits-Beweis)", [samplesEl]),
      save, msg,
      h("p", { class: "em-muted", style: { marginTop: 24, fontSize: 13 } },
        "Nutzung auf eigenes Risiko. ",
        h("button", { type: "button", class: "apple-link", style: { fontSize: 13 }, onClick: () => this.goToLegal("haftung", "app") }, "Haftungsausschluss")
      )
    );
  }

  async renderProfileDetail(main) {
    mount(main, loadingView());
    try {
      const p = await api.market.profiles.get(this.state.detailId);
      const wm = workModeTag(p.workMode);
      const isSelf = p.userId === this.state.me?.id;
      const userProjects = await api.market.profiles.projects(p.userId).catch(() => []);
      const myProjects = [
        ...this.inviteableOwnedProjects(),
        ...(this.state.mine?.assigned || []).filter((x) => ["open", "assigned"].includes(x.status)),
      ];
      const inviteables = this.inviteableOwnedProjects();

      const actions = h("div", { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 24 } });
      if (!isSelf) {
        const projectPick = h("select", { class: "em-input" },
          h("option", { value: "" }, "Projekt wählen…"),
          ...myProjects.map((pr) => h("option", { value: pr.id }, this.projectPickLabel(pr)))
        );
        const coworkMsg = h("input", { class: "em-input", placeholder: "Kurze Nachricht (optional)" });
        actions.append(
          applePanel("Mit dieser Person zusammenarbeiten", [
            h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Projekt vorschlagen oder gemeinsame Bearbeitung anfragen. Stimmt die Person zu, wird der Projekt-Ersteller informiert."),
            projectPick, coworkMsg,
            h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 } },
              appleBtn("Projekt vorschlagen", { onClick: async () => {
                if (!projectPick.value) return toast("Projekt wählen", { type: "err" });
                await api.market.collab.suggestProject({ projectId: Number(projectPick.value), toUserId: p.userId, message: coworkMsg.value });
                toast("Vorschlag gesendet", { type: "ok" });
              } }),
              appleBtn("Gemeinsam bewerben", { variant: "secondary", onClick: async () => {
                if (!projectPick.value) return toast("Projekt wählen", { type: "err" });
                await api.market.collab.requestCowork({ projectId: Number(projectPick.value), withUserId: p.userId, message: coworkMsg.value });
                toast("Anfrage gesendet — wartet auf Zustimmung", { type: "ok" });
              } }),
            ),
          ])
        );
        if (inviteables.length) {
          const inviteProject = h("select", { class: "em-input" },
            h("option", { value: "" }, "Projekt wählen…"),
            ...inviteables.map((pr) => h("option", { value: pr.id }, this.projectPickLabel(pr)))
          );
          actions.append(
            applePanel("Als Auftraggeber einladen", [
              h("p", { class: "em-muted", style: { margin: "0 0 10px" } }, "Auch Projekte „In Prüfung“ erscheinen hier — Einladung sofort möglich."),
              inviteProject,
              appleBtn("Zum Projekt einladen", { onClick: async () => {
                if (!inviteProject.value) return toast("Projekt wählen", { type: "err" });
                try {
                  await api.market.collab.sendInvite({ projectId: Number(inviteProject.value), userId: p.userId });
                  toast("Einladung gesendet", { type: "ok" });
                } catch (e) { toast(e.message, { type: "err" }); }
              } }),
            ])
          );
        } else {
          actions.append(
            applePanel("Als Auftraggeber einladen", [
              h("p", { class: "em-muted" }, "Noch kein eigenes Projekt. Stelle zuerst eines ein — danach erscheint es hier."),
              appleBtn("Projekt einstellen", { onClick: () => this.goTab("erstellen") }),
            ])
          );
        }
      }

      mount(main,
        this.breadcrumbNav([
          { label: "Marktplatz", tab: "markt" },
          { label: p.name, current: true },
        ]),
        h("div", { class: "em-profile-hero" },
          h("div", { class: "em-person-avatar em-person-avatar-lg" }, (p.name || "?")[0]),
          h("h1", { class: "apple-page-title", style: { fontSize: 40 } }, p.name),
          h("p", { class: "apple-page-sub" }, p.headline),
          h("p", { class: "em-muted", style: { fontSize: 13 } }, `Profil-ID: ${p.userId}`),
          h("div", { class: "em-tags", style: { justifyContent: "center" } },
            h("span", { class: `em-tag ${wm.cls}` }, wm.label),
            p.rating ? h("span", { class: "em-tag em-tag-green" }, `★ ${p.rating} · ${p.completedCount} Projekte`) : null,
            p.verified ? h("span", { class: "em-tag em-tag-green" }, "GEPRÜFT") : null,
          )
        ),
        appleSpecSheet([
          ["Standort", p.location || "—"],
          ["Arbeitsweise", wm.label],
          ["Stundensatz", p.hourlyRateCents ? formatEUR(p.hourlyRateCents) + "/Std." : "—"],
          ["Verfügbarkeit", p.availability || "—"],
        ]),
        p.bio ? applePanel("Über mich", [h("p", { style: { lineHeight: 1.6, margin: 0 } }, p.bio)]) : null,
        p.skills?.length ? applePanel("Skills", [h("div", { class: "em-tags" }, ...p.skills.map((s) => h("span", { class: "em-tag" }, s)))]) : null,
        p.rating ? applePanel("Verlässlichkeit", [
          h("div", { class: "apple-badge-grid" },
            h("div", { class: "apple-badge is-earned" }, `★ ${p.rating} Bewertung`),
            h("div", { class: "apple-badge is-earned" }, `${p.completedCount} Projekte`),
            ...(p.badges || []).map((b) => h("div", { class: "apple-badge is-earned" }, b)),
          ),
        ]) : null,
        userProjects.length ? applePanel(isSelf ? "Meine erstellten Projekte" : "Erstellte Projekte", userProjects.map((pr) =>
          h("div", { class: "em-project-card", style: { marginTop: 8 }, onClick: () => this.openProject(pr.id) },
            h("div", {},
              h("div", { style: { fontWeight: 650 } }, pr.title),
              h("div", { class: "em-tags", style: { marginTop: 6 } },
                ...projectTags(pr).map((t) => h("span", { class: `em-tag ${t.cls}` }, t.label))
              ),
              pr.staffingLabel ? h("p", { class: "em-muted", style: { fontSize: 13, margin: "6px 0 0" } }, pr.staffingLabel) : null
            ),
            h("div", { class: "em-project-price" }, formatEUR(pr.budgetCents))
          )
        )) : null,
        actions,
        p.teams?.length ? applePanel("Teams", p.teams.map((t) =>
          h("div", { class: "em-team-card", style: { marginTop: 8 }, onClick: () => this.openTeam(t.id) },
            h("strong", {}, t.name), h("div", { class: "em-person-headline" }, t.tagline)
          )
        )) : null
      );
    } catch (e) {
      mount(main, h("p", {}, e.message), h("button", { class: "em-btn em-btn-ghost", onClick: () => this.goBack() }, "Zurück"));
    }
  }

  renderTeams(main) {
    if (!this.state.teamWay) this.state.teamWay = "bundle";
    const slot = h("div", { class: "em-teams-page" });
    const myTeams = this.state.myTeams || [];
    const allTeams = this.state.teams || [];
    const teamProjects = this.teamRequestProjects();
    const inviteables = this.inviteableOwnedProjects();
    const openTasks = (this.state.myTasks || []).filter((t) => t.status === "open");

    const projectSelect = (projects, emptyLabel = "Projekt wählen…") => {
      const sel = h("select", { class: "em-input em-teams-select" },
        h("option", { value: "" }, emptyLabel),
        ...projects.map((pr) => h("option", { value: pr.id }, this.projectPickLabel(pr)))
      );
      return sel;
    };

    const paint = () => {
      const way = this.state.teamWay;
      const requestProjectPick = projectSelect(teamProjects.length ? teamProjects : inviteables, "Projekt für Team-Anfrage…");

      const requestTeam = async (teamId) => {
        const pid = Number(requestProjectPick.value);
        if (!pid) {
          if (!inviteables.length) return toast("Zuerst ein Projekt einstellen — dann Team anfragen.", { type: "err" });
          return toast("Bitte oben ein Projekt wählen.", { type: "err" });
        }
        try {
          const t = allTeams.find((x) => x.id === teamId) || myTeams.find((x) => x.id === teamId);
          await api.market.teams.requestForProject(teamId, pid);
          toast(`Anfrage an ${t?.name || "Team"} gesendet`, { type: "ok" });
          this.refreshData();
        } catch (e) { toast(e.message, { type: "err" }); }
      };

      let wayBody = null;
      if (way === "self") {
        wayBody = h("div", { class: "em-teams-way-panel" },
          h("h3", {}, "Personen einzeln holen"),
          h("p", { class: "em-muted" }, "Fachleute suchen, Profil öffnen, zum Projekt einladen — auch bei Projekten „In Prüfung“."),
          h("div", { class: "em-teams-cta-row" },
            appleBtn("Fachleute suchen", { onClick: () => this.goTab("talent") }),
            appleBtn("Projekt einstellen", { variant: "secondary", onClick: () => this.goTab("erstellen") }),
          )
        );
      } else if (way === "bundle") {
        wayBody = h("div", { class: "em-teams-way-panel" },
          h("h3", {}, "Fertiges Team für Projekt anfragen"),
          h("p", { class: "em-muted" }, "Projekt wählen, dann Bündnis anfragen — alle Mitglieder bekommen die Anfrage."),
          requestProjectPick,
          !teamProjects.length && !inviteables.length
            ? h("p", { class: "em-muted", style: { marginTop: 10 } }, "Noch kein Projekt — zuerst unter „Projekt einstellen“ anlegen.")
            : null,
          renderBundleList(allTeams, {
            onOpen: (id) => this.openTeam(id),
            onRequest: requestTeam,
            myProjectTitle: requestProjectPick.value
              ? inviteables.find((p) => String(p.id) === requestProjectPick.value)?.title
              : null,
          })
        );
      } else {
        wayBody = h("div", { class: "em-teams-way-panel" },
          renderCreateTeamForm({
            onCreate: async ({ name, tagline }) => {
              try {
                const created = await api.market.teams.create({ name, tagline });
                toast("Team erstellt — jetzt Mitglieder einladen", { type: "ok" });
                await this.refreshData();
                if (created?.id) this.openTeam(created.id);
              } catch (e) { toast(e.message, { type: "err" }); }
            },
          })
        );
      }

      const myTeamGrid = myTeams.length
        ? h("div", { class: "em-teams-grid" }, ...myTeams.map((t) =>
          h("article", { class: "em-teams-tile", onClick: () => this.openTeam(t.id) },
            h("div", { class: "em-teams-tile-top" },
              h("span", { class: "em-teams-emoji" }, t.heroEmoji || (t.preset ? "🤝" : "👥")),
              h("span", { class: "em-teams-chip" }, t.preset ? "Bündnis" : (t.ownerId === this.state.me?.id ? "Owner" : "Mitglied")),
            ),
            h("h3", {}, t.name),
            h("p", {}, t.tagline || "Kein Slogan"),
            h("div", { class: "em-teams-tile-meta" },
              h("span", {}, `${t.memberCount || t.members?.length || 0} Personen`),
              t.teamRating ? h("span", {}, `★ ${t.teamRating}`) : h("span", {}, "Neu"),
            ),
            h("div", { class: "em-teams-tile-actions" },
              h("button", {
                type: "button",
                class: "em-btn em-btn-primary",
                onClick: (ev) => { ev.stopPropagation(); this.openTeam(t.id); },
              }, "Öffnen"),
              h("button", {
                type: "button",
                class: "em-btn em-btn-ghost",
                onClick: (ev) => {
                  ev.stopPropagation();
                  this.openTeam(t.id);
                  // Detail zeigt Delegation
                },
              }, "Aufgaben"),
            )
          )
        ))
        : h("div", { class: "em-teams-empty" },
          h("p", {}, "Noch kein eigenes Team."),
          appleBtn("Team gründen", { onClick: () => { this.state.teamWay = "create"; paint(); } }),
        );

      mount(slot,
        h("div", { class: "lb-page-head" },
          h("h1", { class: "lb-page-title" }, "Teams"),
          h("p", { class: "lb-page-sub" }, "Übersicht, Anfragen und Aufgaben-Delegation — klar getrennt.")
        ),
        h("div", { class: "em-teams-stats" },
          h("div", { class: "em-teams-stat" }, h("strong", {}, String(myTeams.length)), h("span", {}, "Deine Teams")),
          h("div", { class: "em-teams-stat" }, h("strong", {}, String(allTeams.length)), h("span", {}, "Im Markt")),
          h("div", { class: "em-teams-stat" }, h("strong", {}, String(openTasks.length)), h("span", {}, "Offene Aufgaben")),
          h("div", { class: "em-teams-stat" }, h("strong", {}, String(inviteables.length)), h("span", {}, "Deine Projekte")),
        ),
        h("section", { class: "em-teams-section" },
          h("div", { class: "em-teams-section-head" },
            h("h2", {}, "Deine Teams"),
            h("p", {}, "Antippen für Mitglieder, Einladungen und Aufgaben."),
          ),
          myTeamGrid,
        ),
        openTasks.length ? h("section", { class: "em-teams-section" },
          h("div", { class: "em-teams-section-head" },
            h("h2", {}, "Deine offenen Aufgaben"),
            h("p", {}, "Aus Projekten und Team-Delegation."),
          ),
          h("div", { class: "em-teams-task-list" },
            ...openTasks.slice(0, 8).map((t) =>
              h("div", { class: "em-teams-task-row" },
                h("div", {},
                  h("strong", {}, t.title),
                  h("p", { class: "em-muted" }, t.projectTitle || "Projekt"),
                ),
                t.projectId ? appleBtn("Öffnen", {
                  variant: "secondary",
                  onClick: () => this.openProject(t.projectId),
                }) : null,
              )
            )
          ),
        ) : null,
        h("section", { class: "em-teams-section" },
          h("div", { class: "em-teams-section-head" },
            h("h2", {}, "Team finden oder gründen"),
            h("p", {}, "Drei Wege — Auswahl bestimmt den nächsten Schritt."),
          ),
          renderTeamWayPicker(way, (id) => { this.state.teamWay = id; paint(); }),
          wayBody,
        ),
        h("section", { class: "em-teams-section" },
          h("div", { class: "em-teams-section-head" },
            h("h2", {}, "Alle Teams im Markt"),
            h("p", {}, "Bündnisse und feste Teams — Details und Anfrage im Klick."),
          ),
          h("div", { class: "em-teams-grid em-teams-grid-market" },
            ...allTeams.slice(0, 24).map((t) => this.teamCard(t))
          ),
        ),
      );
    };
    paint();
    mount(main, slot);
  }

  async renderTeamDetail(main) {
    mount(main, loadingView());
    try {
      const t = await api.market.teams.get(this.state.detailId);
      const isMember = t.members?.some((m) => m.userId === this.state.me?.id);
      const isOwner = t.ownerId === this.state.me?.id;
      const memberSearch = h("input", { class: "em-input em-input-big", placeholder: "Name oder Skill — z. B. Maria, Design …" });
      const memberResults = h("div", { class: "em-team-search-results" });

      const runMemberSearch = async () => {
        try {
          const hits = await api.market.teams.searchMembers(t.id, memberSearch.value);
          if (!hits.length) {
            mount(memberResults, h("p", { class: "em-muted" }, memberSearch.value.trim() ? "Keine Treffer." : "Tippe zum Suchen — z. B. „React“, „Design“, Name …"));
            return;
          }
          mount(memberResults, ...hits.map((person) =>
            h("div", { class: "em-team-search-row" },
              h("div", { class: "em-person-avatar" }, (person.name || "?")[0]),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { class: "em-person-name" }, person.name),
                h("div", { class: "em-person-headline" }, person.headline || ""),
                h("p", { class: "em-muted", style: { fontSize: 12, margin: "4px 0 0" } }, (person.skills || []).join(" · "))
              ),
              appleBtn("Einladen", {
                onClick: async () => {
                  try {
                    await api.market.teams.addMember(t.id, person.userId);
                    toast(`Einladung an ${person.name} gesendet`, { type: "ok" });
                  } catch (e) { toast(e.message, { type: "err" }); }
                },
              }),
              appleBtn("Profil", { variant: "secondary", onClick: () => this.openProfile(person.userId) })
            )
          ));
        } catch (e) {
          mount(memberResults, h("p", { class: "em-muted" }, e.message));
        }
      };
      memberSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") runMemberSearch(); });

      mount(main,
        this.breadcrumbNav([
          { label: "Teams", tab: "teams" },
          { label: t.name, current: true },
        ]),
        h("div", { class: "apple-detail-hero" },
          h("p", { class: "apple-detail-price" }, `${t.memberCount} Mitglieder${t.preset ? " · EINGESPIELT" : ""}`),
          h("h1", { class: "apple-detail-title" }, t.name),
          h("p", { class: "apple-page-sub" }, t.tagline)
        ),
        appleSpecSheet([
          ["Team-Bewertung", t.teamRating ? `★ ${t.teamRating}` : "—"],
          ["Gemeinsame Projekte", t.sharedProjects != null ? String(t.sharedProjects) : "—"],
          ["Ø früher fertig", t.avgDaysEarly != null ? `${t.avgDaysEarly} Tage` : "—"],
          ["Team-Tagessatz", t.teamDayRateCents ? formatEUR(t.teamDayRateCents) : "—"],
        ]),
        applePanel("Mitglieder", (t.members || []).map((m) =>
          h("div", { class: "em-person-card", style: { marginTop: 8 } },
            h("div", { class: "em-person-avatar", onClick: () => this.openProfile(m.userId) }, (m.name || "?")[0]),
            h("div", { style: { flex: 1 } },
              h("div", { class: "em-person-name", onClick: () => this.openProfile(m.userId) }, m.name),
              h("div", { class: "em-person-headline" }, m.headline || m.role),
              h("span", { class: "em-tag" }, workModeTag(m.workMode).label)
            ),
            isOwner && m.userId !== t.ownerId ? appleBtn("Entfernen", {
              variant: "secondary",
              onClick: async () => {
                if (!confirm(`${m.name} aus dem Team entfernen?`)) return;
                try {
                  await api.market.teams.removeMember(t.id, m.userId);
                  toast("Entfernt", { type: "ok" });
                  this.renderTeamDetail(main);
                } catch (e) { toast(e.message, { type: "err" }); }
              },
            }) : null
          )
        )),
        isOwner ? applePanel("Mitglied suchen & einladen", [
          h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Einladung senden — die Person muss zustimmen (Team-Anfrage)."),
          h("div", { style: { display: "flex", gap: 8 } }, memberSearch, appleBtn("Suchen", { onClick: runMemberSearch })),
          memberResults,
        ]) : null,
        !isMember ? appleBtn(t.openToJoin ? "Team beitreten" : "Beitritt anfragen", {
          onClick: async () => {
            try {
              const res = await api.market.teams.join(t.id);
              toast(res.pending ? "Beitrittsanfrage gesendet" : "Team beigetreten", { type: "ok" });
              this.renderTeamDetail(main);
            } catch (e) { toast(e.message, { type: "err" }); }
          },
        }) : null,
        isMember && !isOwner ? appleBtn("Team verlassen", {
          variant: "secondary",
          onClick: async () => {
            if (!confirm("Team wirklich verlassen?")) return;
            try {
              await api.market.teams.leave(t.id);
              toast("Verlassen", { type: "ok" });
              this.goBack();
              this.refreshData();
            } catch (e) { toast(e.message, { type: "err" }); }
          },
        }) : null,
        (() => {
          const projects = this.teamRequestProjects().length
            ? this.teamRequestProjects()
            : this.inviteableOwnedProjects();
          if (!projects.length) {
            return applePanel("Für mein Projekt anfragen", [
              h("p", { class: "em-muted" }, "Noch kein eigenes Projekt. Stelle eines ein — dann kannst du dieses Team anfragen."),
              appleBtn("Projekt einstellen", { onClick: () => this.goTab("erstellen") }),
            ]);
          }
          const pick = h("select", { class: "em-input" },
            h("option", { value: "" }, "Projekt wählen…"),
            ...projects.map((pr) => h("option", { value: pr.id }, this.projectPickLabel(pr)))
          );
          return applePanel("Für mein Projekt anfragen", [
            h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Alle aktiven Teammitglieder erhalten die Anfrage."),
            pick,
            appleBtn("Team anfragen", {
              onClick: async () => {
                if (!pick.value) return toast("Projekt wählen", { type: "err" });
                try {
                  await api.market.teams.requestForProject(t.id, Number(pick.value));
                  const pr = projects.find((x) => String(x.id) === pick.value);
                  toast(`Anfrage an ${t.name} für „${pr?.title || "Projekt"}" gesendet`, { type: "ok" });
                  this.refreshData();
                } catch (e) { toast(e.message, { type: "err" }); }
              },
            }),
          ]);
        })(),
        (() => {
          const projects = this.inviteableOwnedProjects();
          const members = (t.members || []).filter((m) => m.userId !== this.state.me?.id);
          if (!isOwner && !isMember) return null;
          if (!projects.length) {
            return applePanel("Aufgabe an Teammitglied", [
              h("p", { class: "em-muted" }, "Als Auftraggeber brauchst du ein eigenes Projekt, um Aufgaben zu verteilen."),
              appleBtn("Projekt einstellen", { onClick: () => this.goTab("erstellen") }),
            ]);
          }
          if (!members.length) {
            return applePanel("Aufgabe an Teammitglied", [
              h("p", { class: "em-muted" }, "Noch keine anderen Mitglieder — zuerst jemanden einladen."),
            ]);
          }
          const projectPick = h("select", { class: "em-input" },
            h("option", { value: "" }, "Projekt wählen…"),
            ...projects.map((pr) => h("option", { value: pr.id }, this.projectPickLabel(pr)))
          );
          const whoPick = h("select", { class: "em-input" },
            h("option", { value: "" }, "Person wählen…"),
            ...members.map((m) => h("option", { value: m.userId }, m.name || `Person #${m.userId}`))
          );
          const titleIn = h("input", { class: "em-input", placeholder: "Was soll gemacht werden?" });
          const outcomeIn = h("input", { class: "em-input", placeholder: "Was ist fertig, wenn es gut ist?" });
          const dueIn = h("input", { class: "em-input", type: "date" });
          return applePanel("Aufgabe an Teammitglied delegieren", [
            h("p", { class: "em-muted", style: { margin: "0 0 12px" } },
              "Projekt + Person + Ergebnis + Frist. Die Person wird automatisch am Projekt beteiligt."),
            h("label", { class: "em-label" }, "Projekt"), projectPick,
            h("label", { class: "em-label", style: { marginTop: 10 } }, "An wen"), whoPick,
            h("label", { class: "em-label", style: { marginTop: 10 } }, "Aufgabe"), titleIn,
            h("label", { class: "em-label", style: { marginTop: 10 } }, "Fertig-Kriterium"), outcomeIn,
            h("label", { class: "em-label", style: { marginTop: 10 } }, "Frist"), dueIn,
            appleBtn("Aufgabe zuweisen", {
              onClick: async () => {
                if (!projectPick.value || !whoPick.value || !titleIn.value.trim()) {
                  return toast("Projekt, Person und Aufgabe sind Pflicht.", { type: "err" });
                }
                try {
                  await api.market.collab.tasks.create({
                    projectId: Number(projectPick.value),
                    assigneeUserId: Number(whoPick.value),
                    title: titleIn.value.trim(),
                    outcome: outcomeIn.value.trim(),
                    dueDate: dueIn.value || null,
                    description: outcomeIn.value.trim(),
                  });
                  toast("Aufgabe zugewiesen", { type: "ok" });
                  titleIn.value = "";
                  outcomeIn.value = "";
                  this.refreshData();
                } catch (e) { toast(e.message, { type: "err" }); }
              },
            }),
          ]);
        })()
      );
    } catch (e) {
      mount(main, h("p", {}, e.message), h("button", { class: "em-btn em-btn-ghost", onClick: () => this.goBack() }, "Zurück"));
    }
  }

  projectCard(p, onClick) {
    const tags = projectTags(p);
    const pay = p.payModel || "fixed";
    const payLabel = pay === "success" ? "Erfolg" : pay === "time" ? "Auf Zeit" : pay === "contest" ? "Wettbewerb" : pay === "quantity" ? "Nach Menge" : "Festpreis";
    const summary = (p.publicSummary || p.description || "").replace(/\n/g, " ").slice(0, 140);
    return h("article", { class: "lb-listing-card", onClick },
      h("div", { class: "lb-listing-badges" },
        h("span", { class: `lb-badge ${pay === "success" || pay === "contest" ? "lb-badge-success" : "lb-badge-pay"}` }, payLabel),
        h("span", { class: "lb-badge lb-badge-cat" }, catLabel(p.category)),
        (p.ndaLevel || 0) > 0 ? h("span", { class: "lb-badge lb-badge-nda" }, p.ndaLevel >= 3 ? "Geheim · NDA" : "NDA") : null
      ),
      h("h3", { class: "lb-listing-title" }, p.title),
      h("p", { class: "lb-listing-desc" },
        summary || tags.map((t) => t.label).slice(0, 2).join(" · ") || "Projekt öffnen für Details."
      ),
      h("div", { class: "lb-listing-meta" },
        h("div", { class: "lb-meta-row" },
          h("span", { class: "lb-meta-label" }, "Budget"),
          h("span", { class: "lb-meta-value" }, formatEUR(p.budgetCents))
        ),
        h("div", { class: "lb-meta-row" },
          h("span", { class: "lb-meta-label" }, "Dauer"),
          h("span", { class: "lb-meta-value" }, p.durationLabel || "nach Absprache")
        ),
        h("div", { class: "lb-meta-row" },
          h("span", { class: "lb-meta-label" }, "Ort"),
          h("span", { class: "lb-meta-value" }, p.location || "Remote")
        )
      )
    );
  }

  talentCard(t) {
    const onClick = t.kind === "team"
      ? () => this.openTeam(t.id)
      : () => this.openProfile(t.userId);
    return h("article", { class: "lb-listing-card", onClick },
      h("div", { class: "lb-listing-badges" },
        h("span", { class: "lb-badge lb-badge-pay" }, t.kind === "team" ? "Team" : "Fachmensch"),
        t.verified ? h("span", { class: "lb-badge lb-badge-success" }, "Geprüft") : null,
        t.rating ? h("span", { class: "lb-badge lb-badge-cat" }, `★ ${t.rating}`) : null
      ),
      h("h3", { class: "lb-listing-title" }, t.name),
      h("p", { class: "lb-listing-desc" }, t.headline || t.tagline || (t.topSkills || t.skills || []).slice(0, 5).join(" · ") || "Profil öffnen"),
      h("div", { class: "lb-listing-meta" },
        h("div", { class: "lb-meta-row" },
          h("span", { class: "lb-meta-label" }, t.kind === "team" ? "Mitglieder" : "Ort"),
          h("span", { class: "lb-meta-value" }, t.kind === "team" ? String(t.memberCount || "—") : (t.location || "Remote"))
        ),
        (t.priceFromCents || t.teamDayRateCents) ? h("div", { class: "lb-meta-row" },
          h("span", { class: "lb-meta-label" }, "Preis"),
          h("span", { class: "lb-meta-value" },
            t.teamDayRateCents ? `${formatEUR(t.teamDayRateCents)}/Tag` : `${formatEUR(t.priceFromCents)}/Std.`)
        ) : null
      )
    );
  }

  renderMarket(main) {
    const mode = this.state.marketMode || "projects";
    const cats = [{ id: "", label: "Alle Kategorien" }, ...(this.state.categories || [])];
    const filters = this.state.marketFilters || {
      category: "", hiringMode: "", staffing: "", q: "", for: "", kind: "all", workMode: "",
      remote: "", earlyBonus: "", minBudget: "", payModel: "", hasProof: "", minRating: "",
    };
    this.state.marketFilters = filters;
    const listEl = h("div");
    const filtersEl = h("div");

    const tabBar = h("div", { class: "em-market-tabs" },
      ...[
        { id: "projects", label: "Projekte" },
        { id: "talent", label: "Fachleute" },
      ].map((t) => {
        const btn = h("button", { type: "button", class: `em-market-tab${mode === t.id ? " is-active" : ""}` }, t.label);
        btn.addEventListener("click", () => { this.state.marketMode = t.id; this.renderMarket(main); });
        return btn;
      })
    );

    const loadAndRender = async () => {
      mount(listEl, loadingView());
      try {
        if (mode === "projects") {
          const params = {};
          if (filters.category) params.category = filters.category;
          if (filters.staffing) params.staffing = filters.staffing;
          if (filters.for) params.for = filters.for;
          if (filters.q?.trim()) params.q = filters.q.trim();
          if (filters.remote) params.workMode = "remote";
          if (filters.earlyBonus) params.earlyBonus = "1";
          if (filters.minBudget) params.minBudget = filters.minBudget;
          if (filters.payModel) params.payModel = filters.payModel;
          const items = await api.market.search.projects(params);
          mount(listEl,
            h("p", { class: "em-muted", style: { marginBottom: 16 } }, `${items.length} Projekt${items.length === 1 ? "" : "e"}`),
            items.length
              ? h("div", { class: "lb-card-grid" }, ...items.map((p) => this.projectCard(p, () => this.openProject(p.id))))
              : appleEmptyState({
                ...EMPTY.projects,
                ctaLabel: EMPTY.projects.cta,
                onCta: () => { this.state.tab = EMPTY.projects.tab; this.renderMain(); },
              })
          );
        } else {
          const params = {};
          if (filters.category) params.category = filters.category;
          if (filters.workMode) params.workMode = filters.workMode;
          if (filters.hasProof) params.hasProof = filters.hasProof;
          if (filters.minRating) params.minRating = filters.minRating;
          if (filters.kind && filters.kind !== "all") params.kind = filters.kind;
          if (filters.q?.trim()) params.q = filters.q.trim();
          let items = await api.market.search.talent(params);
          if (filters.kind === "person") items = items.filter((t) => t.kind !== "team");
          if (filters.kind === "team") items = items.filter((t) => t.kind === "team");
          mount(listEl,
            h("p", { class: "em-muted", style: { marginBottom: 16 } }, `${items.length} Angebot${items.length === 1 ? "" : "e"}`),
            items.length
              ? h("div", { class: "lb-card-grid" }, ...items.map((t) => this.talentCard(t)))
              : appleEmptyState({
                ...EMPTY.talent,
                ctaLabel: "Filter zurücksetzen",
                onCta: () => {
                  Object.assign(filters, { category: "", kind: "all", workMode: "", q: "" });
                  loadAndRender();
                  renderFilters();
                },
              })
          );
        }
      } catch (e) {
        mount(listEl, h("p", { class: "em-muted" }, e.message));
      }
    };

    const searchIn = h("input", { class: "em-input", placeholder: mode === "projects" ? "Projekt suchen …" : "Skills, Name, Team …", value: filters.q || "" });
    searchIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { filters.q = searchIn.value; loadAndRender(); } });

    const renderFilters = () => {
      const resetBtn = appleBtn("Filter zurücksetzen", {
        variant: "secondary",
        onClick: () => {
          Object.assign(filters, {
            category: "", hiringMode: "", staffing: "", q: "", for: "", kind: "all",
            workMode: "", remote: "", earlyBonus: "", minBudget: "", payModel: "", hasProof: "", minRating: "",
          });
          searchIn.value = "";
          renderFilters();
          loadAndRender();
        },
      });

      if (mode === "projects") {
        mount(filtersEl,
          h("div", { class: "lb-filter-card" },
            h("div", { class: "em-market-search-row" },
              searchIn,
              appleBtn("Suchen", { onClick: () => { filters.q = searchIn.value; loadAndRender(); } }),
              resetBtn
            ),
            appleFilterGrid([
              appleFilterSelect("Kategorie", cats, filters.category, (id) => { filters.category = id; loadAndRender(); }),
              appleFilterSelect("Gesucht", [
                { id: "", label: "Solo & Team" },
                { id: "solo", label: "Einzelperson" },
                { id: "team", label: "Team" },
              ], filters.for, (id) => { filters.for = id; loadAndRender(); }),
              appleFilterSelect("Besetzung", [
                { id: "", label: "Alle" },
                { id: "open", label: "Unbesetzt" },
                { id: "partial", label: "Teilbesetzt" },
                { id: "full", label: "Besetzt" },
              ], filters.staffing, (id) => { filters.staffing = id; loadAndRender(); }),
              appleFilterSelect("Vergütung", [
                { id: "", label: "Alle" },
                { id: "fixed", label: "Festpreis" },
                { id: "time", label: "Auf Zeit" },
                { id: "success", label: "Erfolg" },
                { id: "contest", label: "Wettbewerb" },
                { id: "quantity", label: "Nach Menge" },
              ], filters.payModel, (id) => { filters.payModel = id; loadAndRender(); }),
              appleFilterSelect("Ort", [
                { id: "", label: "Alle Orte" },
                { id: "1", label: "Remote / fern" },
              ], filters.remote, (id) => { filters.remote = id; loadAndRender(); }),
              appleFilterSelect("Budget", [
                { id: "", label: "Alle Budgets" },
                { id: "1000000", label: "ab 10.000 €" },
              ], filters.minBudget, (id) => { filters.minBudget = id; loadAndRender(); }),
            ])
          )
        );
      } else {
        mount(filtersEl,
          h("div", { class: "lb-filter-card" },
            h("div", { class: "em-market-search-row" },
              searchIn,
              appleBtn("Suchen", { onClick: () => { filters.q = searchIn.value; loadAndRender(); } }),
              resetBtn
            ),
            appleFilterGrid([
              appleFilterSelect("Kategorie", cats, filters.category, (id) => { filters.category = id; loadAndRender(); }),
              appleFilterSelect("Typ", [
                { id: "all", label: "Alle" },
                { id: "person", label: "Personen" },
                { id: "team", label: "Teams" },
              ], filters.kind || "all", (id) => { filters.kind = id; loadAndRender(); }),
              appleFilterSelect("Arbeitsweise", [
                { id: "", label: "Alle" },
                { id: "solo", label: "Solo" },
                { id: "team", label: "Im Team" },
                { id: "both", label: "Beides" },
              ], filters.workMode, (id) => { filters.workMode = id; loadAndRender(); }),
              appleFilterSelect("Bewertung", [
                { id: "", label: "Alle" },
                { id: "4", label: "ab 4 ★" },
                { id: "4.5", label: "ab 4,5 ★" },
              ], filters.minRating, (id) => { filters.minRating = id; loadAndRender(); }),
              appleFilterSelect("Nachweise", [
                { id: "", label: "Alle" },
                { id: "1", label: "Mit Arbeitsprobe" },
              ], filters.hasProof, (id) => { filters.hasProof = id; loadAndRender(); }),
            ])
          )
        );
      }
    };

    renderFilters();
    loadAndRender();
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, mode === "talent" ? "Fachleute finden" : "Offene Projekte"),
        h("p", { class: "lb-page-sub" }, mode === "talent"
          ? "Durchsuchen Sie Personen und Teams für die Realisierung."
          : "Finden Sie passende Aufträge — Solo, Team oder Wettbewerb.")
      ),
      tabBar, filtersEl, listEl
    );
  }

  openSearchOverlay() {
    document.querySelector(".lb-search-overlay")?.remove();
    const input = h("input", { class: "lb-search-input", placeholder: "Auf Projects suchen …" });
    const hits = h("div");
    const close = () => overlay.remove();
    const run = async () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { mount(hits); return; }
      try {
        const [projects, talent] = await Promise.all([
          api.market.search.projects({ q }),
          api.market.search.talent({ q }),
        ]);
        const rows = [
          ...projects.slice(0, 5).map((p) => ({ kind: "project", id: p.id, title: p.title, sub: `${catLabel(p.category)} · ${formatEUR(p.budgetCents)}` })),
          ...talent.slice(0, 4).map((t) => ({ kind: t.kind || "person", id: t.id || t.userId, title: t.name, sub: t.headline || t.tagline || "Fachmensch" })),
        ];
        mount(hits,
          ...rows.map((r) =>
            h("button", {
              type: "button",
              class: "lb-search-hit",
              onClick: () => {
                close();
                if (r.kind === "project") this.openProject(r.id);
                else if (r.kind === "team") this.openTeam(r.id);
                else this.openProfile(r.id);
              },
            }, h("strong", {}, r.title), h("span", {}, r.sub))
          ),
          !rows.length ? h("p", { class: "em-muted" }, "Keine Treffer.") : null
        );
      } catch (e) {
        mount(hits, h("p", { class: "em-muted" }, e.message));
      }
    };
    let timer;
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Enter") {
        close();
        this.state.tab = "markt";
        this.state.marketMode = "projects";
        this.state.marketFilters = { ...(this.state.marketFilters || {}), q: input.value.trim() };
        this.renderMain();
      }
    });
    const overlay = h("div", {
      class: "lb-search-overlay",
      onClick: (e) => { if (e.target === e.currentTarget) close(); },
    },
      h("div", { class: "lb-search-inner" },
        h("div", { class: "lb-search-row" },
          input,
          h("button", { type: "button", class: "lb-search-close", onClick: close }, "×")
        ),
        h("div", { class: "lb-search-quick" },
          ...["Software", "Design", "Handwerk", "Team", "Wettbewerb"].map((q) =>
            h("button", { type: "button", class: "lb-search-chip", onClick: () => { input.value = q; run(); } }, q)
          )
        ),
        hits
      )
    );
    document.body.appendChild(overlay);
    requestAnimationFrame(() => input.focus());
  }

  renderMine(main) {
    const { owned = [], assigned = [] } = this.state.mine;
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Meine Projekte"),
        h("p", { class: "lb-page-sub" }, "Als Auftraggeber und als Fachmensch.")
      ),
      h("div", { style: { marginBottom: 16 } },
        appleBtn("Projekt einstellen", { onClick: () => this.goTab("erstellen") })
      ),
      h("h2", { class: "apple-section-lead", style: { fontSize: 22, marginTop: 8 } }, "Als Auftraggeber"),
      owned.length
        ? h("div", { class: "lb-card-grid" }, ...owned.map((p) => this.projectCard(p, () => this.openProject(p.id))))
        : h("p", { class: "em-muted" }, "Noch keine eigenen Projekte."),
      h("h2", { class: "apple-section-lead", style: { fontSize: 22, marginTop: 32 } }, "Als Fachmensch"),
      assigned.length
        ? h("div", { class: "lb-card-grid" }, ...assigned.map((p) => this.projectCard(p, () => this.openProject(p.id))))
        : h("p", { class: "em-muted" }, "Noch keine vergebenen Aufträge.")
    );
  }

  renderCreate(main) {
    let step = 1;
    const slot = h("div");
    const msg = h("div", { style: { color: "#ff3b30", fontSize: 13, marginTop: 12 } });

    const title = h("input", { class: "em-input", placeholder: "z. B. Sanierung Handwerksbetrieb" });
    const publicSummary = h("textarea", { class: "em-input", rows: 4, placeholder: "Öffentliche Stichpunkte (ohne Geheimnisse) — z. B. Branche, Umfang, Ort, benötigte Rolle" });
    const desc = h("textarea", { class: "em-input", rows: 6, placeholder: "Vollständige Projektbeschreibung — nur sichtbar nach Geheimhaltungs-Zustimmung" });
    const cat = h("select", { class: "em-input" },
      ...(this.state.categories || []).map((c) => h("option", { value: c.id }, c.label))
    );
    const budget = h("input", { class: "em-input", type: "number", placeholder: "120000", min: 0 });
    const unitPrice = h("input", { class: "em-input", type: "number", placeholder: "50", min: 0 });
    const unitLabel = h("input", { class: "em-input", placeholder: "Beitrag / m² / Stunde" });
    const location = h("input", { class: "em-input", placeholder: "Stuttgart / Remote" });
    const duration = h("input", { class: "em-input", placeholder: "6 Monate" });
    let ndaLevel = 1;
    let workRemote = true;
    let hiringMode = "both";
    let teamSlots = 4;
    let payModel = "fixed";
    let taskMode = "team";
    let splitMode = "equal";
    let winnerCriteria = "best";
    const goalOneLiner = h("input", { class: "em-input em-input-big", placeholder: "Ziel in einem Satz — z. B. App fuer Handwerker mit Terminbuchung" });
    const plannerOut = h("div", { class: "em-planner-out" });
    const contestDeadline = h("input", { class: "em-input em-input-big", type: "datetime-local" });
    let successFee = h("input", { class: "em-input em-input-big", placeholder: "z. B. +10 % Ersparnis oder Tagessatz" });

    const renderStep = () => {
      if (step === 1) {
        mount(slot,
          h("p", { class: "em-muted", style: { margin: "0 0 16px" } }, "Der Marktplatz dient der Realisierung — nicht dem Verkauf von Ideen."),
          h("label", { class: "em-label" }, "Titel"), title,
          h("label", { class: "em-label", style: { marginTop: 16 } }, "Öffentliche Stichpunkte (für die Liste)"), publicSummary,
          h("p", { class: "em-muted", style: { fontSize: 13, margin: "4px 0 0" } }, "Nur grobe Infos — keine vertraulichen Details."),
          h("label", { class: "em-label", style: { marginTop: 16 } }, "Vollständige Beschreibung (geschützt)"), desc,
          h("label", { class: "em-label", style: { marginTop: 16 } }, "Kategorie"), cat,
          h("label", { class: "em-label", style: { marginTop: 16 } }, "Budget (€)"), budget,
          h("label", { class: "em-label", style: { marginTop: 16 } }, "Dauer"), duration,
          applePanel("Aufgabenzerleger — Solo oder Team?", [
            h("p", { class: "em-muted" }, "Ein Satz — die App schlägt Rollen und Budget-Aufteilung vor."),
            goalOneLiner,
            appleBtn("Rollen vorschlagen", {
              variant: "secondary",
              onClick: async () => {
                try {
                  const plan = await api.market.planner.suggest({
                    goal: goalOneLiner.value,
                    category: cat.value,
                    budgetCents: Math.round(Number(budget.value || 0) * 100),
                  });
                  hiringMode = plan.hiringMode;
                  teamSlots = plan.teamSlots;
                  splitMode = plan.splitMode || "equal";
                  plannerOut.replaceChildren(
                    h("p", { class: "em-simple-lead" }, plan.summary),
                    ...plan.roles.map((r) =>
                      h("div", { class: "em-simple-card", style: { marginTop: 8 } },
                        h("strong", {}, `${r.role} — ${r.sharePercent}%`),
                        h("p", { class: "em-muted" }, r.suggestedTasks.join(" · ")),
                        h("p", {}, `Richtwert: ${r.budgetHint}`)
                      )
                    )
                  );
                  renderStep();
                } catch (e) { toast(e.message, { type: "err" }); }
              },
            }),
            plannerOut,
          ])
        );
      } else if (step === 2) {
        mount(slot,
          applePanel("Wie wird bezahlt?", [
            h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Einfach wählen — Geld liegt immer in Treuhand."),
            renderBigPick(PAY_MODELS, payModel, (id) => { payModel = id; renderStep(); }),
          ]),
          payModel === "contest" ? applePanel("Wettbewerb-Regeln", [
            renderBigPick(WINNER_CRITERIA, winnerCriteria, (id) => { winnerCriteria = id; renderStep(); }),
            h("label", { class: "em-simple-label", style: { marginTop: 16 } }, "Einreichfrist (optional)"),
            contestDeadline,
            h("p", { class: "em-muted", style: { fontSize: 13 } }, "Jeder kann mitmachen — keine Bewerbung nötig."),
          ]) : null,
          payModel === "success" ? applePanel("Erfolgs-Kriterium", [successFee]) : null,
          payModel === "time" ? applePanel("Zeitvergütung", [
            h("p", { class: "em-muted" }, "Budget = Rahmen für den Zeitraum. Details in der Beschreibung."),
            successFee,
          ]) : null,
          payModel === "quantity" ? applePanel("Preis pro Einheit", [
            h("p", { class: "em-muted" }, "Festpreis pro Einheit — z. B. pro Beitrag, Datensatz oder m². Gesamtbudget = Richtwert."),
            h("label", { class: "em-label" }, "Preis pro Einheit (€)"), unitPrice,
            h("label", { class: "em-label", style: { marginTop: 12 } }, "Einheit (Bezeichnung)"), unitLabel,
          ]) : null,
          payModel !== "contest" ? applePanel("Schutz & Realisierung", [
            h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Bei geheimer Idee: Stichpunkte sind öffentlich, Details erst nach Verpflichtung gegen Diebstahl."),
            h("div", { class: "apple-choice-group" },
              ...[
                { v: 3, t: "Geheime Idee — maximale Realisierungsschutz", d: "Stichpunkte öffentlich. Volltext + Strafklauseln nach Zustimmung (Namenseingabe)." },
                { v: 2, t: "Stufe 2 — Verschärft", d: "Namenseingabe, Zeitstempel, Zugriffsprotokoll." },
                { v: 1, t: "Stufe 1 — Vertraulichkeit (empfohlen)", d: "Lesende bestätigen Geheimhaltung per Klick." },
                { v: 0, t: "Öffentlich", d: "Vollständige Beschreibung für alle sichtbar — nur wenn nichts Geheimes enthalten ist." },
              ].map((opt) => {
                const el = h("label", { class: `apple-choice${ndaLevel === opt.v ? " is-selected" : ""}` },
                  h("input", { type: "radio", name: "nda", checked: ndaLevel === opt.v, onChange: () => { ndaLevel = opt.v; renderStep(); } }),
                  h("div", {}, h("strong", {}, opt.t), h("p", { style: { margin: "4px 0 0", fontSize: 14, color: "var(--apple-text-secondary)" } }, opt.d))
                );
                return el;
              })
            ),
          ]) : null,
          payModel !== "contest" ? applePanel("Wen suchst du?", [
            h("p", { class: "em-muted", style: { margin: "0 0 12px" } }, "Du kannst später mehrere Personen annehmen."),
            h("div", { class: "em-hiring-pills" },
              ...[
                { v: "solo", t: "Einzelperson", d: "Eine Person übernimmt alles" },
                { v: "team", t: "Team", d: "Mehrere Rollen / festes Team" },
                { v: "both", t: "Beides offen", d: "Solo oder Team — du entscheidest" },
              ].map((opt) => {
                const btn = h("button", { type: "button", class: `em-hiring-pill${hiringMode === opt.v ? " is-selected" : ""}` },
                  h("strong", {}, opt.t),
                  h("span", {}, opt.d)
                );
                btn.addEventListener("click", () => { hiringMode = opt.v; renderStep(); });
                return btn;
              })
            ),
            hiringMode !== "solo" ? h("label", { class: "em-label", style: { marginTop: 16 } }, "Team-Plätze (Anzahl Personen)") : null,
            hiringMode !== "solo" ? (() => {
              const slotsIn = h("input", { class: "em-input", type: "number", min: 2, max: 20, value: teamSlots });
              slotsIn.addEventListener("input", (e) => { teamSlots = Number(e.target.value) || 4; });
              return slotsIn;
            })() : null,
          ]) : null,
          payModel !== "contest" && hiringMode !== "solo" ? applePanel("Aufgaben verteilen", [
            h("p", { class: "em-muted" }, "Später jederzeit änderbar."),
            h("div", { class: "em-who-row" },
              ...TASK_MODES.map((m) =>
                h("button", {
                  type: "button",
                  class: `em-who-btn${taskMode === m.id ? " is-on" : ""}`,
                  onClick: () => { taskMode = m.id; renderStep(); },
                }, m.title)
              )
            ),
          ]) : null,
          payModel !== "contest" && hiringMode !== "solo" ? applePanel("Team-Vergütung aufteilen", [
            h("p", { class: "em-muted" }, "Gleich · nach Anteilen · 80/20-Preset · individuell · privat (eingespielte Teams)."),
            h("div", { class: "em-who-row" },
              ...[
                { id: "equal", title: "Gleich verteilt" },
                { id: "shares", title: "Nach Anteilen" },
                { id: "split_80_20", title: "80 / 20 (Lead + Support)" },
                { id: "custom", title: "Individuell festlegen" },
                { id: "private", title: "Privat geregelt" },
              ].map((m) =>
                h("button", {
                  type: "button",
                  class: `em-who-btn${splitMode === m.id ? " is-on" : ""}`,
                  onClick: () => { splitMode = m.id; renderStep(); },
                }, m.title)
              )
            ),
            splitMode === "split_80_20" ? h("p", { class: "em-muted", style: { marginTop: 12, fontSize: 13 } },
              "Voreingestellt: 80 % Lead · 20 % Support. Nach Vergabe im Team-Split-Editor pro Person anpassbar.") : null,
          ]) : null,
          applePanel("Ort & Zusammenarbeit", [
            h("label", { class: "em-label" }, "Einsatzort"), location,
            h("label", { style: { display: "flex", gap: 8, marginTop: 16, alignItems: "center" } },
              h("input", { type: "checkbox", checked: workRemote, onChange: (e) => { workRemote = e.target.checked; } }),
              "Teilweise oder vollständig am Rechner / aus der Ferne möglich"
            ),
          ]),
          payModel === "fixed" ? applePanel("Erfolgsbeteiligung (optional)", [successFee]) : null
        );
      } else {
        mount(slot,
          applePanel("Zusammenfassung", [
            appleSpecSheet([
              ["Titel", title.value || "—"],
              ["Budget", budget.value ? `${Number(budget.value).toLocaleString("de-DE")} €` : "—"],
              ["Kategorie", cat.selectedOptions?.[0]?.text || "—"],
              ["Vergütung", payModelLabel(payModel)],
              ...(payModel === "contest" ? [["Gewinner", WINNER_CRITERIA.find((c) => c.id === winnerCriteria)?.title || "Beste"]] : []),
              ["Geheimhaltung", ndaLevel === 3 ? "Geheime Idee" : ndaLevel === 2 ? "Stufe 2" : ndaLevel === 1 ? "Stufe 1" : "Öffentlich"],
              ...(payModel !== "contest" ? [["Gesucht", HIRING_MODE_LABEL[hiringMode] || hiringMode]] : []),
              ...(payModel !== "contest" && hiringMode !== "solo" ? [["Team-Plätze", String(teamSlots)], ["Aufgaben", taskMode === "owner" ? "Du verteilst" : "Team verteilt"], ["Vergütung Team", splitMode === "equal" ? "Gleich" : splitMode === "shares" ? "Anteile" : splitMode === "split_80_20" ? "80 / 20 Preset" : splitMode === "custom" ? "Individuell" : "Privat"]] : []),
              ...(payModel === "quantity" ? [["Preis/Einheit", unitPrice.value ? `${Number(unitPrice.value).toLocaleString("de-DE")} € / ${unitLabel.value || "Einheit"}` : "—"]] : []),
              ["Ort", location.value || "Remote"],
            ]),
            h("p", { class: "em-muted", style: { marginTop: 16 } }, "Nach Einreichung prüft ein Admin vor Veröffentlichung.")
          ])
        );
      }
    };

    const nav = h("div", { style: { display: "flex", gap: 12, marginTop: 24 } });
    const updateNav = () => {
      mount(nav,
        step > 1 ? appleBtn("Zurück", { variant: "secondary", onClick: () => { step--; renderStep(); updateNav(); updateBar(); } }) : h("span"),
        step < 3 ? appleBtn("Weiter", { onClick: () => { step++; renderStep(); updateNav(); updateBar(); } })
          : appleBtn("Zur Prüfung einreichen", { onClick: async () => {
            try {
              const created = await api.market.create({
                title: title.value,
                description: desc.value,
                publicSummary: ndaLevel > 0 ? publicSummary.value : undefined,
                category: cat.value,
                budgetCents: Math.round(Number(budget.value || 0) * 100),
                unitPriceCents: payModel === "quantity" ? Math.round(Number(unitPrice.value || 0) * 100) : undefined,
                unitLabel: payModel === "quantity" ? (unitLabel.value || "Einheit") : undefined,
                location: location.value,
                durationLabel: duration.value,
                ndaLevel: payModel === "contest" ? Math.min(ndaLevel, 1) : ndaLevel,
                payModel,
                winnerCriteria: payModel === "contest" ? winnerCriteria : undefined,
                contestDeadline: payModel === "contest" && contestDeadline.value ? new Date(contestDeadline.value).toISOString() : undefined,
                taskMode,
                splitMode: hiringMode !== "solo" ? (splitMode === "split_80_20" ? "custom" : splitMode) : "equal",
                splitPreset: splitMode === "split_80_20" ? "80_20" : undefined,
                successFee: (payModel === "success" || payModel === "time" || payModel === "fixed") ? (successFee.value || undefined) : undefined,
                hiringMode: payModel === "contest" ? "solo" : hiringMode,
                teamRecommended: payModel !== "contest" && (hiringMode === "team" || hiringMode === "both"),
                teamSlots: payModel === "contest" || hiringMode === "solo" ? 1 : teamSlots,
                workMode: workRemote ? "remote" : "onsite",
              });
              toast("Projekt angelegt — du kannst jetzt Personen einladen.", { type: "ok" });
              await this.refreshData();
              if (created?.id) {
                this.openProject(created.id);
              } else {
                this.state.profileSection = "projekte";
                this.goTab("profil");
              }
            } catch (e) { msg.textContent = e.message; }
          } })
      );
    };
    const bar = h("div");
    const updateBar = () => {
      mount(bar, appleWizardBar(step, 3, step === 1 ? "Grunddaten" : step === 2 ? "Bedingungen" : "Prüfen"));
    };

    renderStep();
    updateNav();
    updateBar();
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Projekt einstellen"),
        h("p", { class: "lb-page-sub" }, "Drei Schritte — Realisierung beauftragen mit Treuhand und optionalem NDA.")
      ),
      bar, slot, nav, msg
    );
  }

  renderChatList(main) {
    const chats = [...(this.state.mine.assigned || [])].filter((p) => p.status === "assigned" || p.status === "completed");
    const ownedAssigned = (this.state.mine.owned || []).filter((p) => p.status === "assigned" || p.status === "completed");
    const all = [...ownedAssigned, ...chats];
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Nachrichten"),
        h("p", { class: "lb-page-sub" }, "Chat zu laufenden Projekten — Aufgaben findest du unter Konto → Profil.")
      ),
      all.length
        ? h("div", { class: "lb-card-grid" },
          ...all.map((p) => this.projectCard(p, () => {
            this.state._openChat = true;
            this.openProject(p.id);
          }))
        )
        : h("p", { class: "em-muted" }, "Noch keine aktiven Chats.")
    );
  }

  renderAdmin(main) {
    if (this.state.me?.role !== "admin") {
      mount(main,
        h("div", { class: "lb-page-head" },
          h("h1", { class: "lb-page-title" }, "Kein Zugriff"),
          h("p", { class: "lb-page-sub" }, "Dieser Bereich ist nur für Admin-Konten. Mit davidhammon + 2FA einloggen.")
        ),
      );
      return;
    }
    // Queue frisch laden, falls Shell früher ohne Admin-Daten gebaut wurde
    api.market.adminQueue().then((q) => { this.state.adminQueue = q || []; }).catch(() => {});
    const wrap = h("div", { class: "em-admin-wrap" });
    let allUsers = [];
    let filter = "";
    let openUserId = null;

    const closeDrawer = () => {
      openUserId = null;
      const existing = document.querySelector(".em-admin-drawer");
      existing?.remove();
    };

    const showUserDrawer = async (uid) => {
      openUserId = uid;
      const overlay = h("div", { class: "em-admin-drawer", onClick: (ev) => { if (ev.target === ev.currentTarget) closeDrawer(); } });
      const panel = h("div", { class: "em-admin-drawer-panel" }, loadingView("Nutzer laden…"));
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      let detail;
      try { detail = await api.market.adminUser(uid); }
      catch (e) { mount(panel, h("p", { class: "em-auth-error" }, e.message)); return; }

      const acc = detail.account;
      const prof = detail.profile || {};

      const impersonate = () => {
        setImpersonateId(acc.id);
        toast(`Als ${acc.name} eingeloggt`, { type: "ok" });
        closeDrawer();
        this.loadMe().then(() => { this.refreshData(); });
      };

      mount(panel,
        h("button", { class: "em-admin-drawer-close", type: "button", onClick: closeDrawer }, "×"),
        h("h2", {}, acc.name),
        h("p", { class: "em-admin-drawer-sub" }, `@${acc.loginName || "—"} · ${acc.email || "—"}`),
        h("div", { class: "em-admin-info-grid" },
          h("div", {}, h("span", {}, "Rolle"), h("span", {}, acc.role)),
          h("div", {}, h("span", {}, "2FA"), h("span", {}, acc.twoFactorEnabled ? "Ein" : "Aus")),
          h("div", {}, h("span", {}, "Passwort (Demo)"), h("span", {}, h("code", { class: "em-admin-pw" }, acc.demoPassword || "—"))),
          h("div", {}, h("span", {}, "AGB"), h("span", {}, acc.terms.accepted ? "OK" : "ausstehend")),
          h("div", {}, h("span", {}, "Erstellt"), h("span", {}, acc.createdAt || "—")),
          h("div", {}, h("span", {}, "Aktive Sessions"), h("span", {}, String(detail.sessions.length))),
        ),
        h("div", { class: "em-admin-actions" },
          appleBtn("Als Nutzer einsehen", { onClick: impersonate }),
          appleBtn("Passwort zurücksetzen", { variant: "secondary", onClick: async () => {
            const res = await api.market.adminResetPassword(acc.id).catch((e) => { toast(e.message, { type: "err" }); return null; });
            if (res?.password) toast(`Neues Passwort: ${res.password}`, { type: "ok", duration: 8000 });
            showUserDrawer(acc.id);
          } }),
          appleBtn(acc.twoFactorEnabled ? "2FA deaktivieren" : "2FA aktivieren", { variant: "secondary", onClick: async () => {
            await api.market.adminSetTwoFactor(acc.id, !acc.twoFactorEnabled).catch((e) => toast(e.message, { type: "err" }));
            showUserDrawer(acc.id);
          } }),
          appleBtn(acc.role === "admin" ? "Zu Nutzer" : "Zu Admin", { variant: "secondary", onClick: async () => {
            await api.market.adminSetRole(acc.id, acc.role === "admin" ? "user" : "admin").catch((e) => toast(e.message, { type: "err" }));
            showUserDrawer(acc.id);
          } }),
          appleBtn("Alle Sessions beenden", { variant: "secondary", onClick: async () => {
            await api.market.adminLogoutUser(acc.id).catch((e) => toast(e.message, { type: "err" }));
            toast("Sessions beendet", { type: "ok" });
            showUserDrawer(acc.id);
          } }),
          acc.id !== this.state.me.id ? appleBtn("Löschen", { variant: "secondary", onClick: async () => {
            if (!confirm(`Konto ${acc.name} wirklich löschen?`)) return;
            await api.market.adminDeleteUser(acc.id).catch((e) => toast(e.message, { type: "err" }));
            toast("Nutzer gelöscht", { type: "ok" });
            closeDrawer();
            paint();
          } }) : null,
        ),
        h("h3", {}, "Profil"),
        h("div", { class: "em-admin-info-grid" },
          h("div", {}, h("span", {}, "Headline"), h("span", {}, prof.headline || "—")),
          h("div", {}, h("span", {}, "Ort"), h("span", {}, prof.location || "—")),
          h("div", {}, h("span", {}, "Skills"), h("span", {}, (prof.skills || []).join(", ") || "—")),
          h("div", {}, h("span", {}, "Rang"), h("span", {}, prof.rank || "—")),
          h("div", {}, h("span", {}, "Bewertung"), h("span", {}, prof.rating != null ? `★ ${prof.rating}` : "—")),
          h("div", {}, h("span", {}, "Abgeschlossen"), h("span", {}, String(prof.completedCount || 0))),
        ),
        h("h3", {}, `Eigene Projekte (${detail.projectsOwned.length})`),
        detail.projectsOwned.length
          ? h("div", { class: "em-admin-item-list" }, ...detail.projectsOwned.map((p) =>
              h("div", { class: "em-admin-item" }, h("span", {}, p.title), h("small", {}, `${STATUS_LABEL[p.status] || p.status} · ${formatEUR(p.budgetCents)}`))))
          : h("p", { class: "em-muted" }, "Keine eigenen Projekte."),
        h("h3", {}, `Zugewiesene Projekte (${detail.projectsAssigned.length})`),
        detail.projectsAssigned.length
          ? h("div", { class: "em-admin-item-list" }, ...detail.projectsAssigned.map((p) =>
              h("div", { class: "em-admin-item" }, h("span", {}, p.title), h("small", {}, `${STATUS_LABEL[p.status] || p.status}`))))
          : h("p", { class: "em-muted" }, "Keine zugewiesenen Projekte."),
        h("h3", {}, `Teams (${detail.teamsOwned.length + detail.teamsMember.length})`),
        detail.teamsOwned.length || detail.teamsMember.length
          ? h("div", { class: "em-admin-item-list" },
              ...detail.teamsOwned.map((t) => h("div", { class: "em-admin-item" }, h("span", {}, t.name), h("small", {}, "Owner"))),
              ...detail.teamsMember.map((t) => h("div", { class: "em-admin-item" }, h("span", {}, t.name), h("small", {}, "Mitglied"))))
          : h("p", { class: "em-muted" }, "Keine Teams."),
        h("h3", {}, `Leistungsangebote (${detail.offers.length})`),
        detail.offers.length
          ? h("div", { class: "em-admin-item-list" }, ...detail.offers.map((o) =>
              h("div", { class: "em-admin-item" }, h("span", {}, o.title), h("small", {}, `${o.tiers?.length || 0} Stufen`))))
          : h("p", { class: "em-muted" }, "Keine Angebote."),
        h("h3", {}, `Bewerbungen (${detail.bids.length})`),
        h("p", { class: "em-muted", style: { fontSize: 13 } }, `${detail.bids.filter((b) => b.status === "accepted").length} angenommen`),
      );
    };

    const renderUserTable = () => {
      const rows = allUsers
        .filter((u) => {
          if (!filter) return true;
          const q = filter.toLowerCase();
          return u.name.toLowerCase().includes(q)
            || (u.loginName || "").toLowerCase().includes(q)
            || (u.email || "").toLowerCase().includes(q);
        })
        .map((u) => {
          const online = u.lastSeen && (Date.now() - u.lastSeen < 5 * 60 * 1000);
          const tr = h("tr", { class: "is-clickable", onClick: () => showUserDrawer(u.id) },
            h("td", {}, String(u.id)),
            h("td", {}, u.loginName ? `@${u.loginName}` : "—"),
            h("td", {}, u.name, h("br"), h("small", { style: { color: "var(--apple-text-secondary)", fontSize: 12 } }, u.email || "—")),
            h("td", {},
              h("span", { class: `em-admin-badge ${u.role === "admin" ? "is-admin" : ""}` }, u.role),
              u.twoFactorEnabled ? h("span", { class: "em-admin-badge is-2fa", style: { marginLeft: 4 } }, "2FA") : null,
              online ? h("span", { class: "em-admin-badge is-online", style: { marginLeft: 4 } }, "online") : null
            ),
            h("td", {}, `${u.counts.owned}P · ${u.counts.teamsOwned + u.counts.teamsMember}T · ${u.counts.offers}A`),
            h("td", {}, h("code", { class: "em-admin-pw" }, u.demoPassword || "—")),
          );
          return tr;
        });
      return h("div", { class: "em-admin-users-wrap" },
        h("table", { class: "em-admin-table" },
          h("thead", {}, h("tr", {},
            h("th", {}, "ID"), h("th", {}, "Login"), h("th", {}, "Name / E-Mail"), h("th", {}, "Rolle"), h("th", {}, "Aktivität"), h("th", {}, "Passwort")
          )),
          h("tbody", {}, ...rows)
        )
      );
    };

    const paint = async () => {
      let disputes = [];
      let msDisputes = [];
      let queue = this.state.adminQueue || [];
      try { allUsers = await api.market.adminUsers(); } catch (e) { toast(e.message || "Nutzerliste fehlgeschlagen", { type: "err" }); }
      try { queue = await api.market.adminQueue(); this.state.adminQueue = queue || []; } catch (e) { toast(e.message || "Warteschlange fehlgeschlagen", { type: "err" }); }
      try { disputes = await api.market.contests.adminDisputes(); } catch { /* optional */ }
      try { msDisputes = await api.market.milestones.adminDisputes(); } catch { /* optional */ }

      const searchIn = h("input", { class: "em-input em-admin-search", placeholder: "Nutzer suchen (Name, Login, E-Mail)…" });
      let redrawTable;
      searchIn.addEventListener("input", () => { filter = searchIn.value; redrawTable(); });
      const tableSlot = h("div");
      redrawTable = () => mount(tableSlot, renderUserTable());
      redrawTable();

      mount(wrap,
        h("section", { class: "em-admin-section" },
          h("h2", { class: "em-simple-h3" }, `Alle Nutzer (${allUsers.length})`),
          h("p", { class: "em-muted", style: { marginBottom: 12 } }, "Klicke auf eine Zeile für Details, Projekte und Aktionen."),
          h("div", { class: "em-admin-toolbar" }, searchIn),
          tableSlot,
        ),
        h("section", { class: "em-admin-section" },
          h("h2", { class: "em-simple-h3" }, `Projekte in Prüfung (${queue.length})`),
          ...(queue.length ? queue.map((p) =>
            h("div", { class: "apple-bid-card" },
              h("h3", { class: "apple-bid-name" }, p.title),
              h("p", { class: "apple-bid-meta" }, p.description?.slice(0, 200)),
              h("div", { class: "apple-bid-actions" },
                appleBtn("Freigeben", { onClick: async () => {
                  try {
                    await api.market.review(p.id, true);
                    toast("Freigegeben", { type: "ok" });
                    await this.refreshData();
                    paint();
                  } catch (e) { toast(e.message, { type: "err" }); }
                } }),
                appleBtn("Ablehnen", { variant: "secondary", onClick: async () => {
                  try {
                    await api.market.review(p.id, false, "Nicht freigegeben");
                    toast("Abgelehnt", { type: "ok" });
                    await this.refreshData();
                    paint();
                  } catch (e) { toast(e.message, { type: "err" }); }
                } })
              )
            )
          ) : [h("p", { class: "em-muted" }, "Keine Projekte in Prüfung.")])
        ),
        h("section", {},
          h("h2", { class: "em-simple-h3" }, `Wettbewerb-Streitfälle (${disputes.length})`),
          ...(disputes.length ? disputes.map((d) =>
            h("div", { class: "em-request-card" },
              h("h3", {}, d.projectTitle || `Projekt #${d.projectId}`),
              h("p", { class: "em-muted" }, d.reason),
              appleBtn("Entscheidung speichern", {
                onClick: async () => {
                  const decision = prompt("Begründung der Entscheidung:");
                  if (!decision?.trim()) return;
                  await api.market.contests.resolveDispute(d.id, decision.trim());
                  toast("Streitfall erledigt", { type: "ok" });
                  paint();
                },
              })
            )
          ) : [h("p", { class: "em-muted" }, "Keine offenen Streitfälle.")])
        ),
        h("section", {},
          h("h2", { class: "em-simple-h3" }, `Meilenstein-Streitfälle (${msDisputes.length})`),
          ...(msDisputes.length ? msDisputes.map((d) =>
            h("div", { class: "em-request-card" },
              h("h3", {}, d.projectTitle || `Meilenstein #${d.id}`),
              h("p", { class: "em-muted" }, d.disputeReason || "—"),
              h("div", { class: "em-request-actions" },
                appleBtn("Freigeben", { onClick: async () => {
                  await api.market.milestones.resolveDispute(d.id, "release");
                  toast("Freigegeben", { type: "ok" });
                  paint();
                } }),
                appleBtn("Rückerstattung", { variant: "secondary", onClick: async () => {
                  await api.market.milestones.resolveDispute(d.id, "refund");
                  toast("Erstattet", { type: "ok" });
                  paint();
                } })
              )
            )
          ) : [h("p", { class: "em-muted" }, "Keine Meilenstein-Streitfälle.")])
        ),
      );
    };
    paint();
    mount(main,
      h("div", { class: "lb-page-head" },
        h("h1", { class: "lb-page-title" }, "Administration"),
        h("p", { class: "lb-page-sub" }, "Nutzer, Freigaben, Streitfälle — volle Kontrolle.")
      ),
      wrap
    );
  }

  async renderDetail(main) {
    mount(main, loadingView("Projekt laden…"));
    try {
      const p = await api.market.get(this.state.detailId);
      const me = this.state.me;
      const isOwner = p.ownerId === me?.id;
      const isAssigned = p.assignedTo === me?.id;
      const tags = projectTags(p);
      const back = this.breadcrumbNav([
        { label: "Projekte", tab: "markt" },
        { label: p.title, current: true },
      ]);

      const body = [
        back,
        h("div", { class: "apple-detail-hero" },
          h("p", { class: "apple-detail-price" }, formatEUR(p.budgetCents)),
          h("h1", { class: "apple-detail-title" }, p.title),
          h("p", { class: "apple-page-sub" }, `${catLabel(p.category)} · ${p.location || "Remote"} · ${p.durationLabel || ""}`)
        ),
        appleSpecSheet([
          ["Status", STATUS_LABEL[p.status] || p.status],
          ["Geheimhaltung", p.ndaLevel >= 3 ? "Geheime Idee · Realisierung" : p.ndaLevel >= 2 ? "Stufe 2" : p.ndaLevel === 1 ? "Stufe 1" : "Öffentlich"],
          ["Zweck", p.ndaLevel > 0 ? "Realisierung — keine Ideenweitergabe" : "Öffentliche Ausschreibung"],
          ["Treuhand", "Aktiv"],
          ["Vergütung", payModelLabel(p.payModel)],
          ...(p.taskMode ? [["Aufgaben", p.taskMode === "owner" ? "Du verteilst" : "Team verteilt selbst"]] : []),
          ...(p.staffing ? [["Besetzung", p.staffing.label || p.staffingLabel || "—"]] : []),
          ...(p.successFee ? [["Erfolgsbeteiligung", p.successFee]] : []),
          ...(isOwner && p.bids?.length ? [["Bewerbungen", String(p.bids.filter((b) => b.status !== "rejected").length)]] : []),
        ]),
        h("div", { class: "em-tags", style: { justifyContent: "center", margin: "16px 0" } },
          ...tags.map((t) => h("span", { class: `em-tag ${t.cls}` }, t.label)),
          h("span", { class: "em-tag em-tag-green" }, "Treuhand")
        ),
      ];

      if (p.canReadFull) {
        body.push(applePanel("Vollständige Projektbeschreibung", [h("div", { style: { lineHeight: 1.6, whiteSpace: "pre-wrap" } }, p.description)]));
      } else if (p.ndaRequired) {
        if (p.publicSummary) {
          body.push(applePanel("Öffentliche Stichpunkte (ohne Geheimnisse)", [
            h("div", { class: "em-public-summary" }, p.publicSummary),
            h("p", { class: "em-muted", style: { marginTop: 12, fontSize: 13 } }, "Die vollständige Beschreibung ist erst nach Geheimhaltungs-Zustimmung einsehbar."),
          ]));
        }
        body.push(applePanel("Geschützte Felder", [
          h("p", { class: "em-muted", style: { fontSize: 13 } },
            p.ndaLevel >= 3 ? "Nur nach Ideen-Schutz-Vereinbarung (Stufe 3) sichtbar." : "Nur nach Vertraulichkeitsbestätigung sichtbar."),
          appleLockedField({ label: "Ausführliche Projektbeschreibung", note: "Wird nach NDA sichtbar." }),
          appleLockedField({ label: "Interne Referenzen & Anhänge", note: "Datei-Downloads erst nach Zustimmung." }),
          p.ndaLevel >= 2 ? appleLockedField({ label: "Auftraggeber-Kontakt & Kalender", note: "Name, Ansprechpartner, Zeitfenster." }) : null,
          p.ndaLevel >= 3 ? appleLockedField({ label: "Urheberrechtlich geschützte Idee", note: "Vollständige Idee inkl. Umsetzungsschritte — nur Realisierung erlaubt." }) : null,
        ]));
        let acceptIdeaTerms = false;
        const needsName = p.ndaLevel >= 2;
        const nameIn = needsName ? h("input", { class: "em-input", placeholder: "Vollständiger Name", style: { marginTop: 16 } }) : null;
        const ideaCheck = p.ndaLevel >= 3 ? h("label", { style: { display: "flex", gap: 10, marginTop: 16, fontSize: 14, lineHeight: 1.5, alignItems: "flex-start" } },
          h("input", { type: "checkbox", onChange: (e) => { acceptIdeaTerms = e.target.checked; } }),
          h("span", {}, "Ich akzeptiere die Ideen-Schutz-Bedingungen inkl. Vertragsstrafe und Herausgabe aller Vorteile bei Verstoß.")
        ) : null;
        const ndaBtn = appleBtn(p.ndaLevel >= 3 ? "Realisierungsschutz akzeptieren" : "Vertraulichkeit bestätigen", {
          onClick: async () => {
            try {
              if (p.ndaLevel >= 3 && !acceptIdeaTerms) return toast("Ideen-Schutz-Bedingungen aktivieren", { type: "err" });
              await api.market.acceptNda(p.id, nameIn?.value || "", acceptIdeaTerms);
              toast("Geheimhaltung akzeptiert — Volltext freigeschaltet", { type: "ok" });
              this.renderDetail(main);
            } catch (e) { toast(e.message, { type: "err" }); }
          },
        });
        body.push(appleNdaBlind({ level: p.ndaLevel, nameInput: nameIn, ideaTermsCheckbox: ideaCheck, onConfirm: ndaBtn }));
      }

      if (p.participantsPublic?.length && !isOwner) {
        body.push(applePanel(`Im Team (${p.participantsPublic.length})`, p.participantsPublic.map((part) =>
          h("div", { class: "em-person-card", style: { marginTop: 8 } },
            h("div", { class: "em-person-avatar" }, (part.name || "?")[0]),
            h("div", {}, h("div", { class: "em-person-name" }, part.name), h("div", { class: "em-person-headline" }, part.headline || ""))
          )
        )));
      }

      const isParticipant = (p.participants || []).some((x) => x.userId === me?.id);
      body.push(await renderProjectHub(p, {
        app: this,
        me,
        isOwner,
        isAssigned,
        main,
        onRefresh: () => this.renderDetail(main),
      }));

      if ((isOwner || isAssigned) && (p.status === "assigned" || p.status === "completed" || this.state._openChat)) {
        const chatBox = h("div", { class: "em-chat" });
        const input = h("input", { class: "em-input", placeholder: "Nachricht…" });
        const send = h("button", { class: "em-btn em-btn-primary", type: "button" }, "Senden");
        const loadChat = async () => {
          const msgs = await api.market.messages(p.id);
          mount(chatBox, ...msgs.map((m) =>
            h("div", { class: `em-chat-bubble ${m.senderId === me.id ? "mine" : "theirs"}` }, m.body)
          ));
          chatBox.scrollTop = chatBox.scrollHeight;
        };
        send.addEventListener("click", async () => {
          if (!input.value.trim()) return;
          await api.market.sendMessage(p.id, input.value.trim());
          input.value = "";
          loadChat();
        });
        await loadChat();
        body.push(applePanel("Chat", [chatBox, h("div", { style: { display: "flex", gap: 8, marginTop: 12 } }, input, send)]));
      }

      if ((isOwner || isAssigned) && p.status === "assigned") {
        body.push(appleBtn("Projekt abschließen", {
          onClick: async () => {
            await api.market.complete(p.id);
            toast("Projekt abgeschlossen — bitte Partner bewerten", { type: "ok" });
            this.refreshData();
            this.renderDetail(main);
          },
        }));
      }

      if ((isOwner || isAssigned) && p.status === "completed") {
        try {
          const rev = await api.market.reviews.get(p.id);
          if (rev.canSubmit) {
            const axes = ["quality", "reliability", "communication", "value"];
            const labels = { quality: "Qualität", reliability: "Zuverlässigkeit", communication: "Kommunikation", value: "Preis-Leistung" };
            const inputs = Object.fromEntries(axes.map((a) => [a, h("select", { class: "em-input" },
              h("option", { value: "" }, "—"),
              ...[5, 4, 3, 2, 1].map((n) => h("option", { value: n }, `${n} ★`))
            )]));
            const comment = h("textarea", { class: "em-input", rows: 3, placeholder: "Optionaler Kommentar (max. 500 Zeichen)" });
            body.push(applePanel(`Bewertung für ${rev.otherName}`, [
              h("p", { class: "em-muted" }, "Verdeckte Bewertung — sichtbar wenn beide abgegeben haben."),
              ...axes.map((a) => h("label", { class: "em-label", style: { marginTop: 8 } }, labels[a]), inputs[a]),
              h("label", { class: "em-label", style: { marginTop: 12 } }, "Kommentar"), comment,
              appleBtn("Bewertung absenden", {
                onClick: async () => {
                  const payload = Object.fromEntries(axes.map((a) => [a, Number(inputs[a].value)]));
                  if (axes.some((a) => !payload[a])) { toast("Bitte alle Kategorien bewerten", { type: "err" }); return; }
                  await api.market.reviews.submit(p.id, { ...payload, comment: comment.value });
                  toast("Bewertung gespeichert", { type: "ok" });
                  this.renderDetail(main);
                },
              }),
            ]));
          } else if (rev.pendingTheir) {
            body.push(applePanel("Bewertung", [h("p", { class: "em-muted" }, "Deine Bewertung ist abgegeben — warte auf die Gegenbewertung.")]));
          } else if (rev.theirReview) {
            const stars = (ax) => rev.theirReview.axes?.[ax] ? `${rev.theirReview.axes[ax]} ★` : "—";
            body.push(applePanel(`Bewertung von ${rev.otherName}`, [
              appleSpecSheet([
                ["Qualität", stars("quality")],
                ["Zuverlässigkeit", stars("reliability")],
                ["Kommunikation", stars("communication")],
                ["Preis-Leistung", stars("value")],
              ]),
              rev.theirReview.comment ? h("p", { class: "em-muted", style: { marginTop: 12 } }, rev.theirReview.comment) : null,
            ]));
          }
        } catch { /* Bewertung optional */ }
      }

      mount(main, ...body);
    } catch (e) {
      mount(main, h("p", {}, e.message), h("button", { class: "em-btn em-btn-ghost", onClick: () => this.goBack() }, "Zurück"));
    }
  }
}

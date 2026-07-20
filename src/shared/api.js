const BASE = "/api";

// Device-local profile selection: the chosen profile id travels as a header.
// Passwortgeschützte Kundenkonten nutzen zusätzlich einen Session-Token.
export function getCurrentUserId() {
  return Number(localStorage.getItem("abw_user") || 0) || null;
}
export function setCurrentUserId(id) {
  if (id) {
    const prev = getCurrentUserId();
    localStorage.setItem("abw_user", String(id));
    // Anderes Profil → alten Token verwerfen (sonst blockiert Bearer den x-user-id-Fallback)
    if (prev !== id) localStorage.removeItem("abw_token");
  } else {
    localStorage.removeItem("abw_user");
    localStorage.removeItem("abw_token");
  }
}
export function getToken() {
  return localStorage.getItem("abw_token") || null;
}
export function setToken(token) {
  if (token) localStorage.setItem("abw_token", token);
  else localStorage.removeItem("abw_token");
}

export function getImpersonateId() {
  return Number(localStorage.getItem("abw_impersonate") || 0) || null;
}
export function setImpersonateId(id) {
  if (id) localStorage.setItem("abw_impersonate", String(id));
  else localStorage.removeItem("abw_impersonate");
}

function networkError(err) {
  const msg = String(err?.message || err || "");
  if (/failed to fetch|networkerror|load failed|econnrefused|network request failed/i.test(msg)) {
    return new Error("Server nicht erreichbar — bitte App neu starten (Backend auf Port 8787).");
  }
  return err instanceof Error ? err : new Error(msg || "Unbekannter Fehler");
}

async function req(path, options = {}) {
  const userId = getCurrentUserId();
  const token = getToken();
  const impersonate = getImpersonateId();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : userId ? { "x-user-id": String(userId) } : {}),
        ...(impersonate && token ? { "x-impersonate-user": String(impersonate) } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw networkError(err);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Anfrage fehlgeschlagen (${res.status})`);
  return data;
}

export const api = {
  users: {
    register: (body) => req("/users", { method: "POST", body: JSON.stringify(body) }),
    login: (loginName, password) => req("/users/login", { method: "POST", body: JSON.stringify({ loginName, password }) }),
    verify2fa: (challengeToken, code) => req("/users/login/verify", { method: "POST", body: JSON.stringify({ challengeToken, code }) }),
    resend2fa: (challengeToken) => req("/users/login/resend", { method: "POST", body: JSON.stringify({ challengeToken }) }),
    forgot: (loginName) => req("/users/forgot", { method: "POST", body: JSON.stringify({ loginName }) }),
    reset: (resetToken, code, password) => req("/users/reset", { method: "POST", body: JSON.stringify({ resetToken, code, password }) }),
    logout: () => req("/users/logout", { method: "POST", body: JSON.stringify({}) }),
  },
  subscriptions: {
    list: () => req("/subscriptions"),
    create: (body) => req("/subscriptions", { method: "POST", body: JSON.stringify(body) }),
    update: (id, body) => req(`/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id) => req(`/subscriptions/${id}`, { method: "DELETE" }),
    password: (id) => req(`/subscriptions/${id}/password`),
  },
  accounts: {
    list: () => req("/accounts"),
    providers: () => req("/accounts/providers"),
    connect: (body) => req("/accounts/connect", { method: "POST", body: JSON.stringify(body) }),
    disconnect: (id) => req(`/accounts/${id}/disconnect`, { method: "POST" }),
    remove: (id) => req(`/accounts/${id}`, { method: "DELETE" }),
    transactions: (accountId) => req(`/accounts/transactions${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`),
    import: (id, text) => req(`/accounts/${id}/import`, { method: "POST", body: JSON.stringify({ text }) }),
  },
  scan: {
    run: () => req("/scan", { method: "POST", body: JSON.stringify({}) }),
  },
  etfs: {
    list: (q) => req(`/etfs${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  },
  invest: {
    list: ({ q, cls } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cls) params.set("class", cls);
      const qs = params.toString();
      return req(`/invest${qs ? `?${qs}` : ""}`);
    },
  },
  tips: {
    list: () => req("/tips"),
  },
  user: {
    get: () => req("/user"),
    save: (body) => req("/user", { method: "PUT", body: JSON.stringify(body) }),
    saveSettings: (settings) => req("/user/settings", { method: "PATCH", body: JSON.stringify(settings) }),
    acceptTerms: (termsVersion) => req("/user/accept-terms", { method: "POST", body: JSON.stringify({ termsAccepted: true, termsVersion }) }),
    setPassword: (currentPassword, newPassword) => req("/user/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
    deleteSelf: () => req("/user", { method: "DELETE" }),
  },
  admin: {
    overview: () => req("/admin/overview"),
    updateUser: (id, body) => req(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteUser: (id) => req(`/admin/users/${id}`, { method: "DELETE" }),
    setApi: (name, key) => req(`/admin/apis/${name}`, { method: "PUT", body: JSON.stringify({ key }) }),
    deleteApi: (name) => req(`/admin/apis/${name}`, { method: "DELETE" }),
    addCustomApi: (name, key, baseUrl) => req("/admin/custom-apis", { method: "POST", body: JSON.stringify({ name, key, baseUrl }) }),
    deleteCustomApi: (id) => req(`/admin/custom-apis/${id}`, { method: "DELETE" }),
    reset: () => req("/admin/reset", { method: "POST", body: JSON.stringify({}) }),
  },
  billing: {
    plans: () => req("/billing/plans"),
    status: () => req("/billing/status"),
    createCustomer: () => req("/billing/customer", { method: "POST", body: JSON.stringify({}) }),
    checkout: (plan, interval) => req("/billing/checkout", { method: "POST", body: JSON.stringify({ plan, interval }) }),
    portal: () => req("/billing/portal", { method: "POST", body: JSON.stringify({}) }),
    updateSettings: (body) => req("/billing/settings", { method: "PATCH", body: JSON.stringify(body) }),
  },
  legal: {
    info: () => req("/legal"),
  },
  market: {
    meta: () => req("/market/projects/meta"),
    list: (params) => {
      const q = params && typeof params === "object"
        ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString()
        : (typeof params === "string" && params ? `category=${encodeURIComponent(params)}` : "");
      return req(`/market/projects${q ? `?${q}` : ""}`);
    },
    search: {
      projects: (params) => req(`/market/search/projects?${new URLSearchParams(params || {})}`),
      talent: (params) => req(`/market/search/talent?${new URLSearchParams(params || {})}`),
    },
    mine: () => req("/market/projects/mine"),
    get: (id) => req(`/market/projects/${id}`),
    create: (body) => req("/market/projects", { method: "POST", body: JSON.stringify(body) }),
    acceptNda: (id, typedName, acceptIdeaTerms) => req(`/market/projects/${id}/nda`, {
      method: "POST",
      body: JSON.stringify({ typedName, acceptIdeaTerms }),
    }),
    review: (id, approve, reason) => req(`/market/projects/${id}/review`, { method: "POST", body: JSON.stringify({ approve, reason }) }),
    complete: (id) => req(`/market/projects/${id}/complete`, { method: "POST", body: JSON.stringify({}) }),
    setTaskMode: (id, taskMode) => req(`/market/projects/${id}/task-mode`, { method: "POST", body: JSON.stringify({ taskMode }) }),
    adminQueue: () => req("/market/projects/admin/queue"),
    adminUsers: () => req("/market/admin/users"),
    adminUser: (id) => req(`/market/admin/users/${id}`),
    adminResetPassword: (id, password) => req(`/market/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    adminSetRole: (id, role) => req(`/market/admin/users/${id}/role`, { method: "POST", body: JSON.stringify({ role }) }),
    adminSetTwoFactor: (id, enabled) => req(`/market/admin/users/${id}/two-factor`, { method: "POST", body: JSON.stringify({ enabled }) }),
    adminDeleteUser: (id) => req(`/market/admin/users/${id}`, { method: "DELETE" }),
    adminLogoutUser: (id) => req(`/market/admin/users/${id}/logout-all`, { method: "POST", body: JSON.stringify({}) }),
    bid: (body) => req("/market/bids", { method: "POST", body: JSON.stringify(body) }),
    acceptBid: (id) => req(`/market/bids/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
    rejectBid: (id) => req(`/market/bids/${id}/reject`, { method: "POST", body: JSON.stringify({}) }),
    messages: (projectId) => req(`/market/messages/${projectId}`),
    sendMessage: (projectId, body) => req(`/market/messages/${projectId}`, { method: "POST", body: JSON.stringify({ body }) }),
    discover: () => req("/market/network/discover"),
    network: () => req("/market/network"),
    offers: {
      list: () => req("/market/offers"),
      get: (id) => req(`/market/offers/${id}`),
      book: (id, body) => req(`/market/offers/${id}/book`, { method: "POST", body: JSON.stringify(body) }),
    },
    verification: {
      providers: () => req("/market/verification/providers"),
      me: () => req("/market/verification/me"),
      start: (providerId) => req("/market/verification/start", { method: "POST", body: JSON.stringify({ providerId }) }),
      demoStep: (stepId) => req("/market/verification/demo-step", { method: "POST", body: JSON.stringify({ stepId }) }),
    },
    profiles: {
      list: (q) => req(`/market/profiles${q ? `?${new URLSearchParams(q)}` : ""}`),
      me: () => req("/market/profiles/me"),
      save: (body) => req("/market/profiles/me", { method: "PATCH", body: JSON.stringify(body) }),
      get: (userId) => req(`/market/profiles/${userId}`),
      projects: (userId) => req(`/market/profiles/${userId}/projects`),
    },
    teams: {
      list: () => req("/market/teams"),
      mine: () => req("/market/teams/mine"),
      get: (id) => req(`/market/teams/${id}`),
      create: (body) => req("/market/teams", { method: "POST", body: JSON.stringify(body) }),
      join: (id) => req(`/market/teams/${id}/join`, { method: "POST", body: JSON.stringify({}) }),
      leave: (id) => req(`/market/teams/${id}/leave`, { method: "POST", body: JSON.stringify({}) }),
      searchMembers: (id, q) => req(`/market/teams/${id}/members/search?q=${encodeURIComponent(q || "")}`),
      addMember: (id, userId, opts) => req(`/market/teams/${id}/members`, { method: "POST", body: JSON.stringify({ userId, ...opts }) }),
      removeMember: (id, userId) => req(`/market/teams/${id}/members/${userId}/remove`, { method: "POST", body: JSON.stringify({}) }),
      requests: () => req("/market/teams/requests/mine"),
      acceptRequest: (id) => req(`/market/teams/requests/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
      declineRequest: (id) => req(`/market/teams/requests/${id}/decline`, { method: "POST", body: JSON.stringify({}) }),
      requestForProject: (id, projectId, message) => req(`/market/teams/${id}/request-project`, { method: "POST", body: JSON.stringify({ projectId, message }) }),
      createFromProject: (body) => req("/market/teams/from-project", { method: "POST", body: JSON.stringify(body) }),
    },
    contests: {
      submissions: (projectId) => req(`/market/contests/${projectId}/submissions`),
      submit: (projectId, body) => req(`/market/contests/${projectId}/submit`, { method: "POST", body: JSON.stringify(body) }),
      withdraw: (id) => req(`/market/contests/submissions/${id}/withdraw`, { method: "POST", body: JSON.stringify({}) }),
      pickWinner: (id) => req(`/market/contests/submissions/${id}/winner`, { method: "POST", body: JSON.stringify({}) }),
      dispute: (projectId, reason) => req(`/market/contests/${projectId}/dispute`, { method: "POST", body: JSON.stringify({ reason }) }),
      adminDisputes: () => req("/market/contests/admin/disputes"),
      resolveDispute: (id, decision) => req(`/market/contests/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ decision }) }),
    },
    organon: {
      network: () => req("/market/organon/network"),
      requests: () => req("/market/organon/requests"),
      sendRequest: (toUserId, message) => req("/market/organon/requests", { method: "POST", body: JSON.stringify({ toUserId, message }) }),
      acceptRequest: (id) => req(`/market/organon/requests/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
      rejectRequest: (id) => req(`/market/organon/requests/${id}/reject`, { method: "POST", body: JSON.stringify({}) }),
      status: (userId) => req(`/market/organon/status/${userId}`),
      delegations: () => req("/market/organon/delegations"),
      delegate: (body) => req("/market/organon/delegations", { method: "POST", body: JSON.stringify(body) }),
      acceptDelegation: (id) => req(`/market/organon/delegations/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
      declineDelegation: (id) => req(`/market/organon/delegations/${id}/decline`, { method: "POST", body: JSON.stringify({}) }),
      completeDelegation: (id) => req(`/market/organon/delegations/${id}/complete`, { method: "POST", body: JSON.stringify({}) }),
      bookings: () => req("/market/organon/bookings"),
      book: (body) => req("/market/organon/bookings", { method: "POST", body: JSON.stringify(body) }),
      confirmBooking: (id) => req(`/market/organon/bookings/${id}/confirm`, { method: "POST", body: JSON.stringify({}) }),
      declineBooking: (id) => req(`/market/organon/bookings/${id}/decline`, { method: "POST", body: JSON.stringify({}) }),
    },
    reviews: {
      get: (projectId) => req(`/market/reviews/project/${projectId}`),
      submit: (projectId, body) => req(`/market/reviews/project/${projectId}`, { method: "POST", body: JSON.stringify(body) }),
    },
    milestones: {
      forProject: (projectId) => req(`/market/milestones/project/${projectId}`),
      submit: (id) => req(`/market/milestones/${id}/submit`, { method: "POST", body: JSON.stringify({}) }),
      approve: (id) => req(`/market/milestones/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
      finalizeEarly: (id) => req(`/market/milestones/${id}/finalize-early`, { method: "POST", body: JSON.stringify({}) }),
      dispute: (id, reason) => req(`/market/milestones/${id}/dispute`, { method: "POST", body: JSON.stringify({ reason }) }),
      adminDisputes: () => req("/market/milestones/admin/disputes"),
      resolveDispute: (id, decision) => req(`/market/milestones/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ decision }) }),
    },
    payments: {
      status: () => req("/market/payments/status"),
      onboardPayout: () => req("/market/payments/payout/onboard", { method: "POST", body: JSON.stringify({}) }),
      setupClient: () => req("/market/payments/client/method", { method: "POST", body: JSON.stringify({}) }),
      myPayouts: () => req("/market/payments/payouts/mine"),
      projectEscrow: (projectId) => req(`/market/payments/project/${projectId}`),
      fundProject: (projectId, amountCents) => req(`/market/payments/project/${projectId}/fund`, { method: "POST", body: JSON.stringify({ amountCents }) }),
      setSplits: (projectId, body) => req(`/market/payments/project/${projectId}/splits`, { method: "POST", body: JSON.stringify(body) }),
      previewSplits: (projectId, body) => req(`/market/payments/project/${projectId}/splits/preview`, { method: "POST", body: JSON.stringify(body) }),
      payBooking: (bookingId) => req(`/market/payments/bookings/${bookingId}/pay`, { method: "POST", body: JSON.stringify({}) }),
      releaseBooking: (bookingId) => req(`/market/payments/bookings/${bookingId}/release`, { method: "POST", body: JSON.stringify({}) }),
    },
    notifications: {
      list: () => req("/market/notifications"),
      readAll: () => req("/market/notifications/read-all", { method: "POST", body: JSON.stringify({}) }),
      read: (id) => req(`/market/notifications/${id}/read`, { method: "POST", body: JSON.stringify({}) }),
    },
    workSamples: {
      mine: () => req("/market/work-samples/me"),
      add: (body) => req("/market/work-samples", { method: "POST", body: JSON.stringify(body) }),
      remove: (id) => req(`/market/work-samples/${id}`, { method: "DELETE" }),
    },
    planner: {
      suggest: (body) => req("/market/planner/suggest", { method: "POST", body: JSON.stringify(body) }),
    },
    offersCreate: {
      create: (body) => req("/market/offers", { method: "POST", body: JSON.stringify(body) }),
      update: (id, body) => req(`/market/offers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    },
    teamBuilder: {
      get: (projectId) => req(`/market/team-builder/${projectId}`),
      assign: (projectId, roleName, userId) => req(`/market/team-builder/${projectId}/assign`, { method: "POST", body: JSON.stringify({ roleName, userId }) }),
    },
    collab: {
      participants: (projectId) => req(`/market/collab/participants/project/${projectId}`),
      removeParticipant: (id) => req(`/market/collab/participants/${id}/remove`, { method: "POST", body: JSON.stringify({}) }),
      invites: () => req("/market/collab/invites/mine"),
      sendInvite: (body) => req("/market/collab/invites", { method: "POST", body: JSON.stringify(body) }),
      acceptInvite: (id) => req(`/market/collab/invites/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
      declineInvite: (id) => req(`/market/collab/invites/${id}/decline`, { method: "POST", body: JSON.stringify({}) }),
      suggestions: () => req("/market/collab/suggestions/mine"),
      suggestPerson: (body) => req("/market/collab/suggestions/person", { method: "POST", body: JSON.stringify(body) }),
      suggestProject: (body) => req("/market/collab/suggestions/project", { method: "POST", body: JSON.stringify(body) }),
      requestCowork: (body) => req("/market/collab/suggestions/cowork", { method: "POST", body: JSON.stringify(body) }),
      acceptSuggestion: (id) => req(`/market/collab/suggestions/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
      ownerAcceptSuggestion: (id) => req(`/market/collab/suggestions/${id}/owner-accept`, { method: "POST", body: JSON.stringify({}) }),
      declineSuggestion: (id) => req(`/market/collab/suggestions/${id}/decline`, { method: "POST", body: JSON.stringify({}) }),
      tasks: {
        mine: () => req("/market/collab/tasks/mine"),
        forProject: (projectId) => req(`/market/collab/tasks/project/${projectId}`),
        create: (body) => req("/market/collab/tasks", { method: "POST", body: JSON.stringify(body) }),
        done: (id) => req(`/market/collab/tasks/${id}/done`, { method: "POST", body: JSON.stringify({}) }),
        reassign: (id, assigneeUserId) => req(`/market/collab/tasks/${id}/reassign`, { method: "POST", body: JSON.stringify({ assigneeUserId }) }),
      },
    },
  },
  holdings: {
    list: () => req("/holdings"),
    create: (body) => req("/holdings", { method: "POST", body: JSON.stringify(body) }),
    remove: (id) => req(`/holdings/${id}`, { method: "DELETE" }),
  },
  brokers: {
    list: () => req("/brokers"),
    offers: (monthly) => req("/brokers/offers", { method: "POST", body: JSON.stringify({ monthly }) }),
    setAffiliate: (brokerId, url) => req(`/brokers/affiliate/${brokerId}`, { method: "PUT", body: JSON.stringify({ url }) }),
  },
  analyze: {
    run: (text, files = []) => {
      const form = new FormData();
      if (text) form.append("text", text);
      for (const f of files) form.append("files", f);
      return req("/analyze", { method: "POST", body: form });
    },
    letter: (body) => req("/analyze/letter", { method: "POST", body: JSON.stringify(body) }),
    adopt: (items) => req("/analyze/adopt", { method: "POST", body: JSON.stringify({ items }) }),
  },
  impact: {
    list: () => req("/impact"),
    create: (body) => req("/impact", { method: "POST", body: JSON.stringify(body) }),
    remove: (id) => req(`/impact/${id}`, { method: "DELETE" }),
  },
  ai: {
    analyzeStatement: (text, file) => {
      const form = new FormData();
      if (text) form.append("text", text);
      if (file) form.append("file", file);
      return req("/ai/analyze-statement", { method: "POST", body: form });
    },
    companyReport: (subscriptionId) => req("/ai/company-report", { method: "POST", body: JSON.stringify({ subscriptionId }) }),
    cancellationLetter: (subscriptionId) => req("/ai/cancellation-letter", { method: "POST", body: JSON.stringify({ subscriptionId }) }),
    autoClassify: () => req("/ai/auto-classify", { method: "POST", body: JSON.stringify({}) }),
    investPicks: ({ monthly, years, risk }) => req("/ai/invest-picks", { method: "POST", body: JSON.stringify({ monthly, years, risk }) }),
    financeRadar: ({ topicId, topicTitle }) => req("/ai/finance-radar", { method: "POST", body: JSON.stringify({ topicId, topicTitle }) }),
  },
};

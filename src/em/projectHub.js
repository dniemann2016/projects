/**
 * Projekt-Arbeitsfläche — Reiter: Übersicht · Team · Aufgaben · Wettbewerb · Bezahlung
 * Einfache Bedienung, alles an einem Ort pro Projekt.
 */
import { h } from "../shared/dom.js";
import { api } from "../shared/api.js";
import { toast } from "../shared/ui.js";
import { formatEUR, catLabel } from "./format.js";
import { payModelLabel, TASK_MODES, renderBigPick } from "./workModels.js";
import { appleBtn, applePanel, appleBidCard, appleSegmentSimple } from "./components.js";
import { renderSimpleTeamBuilder, renderSimpleTaskForm, renderTeamOnBoardBanner } from "./teamFlow.js";
import { renderTeamWorkspace } from "./teamWorkspace.js";
import { renderContestPanel } from "./contestFlow.js";

const HUB_TABS = [
  { id: "overview", label: "Übersicht" },
  { id: "team", label: "Team" },
  { id: "tasks", label: "Aufgaben" },
  { id: "contest", label: "Wettbewerb", when: (p) => p.payModel === "contest" },
  { id: "pay", label: "Bezahlung" },
];

export async function renderProjectHub(project, ctx) {
  const { app, me, isOwner, isAssigned, main, onRefresh } = ctx;
  const p = project;
  let tab = ctx.initialTab || "overview";
  const isParticipant = (p.participants || []).some((x) => x.userId === me?.id);
  const tabs = HUB_TABS.filter((t) => !t.when || t.when(p));

  const body = h("div", { class: "em-hub-body" });

  const paint = async () => {
    body.replaceChildren(h("p", { class: "em-muted" }, "Laden …"));
    try {
      const fresh = await api.market.get(p.id);
      Object.assign(p, fresh);
      const chunks = [];

      if (tab === "overview") {
        chunks.push(...await buildOverview(p, { app, me, isOwner, main, onRefresh: paint }));
      } else if (tab === "team") {
        chunks.push(...await buildTeamTab(p, { app, isOwner, main, onRefresh: paint }));
      } else if (tab === "tasks") {
        chunks.push(...await buildTasksTab(p, { app, me, isOwner, isAssigned, isParticipant, main, onRefresh: paint }));
      } else if (tab === "contest") {
        chunks.push(await buildContestTab(p, { isOwner, onRefresh: paint }));
      } else if (tab === "pay") {
        chunks.push(...await buildPayTab(p, { isOwner, isAssigned, main, onRefresh: paint }));
      }

      body.replaceChildren(...chunks.filter(Boolean));
    } catch (e) {
      body.replaceChildren(h("p", { class: "em-muted" }, e.message));
    }
  };

  const nav = appleSegmentSimple(tabs.map((t) => ({ id: t.id, label: t.label })), tab, (id) => {
    tab = id;
    paint();
    nav.querySelectorAll(".em-segment-btn").forEach((btn, i) => {
      btn.classList.toggle("is-on", tabs[i]?.id === id);
    });
  });

  paint();

  return h("div", { class: "em-project-hub", id: "em-project-hub" },
    h("p", { class: "em-simple-lead" }, `${payModelLabel(p.payModel)} · ${catLabel(p.category)}`),
    nav,
    body
  );
}

async function buildOverview(p, { app, me, isOwner, main, onRefresh }) {
  const out = [];

  if (p.payModel === "contest" && p.status === "open" && !isOwner) {
    out.push(h("div", { class: "em-onboard-banner" },
      h("h3", {}, "Wettbewerb — einfach mitmachen"),
      h("p", {}, "Keine Bewerbung nötig. Arbeit fertig → einreichen → beste gewinnt."),
      appleBtn("Zum Wettbewerb", { onClick: () => document.querySelector('[data-hub-tab="contest"]')?.click() })
    ));
  }

  if (isOwner && p.bids?.length) {
    out.push(h("h3", { class: "em-simple-h3" }, `Bewerbungen (${p.bids.filter((b) => b.status !== "rejected").length})`));
    for (const b of p.bids) {
      if (b.status === "rejected") continue;
      const cents = b.proposedCents ?? b.priceCents;
      out.push(appleBidCard({
        name: b.bidderName,
        headline: b.teamName ? `Als Team: ${b.teamName}` : (b.headline || "Solo"),
        price: cents ? formatEUR(cents) : "Passt zum Budget",
        message: b.message,
        actions: b.status === "sent" ? [
          appleBtn("Annehmen", { onClick: async () => {
            await api.market.acceptBid(b.id);
            app.toast?.("Angenommen", { type: "ok" }) || toast("Angenommen", { type: "ok" });
            await app.refreshData?.();
            onRefresh();
          } }),
          appleBtn("Ablehnen", { variant: "secondary", onClick: async () => {
            await api.market.rejectBid(b.id);
            onRefresh();
          } }),
        ] : b.status === "accepted" ? [
          h("span", { class: "em-tag em-tag-green" }, "Im Team"),
          appleBtn("Entfernen", { variant: "secondary", onClick: async () => {
            const part = (p.participants || []).find((x) => x.bidId === b.id);
            if (part) await api.market.collab.removeParticipant(part.id);
            onRefresh();
          } }),
        ] : [h("span", { class: "em-tag" }, b.status)],
      }));
    }
  }

  if (isOwner && p.ownerSuggestions?.length) {
    out.push(applePanel("Gemeinsam bewerben", p.ownerSuggestions.map((s) =>
      h("div", { class: "em-simple-card", style: { marginTop: 8 } },
        h("strong", {}, s.type === "dual_application" ? `${s.fromName} + ${s.toName}` : `${s.fromName} → ${s.toName}`),
        h("p", { class: "em-muted" }, s.message || ""),
        h("div", { class: "em-simple-card-actions" },
          appleBtn("Beide annehmen", { onClick: async () => {
            await api.market.collab.ownerAcceptSuggestion(s.id);
            onRefresh();
          } }),
          appleBtn("Ablehnen", { variant: "secondary", onClick: async () => {
            await api.market.collab.declineSuggestion(s.id);
            onRefresh();
          } })
        )
      )
    )));
  }

  if (p.status === "open" && !isOwner && p.payModel !== "contest" && p.canReadFull) {
    const bidMsg = h("textarea", { class: "em-input em-input-big", rows: 4, maxlength: 400, placeholder: "Warum du? + erster Schritt (max. 400 Zeichen)" });
    const teamState = { teamId: null };
    const teamRow = h("div", { class: "em-who-row" });
    const myTeams = app.state?.myTeams || [];
    const showTeam = p.hiringMode === "team" || p.hiringMode === "both" || p.teamRecommended;
    const paintTeamBtns = () => {
      if (!showTeam || !myTeams.length) return;
      teamRow.replaceChildren(
        h("button", {
          type: "button", class: `em-who-btn${!teamState.teamId ? " is-on" : ""}`,
          onClick: () => { teamState.teamId = null; paintTeamBtns(); },
        }, "Allein"),
        ...myTeams.map((t) =>
          h("button", {
            type: "button", class: `em-who-btn${teamState.teamId === t.id ? " is-on" : ""}`,
            onClick: () => { teamState.teamId = t.id; paintTeamBtns(); },
          }, t.name)
        )
      );
    };
    paintTeamBtns();
    out.push(applePanel("Bewerben", [
      h("p", { class: "em-muted" }, "Kurz & konkret — der Auftraggeber sieht dein Profil."),
      bidMsg,
      showTeam && myTeams.length ? h("label", { class: "em-simple-label" }, "Als Team bewerben?") : null,
      showTeam && myTeams.length ? teamRow : null,
      appleBtn("Bewerbung senden", {
        onClick: async () => {
          await api.market.bid({ projectId: p.id, message: bidMsg.value, teamId: teamState.teamId || undefined });
          toast("Gesendet", { type: "ok" });
          onRefresh();
        },
      }),
    ]));
  }

  if (!out.length) {
    out.push(h("p", { class: "em-muted" }, isOwner ? 'Wechsle zu „Team" für Besetzung oder „Aufgaben" für To-dos.' : "Schau in die anderen Reiter."));
  }

  return out;
}

async function buildTeamTab(p, { app, isOwner, onRefresh }) {
  const out = [];
  const parts = p.participants || [];

  if (isOwner && ["pending_review", "open"].includes(p.status) && (p.hiringMode === "team" || p.hiringMode === "both" || p.teamRecommended)) {
    out.push(renderTeamOnBoardBanner({
      staffingLabel: p.staffingLabel || `${parts.length} von ${p.teamSlots || "?"} Plätzen`,
      onClick: () => document.getElementById("em-team-setup")?.scrollIntoView({ behavior: "smooth" }),
    }));
  }

  out.push(applePanel(`Wer ist dabei (${parts.length})`, [
    ...(parts.length ? parts.map((part) =>
      h("div", { class: "em-person-card em-team-person-big", style: { marginTop: 8 } },
        h("div", { class: "em-person-avatar", onClick: () => app.openProfile(part.userId) }, (part.name || "?")[0]),
        h("div", { style: { flex: 1 } },
          h("div", { class: "em-person-name-big", onClick: () => app.openProfile(part.userId) }, part.name),
          h("div", { class: "em-person-headline" }, part.role || part.headline || ""),
          part.teamId ? h("span", { class: "em-tag" }, "Über Team") : null
        )
      )
    ) : [h("p", { class: "em-muted" }, "Noch niemand — Personen einladen oder Bewerbungen annehmen.")]),
    isOwner ? h("h4", { class: "em-simple-h4", style: { marginTop: 16 } }, "Person einladen") : null,
    isOwner ? app.renderPersonInviteSearch({
      hint: "Name tippen → Einladen. Die Person entscheidet selbst.",
      onInvite: async (userId, name) => {
        await api.market.collab.sendInvite({ projectId: p.id, userId });
        app.toast?.(`Einladung an ${name}`, { type: "ok" }) || toast(`Einladung an ${name}`, { type: "ok" });
        onRefresh();
      },
    }) : null,
  ]));

  if (isOwner && p.teamRecommended && ["pending_review", "open"].includes(p.status) && p.hiringMode !== "solo") {
    try {
      const tb = await api.market.teamBuilder.get(p.id);
      out.push(h("div", { id: "em-team-setup" },
        applePanel("Rollen besetzen — Schritt für Schritt", [
          renderSimpleTeamBuilder(tb, {
            onInvite: async (roleName, userId, personName) => {
              await api.market.teamBuilder.assign(p.id, roleName, userId);
              app.toast?.(`${personName} eingeladen`, { type: "ok" }) || toast(`${personName} eingeladen`, { type: "ok" });
              onRefresh();
            },
            onOpenProfile: (uid) => app.openProfile(uid),
          }),
        ])
      ));
    } catch { /* optional */ }
  }

  if (isOwner && parts.length >= 2) {
    const teamName = h("input", { class: "em-input em-input-big", placeholder: "Name fürs Dauer-Team (optional)" });
    out.push(applePanel("Als festes Team speichern", [
      h("p", { class: "em-muted" }, "Alle Beteiligten bekommen eine Anfrage — jeder entscheidet selbst."),
      teamName,
      appleBtn("Team gründen & einladen", {
        onClick: async () => {
          await api.market.teams.createFromProject({ projectId: p.id, name: teamName.value.trim() || undefined });
          app.toast?.("Anfragen gesendet", { type: "ok" }) || toast("Anfragen gesendet", { type: "ok" });
          await app.refreshData?.();
        },
      }),
    ]));
  }

  return out;
}

async function buildTasksTab(p, { app, me, isOwner, isAssigned, isParticipant, onRefresh }) {
  const out = [];
  const parts = p.participants || [];
  const taskMode = p.taskMode || "team";

  if (isOwner) {
    out.push(applePanel("Wer verteilt Aufgaben?", [
      h("p", { class: "em-muted" }, "Einstellbar — jederzeit änderbar."),
      h("div", { class: "em-who-row" },
        ...TASK_MODES.map((m) =>
          h("button", {
            type: "button",
            class: `em-who-btn${taskMode === m.id ? " is-on" : ""}`,
            onClick: async () => {
              await api.market.setTaskMode(p.id, m.id);
              p.taskMode = m.id;
              app.toast?.(m.id === "owner" ? "Du verteilst" : "Team verteilt selbst", { type: "ok" })
                || toast(m.id === "owner" ? "Du verteilst" : "Team verteilt selbst", { type: "ok" });
              onRefresh();
            },
          }, m.title)
        )
      ),
      h("p", { class: "em-muted", style: { fontSize: 14 } },
        taskMode === "owner" ? "Nur du legst Aufgaben an." : "Teammitglieder dürfen Aufgaben anlegen & umhängen."
      ),
    ]));
  }

  const canSeeBoard = (isOwner || isAssigned || isParticipant) && parts.length >= 1
    && (p.status === "assigned" || p.status === "open" || p.status === "completed" || p.status === "pending_review");

  if (canSeeBoard) {
    const projTasks = await api.market.collab.tasks.forProject(p.id).catch(() => []);
    const msData = await api.market.milestones.forProject(p.id).catch(() => null);
    out.push(renderTeamWorkspace({
      project: p,
      participants: parts,
      tasks: projTasks,
      milestones: msData?.milestones || [],
      escrow: { held: msData?.escrowHeldCents ?? p.escrowHeldCents, released: msData?.escrowReleasedCents ?? 0 },
      me,
      isOwner,
      taskMode,
      onCreateTask: () => {
        app.openSimpleTaskModal(parts, {
          projectId: p.id,
          onDone: () => onRefresh(),
        });
      },
      onReassign: taskMode === "team" || isOwner ? async (taskId, userId) => {
        await api.market.collab.tasks.reassign(taskId, userId);
        onRefresh();
      } : null,
      onDone: async (taskId) => {
        await api.market.collab.tasks.done(taskId);
        onRefresh();
      },
      onSubmitMilestone: isAssigned ? async (mid) => {
        await api.market.milestones.submit(mid);
        onRefresh();
      } : null,
    }));
  } else if (isOwner && parts.length) {
    out.push(applePanel("Aufgabe vergeben", [
      renderSimpleTaskForm(parts, {
        onSubmit: async (data) => {
          await api.market.collab.tasks.create({
            projectId: p.id,
            assigneeUserId: data.assigneeUserId,
            title: data.title,
            outcome: data.outcome,
            dueDate: data.dueDate,
            description: data.outcome,
          });
          app.toast?.("Aufgabe gesendet", { type: "ok" }) || toast("Aufgabe gesendet", { type: "ok" });
          onRefresh();
        },
      }),
    ]));
  } else {
    out.push(h("p", { class: "em-muted" }, "Erst Team besetzen — dann Aufgaben verteilen."));
  }

  return out;
}

async function buildContestTab(p, { isOwner, onRefresh }) {
  const data = await api.market.contests.submissions(p.id);
  return renderContestPanel(data, {
    isOwner,
    onSubmit: (body) => api.market.contests.submit(p.id, body),
    onWithdraw: (id) => api.market.contests.withdraw(id),
    onPickWinner: (id) => api.market.contests.pickWinner(id),
    onDispute: (reason) => api.market.contests.dispute(p.id, reason),
    onRefresh,
  });
}

async function buildPayTab(p, { isOwner, isAssigned, onRefresh }) {
  const out = [];
  const msData = await api.market.milestones.forProject(p.id).catch(() => null);
  const escrow = await api.market.payments.projectEscrow(p.id).catch(() => null);
  const milestones = msData?.milestones || [];
  const held = escrow?.escrowHeldCents ?? msData?.escrowHeldCents ?? p.escrowHeldCents ?? p.budgetCents;
  const released = escrow?.escrowReleasedCents ?? msData?.escrowReleasedCents ?? 0;
  const participants = escrow?.participants || [];

  const MILESTONE_LABEL = { held: "Hinterlegt", submitted: "Zur Prüfung", released: "Ausgezahlt", disputed: "Streit" };
  const SPLIT_MODES = [
    { id: "equal", title: "Gleichmäßig", text: "Jeder Teilnehmer erhält den gleichen Anteil." },
    { id: "shares", title: "Nach Anteilen", text: "Verteilung nach Team-Anteilen (shareBps)." },
    { id: "custom", title: "Individuell", text: "Du legst Beträge pro Person fest — eingefroren bis Auszahlung." },
    { id: "private", title: "Privat (Koordinator)", text: "Ein Koordinator verteilt intern." },
  ];

  out.push(applePanel("Treuhand & Auszahlung", [
    h("p", { class: "em-simple-lead" }, `${formatEUR(held)} hinterlegt · ${formatEUR(released)} ausgezahlt`),
    p.payModel === "success" && p.successFee ? h("p", { class: "em-muted" }, `Erfolgsbeteiligung: ${p.successFee}`) : null,
    p.payModel === "time" ? h("p", { class: "em-muted" }, "Zeitvergütung — Meilensteine pro Periode.") : null,
    p.payModel === "quantity" && p.unitPriceCents ? h("p", { class: "em-muted" }, `${formatEUR(p.unitPriceCents)} pro ${p.unitLabel || "Einheit"}`) : null,
    isOwner && held < (p.budgetCents || 0) ? appleBtn("Geld in Treuhand einzahlen", {
      onClick: async () => {
        try {
          await api.market.payments.setupClient().catch(() => {});
          const r = await api.market.payments.fundProject(p.id, p.budgetCents);
          toast(`${formatEUR(r.amountCents)} in Treuhand`, { type: "ok" });
          onRefresh();
        } catch (e) { toast(e.message, { type: "err" }); }
      },
    }) : null,
    ...(milestones.length ? milestones.map((m) =>
      h("div", { class: "em-team-ms-row" },
        h("div", {}, h("strong", {}, m.name), h("p", { class: "em-muted" }, `${formatEUR(m.amountCents)} · ${MILESTONE_LABEL[m.status] || m.status}`)),
        h("div", { class: "em-simple-card-actions" },
          isAssigned && m.status === "held" ? appleBtn("Einreichen", { onClick: async () => {
            await api.market.milestones.submit(m.id);
            onRefresh();
          } }) : null,
          isOwner && m.status === "submitted" ? appleBtn("Finalize Early", {
            variant: "secondary",
            onClick: async () => {
              await api.market.milestones.finalizeEarly(m.id);
              toast("Vorzeitig freigegeben.", { type: "ok" });
              onRefresh();
            },
          }) : null,
          isOwner && m.status === "submitted" ? appleBtn("Freigeben & auszahlen", { onClick: async () => {
            await api.market.milestones.approve(m.id);
            toast("Ausgezahlt", { type: "ok" });
            onRefresh();
          } }) : null,
          isOwner && m.status === "submitted" ? appleBtn("Beanstanden", { variant: "secondary", onClick: async () => {
            await api.market.milestones.dispute(m.id, "Nachbesserung");
            onRefresh();
          } }) : null
        )
      )
    ) : [h("p", { class: "em-muted" }, p.payModel === "contest" ? "Preisgeld wird beim Gewinner freigegeben." : "Meilensteine entstehen bei Annahme.")]),
    h("p", { class: "em-muted", style: { fontSize: 13, marginTop: 12 } }, "Prüffrist 7 Tage — danach automatische Freigabe."),
  ]));

  if (isOwner && participants.length > 1) {
    let splitMode = escrow?.splitMode || p.splitMode || "equal";
    const allocSlot = h("div");
    const customAmounts = {};

    const paintSplits = async () => {
      const preview = await api.market.payments.previewSplits(p.id, {
        amountCents: held || p.budgetCents,
        splitMode,
        allocations: splitMode === "custom"
          ? participants.map((part) => ({
              userId: part.userId,
              amountCents: Math.round(Number(customAmounts[part.userId] || 0) * 100),
            }))
          : undefined,
      }).catch(() => ({ splitPreview: escrow?.splitPreview || [] }));

      mount(allocSlot,
        h("p", { class: "em-muted", style: { marginBottom: 10 } }, "Vorschau bei Freigabe:"),
        ...(preview.splitPreview || []).map((row) =>
          h("div", { class: "em-admin-item" },
            h("span", {}, row.name || `#${row.userId}`),
            h("strong", {}, formatEUR(row.grossCents))
          )
        )
      );
    };

    out.push(applePanel("Team-Vergütung aufteilen", [
      h("p", { class: "em-muted" }, "Betrag bleibt eingefroren — Auszahlung erst nach Freigabe."),
      renderBigPick(SPLIT_MODES, splitMode, (id) => { splitMode = id; paintSplits(); }),
      splitMode === "custom" ? h("div", { style: { marginTop: 12 } },
        ...participants.map((part) => {
          const inp = h("input", {
            class: "em-input",
            type: "number",
            min: 0,
            placeholder: "€ Anteil",
            onInput: (ev) => { customAmounts[part.userId] = ev.target.value; },
          });
          return h("label", { class: "em-simple-field" },
            h("span", { class: "em-simple-label" }, part.name),
            inp
          );
        })
      ) : null,
      allocSlot,
      appleBtn("Aufteilung speichern", {
        onClick: async () => {
          try {
            await api.market.payments.setSplits(p.id, {
              splitMode,
              allocations: splitMode === "custom"
                ? participants.map((part) => ({
                    userId: part.userId,
                    amountCents: Math.round(Number(customAmounts[part.userId] || 0) * 100),
                    label: part.name,
                  }))
                : [],
            });
            toast("Team-Vergütung gespeichert — eingefroren bis Auszahlung.", { type: "ok" });
            onRefresh();
          } catch (e) { toast(e.message, { type: "err" }); }
        },
      }),
    ]));
    paintSplits();
  }

  return out;
}

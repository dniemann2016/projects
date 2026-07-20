import { h } from "../shared/dom.js";
import { formatEUR } from "./format.js";
import { appleBtn, applePanel } from "./components.js";

function loadStatus(participant, tasks) {
  const mine = tasks.filter((t) => t.assigneeUserId === participant.userId && t.status !== "done");
  const overdue = mine.some((t) => t.dueDate && new Date(t.dueDate) < new Date());
  if (overdue) return { emoji: "🔴", label: "Braucht Hilfe", cls: "red" };
  if (mine.length >= 2) return { emoji: "🟡", label: "Viel zu tun", cls: "yellow" };
  if (mine.length > 0) return { emoji: "🟡", label: "Hat Aufgaben", cls: "yellow" };
  return { emoji: "🟢", label: "Frei", cls: "green" };
}

function fmtDue(d) {
  if (!d) return "Keine Frist";
  const dt = new Date(d);
  const diff = Math.ceil((dt - Date.now()) / 86400000);
  if (diff < 0) return `Überfällig (${Math.abs(diff)} T.)`;
  if (diff === 0) return "Heute fällig";
  if (diff === 1) return "Morgen fällig";
  return dt.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

/**
 * Team-Fläche — extrem einfach: Wer · To-dos · Geld
 * Kein Ziehen nötig: große „Geben an …"-Knöpfe
 */
export function renderTeamWorkspace({
  project,
  participants = [],
  tasks = [],
  milestones = [],
  escrow = {},
  me,
  isOwner,
  taskMode = "team",
  onCreateTask,
  onReassign,
  onDone,
  onSubmitMilestone,
}) {
  const canCreate = isOwner || taskMode === "team";
  const overloaded = participants.find((p) => loadStatus(p, tasks).cls === "red");

  const peopleCol = h("div", { class: "em-team-board-col em-team-simple" },
    h("h3", { class: "em-team-board-head" }, "Wer ist dabei"),
    ...participants.map((p) => {
      const st = loadStatus(p, tasks);
      const open = tasks.filter((t) => t.assigneeUserId === p.userId && t.status !== "done").length;
      return h("div", { class: "em-team-person em-team-person-big" },
        h("span", { class: "em-team-emoji", title: st.label }, st.emoji),
        h("div", {},
          h("strong", { class: "em-person-name-big" }, p.name || "Person"),
          h("p", { class: "em-muted" }, p.role || p.headline || ""),
          h("p", { class: "em-status-text" }, open ? `${open} offene Aufgabe${open === 1 ? "" : "n"}` : st.label)
        )
      );
    })
  );

  const tasksCol = h("div", { class: "em-team-board-col em-team-board-tasks em-team-simple" },
    h("div", { class: "em-team-board-head-row" },
      h("h3", { class: "em-team-board-head" }, "To-dos"),
      canCreate ? appleBtn("+ Neue Aufgabe", { onClick: onCreateTask }) : null
    ),
    ...(tasks.length ? tasks.map((t) => {
      const assignee = participants.find((p) => p.userId === t.assigneeUserId);
      const isMine = t.assigneeUserId === me?.id && t.status !== "done";
      const others = participants.filter((p) => p.userId !== t.assigneeUserId);
      return h("div", { class: `em-team-task em-team-task-big${t.status === "done" ? " is-done" : ""}` },
        h("strong", {}, t.title),
        t.outcome || t.description
          ? h("p", { class: "em-task-outcome" }, `Fertig wenn: ${(t.outcome || t.description).slice(0, 100)}`)
          : null,
        h("p", { class: "em-task-meta" }, `${assignee?.name || "—"} · ${fmtDue(t.dueDate)}`),
        t.status !== "done" ? h("div", { class: "em-task-actions" },
          isMine ? appleBtn("Fertig!", { onClick: () => onDone?.(t.id) }) : null,
          others.length && onReassign ? h("div", { class: "em-reassign-row" },
            h("span", { class: "em-muted", style: { fontSize: 13 } }, "Geben an:"),
            ...others.slice(0, 4).map((p) =>
              h("button", {
                type: "button",
                class: "em-who-btn em-who-btn-sm",
                onClick: () => onReassign(t.id, p.userId),
              }, p.name?.split(" ")[0] || "Person")
            )
          ) : null
        ) : h("span", { class: "em-tag em-tag-green" }, "✓ Erledigt")
      );
    }) : [
      h("div", { class: "em-empty-inline" },
        h("p", {}, "Noch keine Aufgaben."),
        h("p", { class: "em-muted" }, 'Tippe auf „+ Neue Aufgabe".')
      )
    ])
  );

  const moneyCol = h("div", { class: "em-team-board-col em-team-simple" },
    h("h3", { class: "em-team-board-head" }, "Bezahlt wird"),
    h("p", { class: "em-money-summary" },
      `Sicher hinterlegt: ${formatEUR(escrow.held || project.budgetCents)}`
    ),
    h("p", { class: "em-muted" }, `Schon ausgezahlt: ${formatEUR(escrow.released || 0)}`),
    ...(milestones.length ? milestones.map((m) =>
      h("div", { class: "em-team-ms-row em-team-ms-simple" },
        h("div", {},
          h("strong", {}, m.name),
          h("span", { class: "em-muted" }, formatEUR(m.amountCents))
        ),
        h("span", { class: `em-tag${m.status === "released" ? " em-tag-green" : ""}` },
          m.status === "released" ? "✓ Bezahlt" : m.status === "submitted" ? "Wird geprüft" : "Wartet"
        ),
        m.status === "held" && onSubmitMilestone && isOwner === false
          ? appleBtn("Fertig melden", { variant: "secondary", onClick: () => onSubmitMilestone(m.id) })
          : null
      )
    ) : [h("p", { class: "em-muted" }, "Meilensteine kommen bei Vergabe.")]),
    project.earlyBonusCents
      ? h("p", { class: "em-bonus-hint" }, `⚡ Früher fertig: +${formatEUR(project.earlyBonusCents)}`)
      : null
  );

  const hint = overloaded
    ? h("div", { class: "em-team-hint em-team-hint-big" },
      h("strong", {}, `${overloaded.name} hat viel zu tun.`),
      h("p", {}, 'Tippe bei einer Aufgabe auf „Geben an" und wähle jemanden mit 🟢 Frei.')
    )
    : null;

  return applePanel("Wer macht was?", [
    hint,
    h("p", { class: "em-muted", style: { marginBottom: 16, fontSize: 15 } },
      "Keine Zeiterfassung — nur: Was · Ergebnis · Frist · Person."
    ),
    h("div", { class: "em-team-board" }, peopleCol, tasksCol, moneyCol),
  ].filter(Boolean));
}

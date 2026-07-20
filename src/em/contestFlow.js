/**
 * Wettbewerb — ohne Bewerbung, einfach einreichen, Gewinner küren, Streitfall.
 */
import { h } from "../shared/dom.js";
import { formatEUR } from "./format.js";
import { winnerCriteriaLabel } from "./workModels.js";
import { appleBtn, applePanel } from "./components.js";

export function renderContestPanel(data, { isOwner, me, onSubmit, onWithdraw, onPickWinner, onDispute, onRefresh }) {
  const slot = h("div", { class: "em-simple-block" });

  const paint = () => {
    const rows = [];
    rows.push(h("p", { class: "em-simple-lead" },
      `Preisgeld: ${formatEUR(data.prizeCents)} · ${winnerCriteriaLabel(data.winnerCriteria)}`
    ));
    if (data.contestDeadline) {
      rows.push(h("p", { class: "em-muted" },
        data.deadlinePassed ? "Frist abgelaufen — Auftraggeber kürt den Gewinner." : `Einreichen bis: ${new Date(data.contestDeadline).toLocaleDateString("de-DE")}`
      ));
    }
    rows.push(h("p", { class: "em-muted" }, `${data.submissionCount} Einreichung${data.submissionCount === 1 ? "" : "en"}`));

    if (!isOwner && !data.mySubmission && !data.deadlinePassed && !data.winnerSubmissionId) {
      const note = h("textarea", { class: "em-input em-input-big", rows: 3, placeholder: "Was hast du gemacht? Kurz beschreiben …" });
      const link = h("input", { class: "em-input em-input-big", placeholder: "Link zur Datei (optional)" });
      rows.push(
        h("label", { class: "em-simple-label" }, "Deine Arbeit"),
        note,
        h("label", { class: "em-simple-label" }, "Link (PDF, Drive, GitHub …)"),
        link,
        appleBtn("Einreichen — ohne Bewerbung", {
          onClick: async () => {
            await onSubmit({ note: note.value, link: link.value });
            onRefresh?.();
          },
        })
      );
    }

    if (data.mySubmission) {
      rows.push(h("div", { class: "em-simple-card" },
        h("strong", {}, "Deine Einreichung"),
        h("p", { class: "em-muted" }, data.mySubmission.note || "—"),
        data.mySubmission.link ? h("p", {}, h("a", { href: data.mySubmission.link, target: "_blank", rel: "noopener" }, "Link öffnen")) : null,
        h("p", { class: "em-tag" }, data.mySubmission.status === "winner" ? "Gewonnen!" : data.mySubmission.status === "lost" ? "Nicht gewählt" : "Eingereicht"),
        data.mySubmission.status === "submitted" && !data.winnerSubmissionId ? appleBtn("Zurückziehen", {
          variant: "secondary",
          onClick: async () => { await onWithdraw(data.mySubmission.id); onRefresh?.(); },
        }) : null
      ));
    }

    if (isOwner && data.submissions?.length) {
      rows.push(h("h4", { class: "em-simple-h4", style: { marginTop: 20 } }, "Alle Einreichungen"));
      for (const s of data.submissions) {
        rows.push(h("div", { class: "em-simple-card em-suggest-card" },
          h("div", { class: "em-simple-card-body" },
            h("strong", {}, s.userName || "Person"),
            h("p", { class: "em-muted" }, s.headline || ""),
            h("p", {}, s.note?.slice(0, 200) || "—"),
            s.link ? h("p", {}, h("a", { href: s.link, target: "_blank", rel: "noopener" }, "Ansehen")) : null,
            s.status === "winner" ? h("span", { class: "em-tag em-tag-green" }, "Gewinner") : null
          ),
          s.status === "submitted" && !data.winnerSubmissionId ? h("div", { class: "em-simple-card-actions" },
            appleBtn("Als Gewinner wählen", { onClick: async () => { await onPickWinner(s.id); onRefresh?.(); } })
          ) : null
        ));
      }
    }

    if ((isOwner || data.mySubmission) && !data.winnerSubmissionId) {
      rows.push(h("div", { style: { marginTop: 24 } },
        h("p", { class: "em-muted" }, "Streit? Der Markt (Admin ± Experte) entscheidet — Geld bleibt in Treuhand."),
        appleBtn("Streitfall melden", {
          variant: "secondary",
          onClick: async () => {
            const reason = prompt("Kurz: Worum geht der Streit?");
            if (!reason?.trim()) return;
            await onDispute(reason.trim());
            onRefresh?.();
          },
        })
      ));
    }

    slot.replaceChildren(...rows);
  };

  paint();
  return applePanel("Wettbewerb", [slot]);
}

import { marketStore } from "./marketStore.js";

export function notifyUser(userId, { type, title, body, linkProjectId, linkTab }) {
  const all = marketStore.notifications();
  all.push({
    id: all.length ? Math.max(...all.map((n) => n.id)) + 1 : 1,
    userId,
    type: type || "info",
    title: String(title || "").slice(0, 120),
    body: String(body || "").slice(0, 500),
    linkProjectId: linkProjectId || null,
    linkTab: linkTab || null,
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (all.length > 5000) all.splice(0, all.length - 5000);
  marketStore.setNotifications(all);
}

export function notifyBidReceived(project) {
  notifyUser(project.ownerId, {
    type: "bid",
    title: "Neue Bewerbung",
    body: `Projekt „${project.title}" — neue Bewerbung eingegangen.`,
    linkProjectId: project.id,
  });
}

export function notifyTeamRequest(toUserId, { teamName, projectTitle, fromName }) {
  notifyUser(toUserId, {
    type: "team_request",
    title: "Team-Anfrage",
    body: projectTitle
      ? `${fromName} lädt dich zu „${projectTitle}" ein.`
      : `${fromName} lädt dich zu „${teamName}" ein.`,
    linkTab: "hub",
  });
}

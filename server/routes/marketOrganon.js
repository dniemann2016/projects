import { Router } from "express";
import { requireUser, requireAcceptedTerms } from "../lib/currentUser.js";
import { marketStore, areNetworked, connectionStatus } from "../lib/marketStore.js";
import { store } from "../lib/store.js";

const router = Router();
router.use(requireUser, requireAcceptedTerms);

function userName(id) {
  return store.collection("users").find((u) => u.id === id)?.name || "Nutzer";
}

function enrichRequest(r) {
  return {
    ...r,
    fromName: userName(r.fromUserId),
    toName: userName(r.toUserId),
  };
}

/** Mein Organon-Netzwerk: bestätigte Verbindungen. */
router.get("/network", (req, res) => {
  const uid = req.user.id;
  const accepted = marketStore.networkRequests().filter(
    (r) => r.status === "accepted" && (r.fromUserId === uid || r.toUserId === uid)
  );
  const contacts = accepted.map((r) => {
    const otherId = r.fromUserId === uid ? r.toUserId : r.fromUserId;
    const prof = marketStore.profiles().find((p) => p.userId === otherId);
    return {
      userId: otherId,
      name: userName(otherId),
      headline: prof?.headline || "",
      workMode: prof?.workMode || "both",
      since: r.respondedAt || r.createdAt,
    };
  });
  res.json(contacts);
});

/** Eingehende & ausgehende Netz-Anfragen. */
router.get("/requests", (req, res) => {
  const uid = req.user.id;
  const all = marketStore.networkRequests();
  res.json({
    incoming: all.filter((r) => r.toUserId === uid && r.status === "pending").map(enrichRequest),
    outgoing: all.filter((r) => r.fromUserId === uid && r.status === "pending").map(enrichRequest),
  });
});

router.post("/requests", (req, res) => {
  const toUserId = Number(req.body?.toUserId);
  const message = String(req.body?.message || "").trim().slice(0, 200);
  if (!toUserId || toUserId === req.user.id) {
    return res.status(400).json({ error: "Ungültiger Empfänger." });
  }
  if (!store.collection("users").some((u) => u.id === toUserId)) {
    return res.status(404).json({ error: "Nutzer nicht gefunden." });
  }
  const st = connectionStatus(req.user.id, toUserId);
  if (st === "connected") return res.status(400).json({ error: "Bereits vernetzt." });
  if (st === "pending_out") return res.status(400).json({ error: "Anfrage bereits gesendet." });
  if (st === "pending_in") return res.status(400).json({ error: "Diese Person hat dir bereits eine Anfrage gesendet — bitte dort bestätigen." });

  const rows = marketStore.networkRequests();
  const row = {
    id: marketStore.nextNetworkRequestId(),
    fromUserId: req.user.id,
    toUserId,
    message: message || null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  rows.push(row);
  marketStore.setNetworkRequests(rows);
  res.status(201).json(enrichRequest(row));
});

router.post("/requests/:id/accept", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.networkRequests();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (rows[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Nur der Empfänger kann bestätigen." });
  if (rows[idx].status !== "pending") return res.status(400).json({ error: "Anfrage ist nicht offen." });
  rows[idx].status = "accepted";
  rows[idx].respondedAt = new Date().toISOString();
  marketStore.setNetworkRequests(rows);
  res.json(enrichRequest(rows[idx]));
});

router.post("/requests/:id/reject", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.networkRequests();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (rows[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Nur der Empfänger kann ablehnen." });
  rows[idx].status = "rejected";
  rows[idx].respondedAt = new Date().toISOString();
  marketStore.setNetworkRequests(rows);
  res.json({ ok: true });
});

/** Status zu einem Profil (für UI-Buttons). */
router.get("/status/:userId", (req, res) => {
  const other = Number(req.params.userId);
  res.json({ status: connectionStatus(req.user.id, other) });
});

/** Aufgabe an Netzwerk-Kontakt delegieren. */
router.get("/delegations", (req, res) => {
  const uid = req.user.id;
  const all = marketStore.delegations();
  const map = (d) => {
    const team = d.teamId ? marketStore.teams().find((t) => t.id === d.teamId) : null;
    return {
      ...d,
      fromName: userName(d.fromUserId),
      toName: team ? team.name : userName(d.toUserId),
      teamName: team?.name || null,
    };
  };
  res.json({
    received: all.filter((d) => d.toUserId === uid).map(map),
    sent: all.filter((d) => d.fromUserId === uid).map(map),
  });
});

router.post("/delegations", (req, res) => {
  const { toUserId, teamId, title, description, projectId } = req.body || {};
  let tid = Number(toUserId);
  let tidTeam = teamId ? Number(teamId) : null;
  if (tidTeam) {
    const team = marketStore.teams().find((t) => t.id === tidTeam);
    if (!team) return res.status(404).json({ error: "Team nicht gefunden." });
    tid = team.ownerId;
    if (!areNetworked(req.user.id, tid) && req.user.id !== team.ownerId) {
      return res.status(403).json({ error: "Nur an Teams delegierbar, deren Leitung im Netzwerk ist." });
    }
  } else {
    if (!tid || !title?.trim()) return res.status(400).json({ error: "Empfänger und Titel sind Pflicht." });
    if (!areNetworked(req.user.id, tid)) {
      return res.status(403).json({ error: "Nur an bestätigte Netzwerk-Kontakte delegierbar." });
    }
  }
  if (!title?.trim()) return res.status(400).json({ error: "Titel ist Pflicht." });
  const rows = marketStore.delegations();
  const d = {
    id: marketStore.nextDelegationId(),
    fromUserId: req.user.id,
    toUserId: tid,
    teamId: tidTeam,
    title: String(title).trim().slice(0, 120),
    description: description ? String(description).trim().slice(0, 2000) : "",
    projectId: projectId ? Number(projectId) : null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  rows.push(d);
  marketStore.setDelegations(rows);
  const team = tidTeam ? marketStore.teams().find((t) => t.id === tidTeam) : null;
  res.status(201).json({ ...d, toName: team?.name || userName(tid), teamName: team?.name || null });
});

router.post("/delegations/:id/accept", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.delegations();
  const idx = rows.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (rows[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Kein Zugriff." });
  rows[idx].status = "active";
  rows[idx].acceptedAt = new Date().toISOString();
  marketStore.setDelegations(rows);
  res.json(rows[idx]);
});

router.post("/delegations/:id/decline", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.delegations();
  const idx = rows.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (rows[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Kein Zugriff." });
  rows[idx].status = "declined";
  marketStore.setDelegations(rows);
  res.json({ ok: true });
});

router.post("/delegations/:id/complete", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.delegations();
  const idx = rows.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  const d = rows[idx];
  if (d.toUserId !== req.user.id && d.fromUserId !== req.user.id) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  rows[idx].status = "done";
  rows[idx].completedAt = new Date().toISOString();
  marketStore.setDelegations(rows);
  res.json(rows[idx]);
});

/** Buchungsanfrage an Netzwerk-Kontakt. */
router.get("/bookings", (req, res) => {
  const uid = req.user.id;
  const all = marketStore.bookings();
  const map = (b) => ({
    ...b,
    fromName: userName(b.fromUserId),
    toName: userName(b.toUserId),
  });
  res.json({
    received: all.filter((b) => b.toUserId === uid).map(map),
    sent: all.filter((b) => b.fromUserId === uid).map(map),
  });
});

router.post("/bookings", (req, res) => {
  const { toUserId, message, slotLabel, projectId } = req.body || {};
  const tid = Number(toUserId);
  if (!tid || !message?.trim()) return res.status(400).json({ error: "Empfänger und Nachricht sind Pflicht." });
  if (!areNetworked(req.user.id, tid)) {
    return res.status(403).json({ error: "Nur bestätigte Netzwerk-Kontakte buchbar." });
  }
  const rows = marketStore.bookings();
  const b = {
    id: marketStore.nextBookingId(),
    fromUserId: req.user.id,
    toUserId: tid,
    message: String(message).trim().slice(0, 500),
    slotLabel: slotLabel ? String(slotLabel).slice(0, 80) : null,
    projectId: projectId ? Number(projectId) : null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  rows.push(b);
  marketStore.setBookings(rows);
  res.status(201).json({ ...b, toName: userName(tid) });
});

router.post("/bookings/:id/confirm", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.bookings();
  const idx = rows.findIndex((b) => b.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (rows[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Nur der Gebuchte kann bestätigen." });
  rows[idx].status = "confirmed";
  rows[idx].respondedAt = new Date().toISOString();
  marketStore.setBookings(rows);
  res.json(rows[idx]);
});

router.post("/bookings/:id/decline", (req, res) => {
  const id = Number(req.params.id);
  const rows = marketStore.bookings();
  const idx = rows.findIndex((b) => b.id === id);
  if (idx === -1) return res.status(404).json({ error: "Nicht gefunden." });
  if (rows[idx].toUserId !== req.user.id) return res.status(403).json({ error: "Kein Zugriff." });
  rows[idx].status = "declined";
  marketStore.setBookings(rows);
  res.json({ ok: true });
});

export default router;

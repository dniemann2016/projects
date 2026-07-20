import { Router } from "express";
import { store } from "../lib/store.js";
import { requireUser, requireAdmin, requireAcceptedTerms } from "../lib/currentUser.js";

// Phase 3 (Produktplan Kap. 8, Weg A — Tippgeber-Modell): kuratierte
// Startup-Projekte einer LIZENZIERTEN Partner-Plattform (ECSP). Wir stellen
// nur den Kontakt her (Link), beraten nicht, vermitteln nicht — die
// Investition läuft komplett beim Partner. Provision = Tippgeber-Vergütung.

const router = Router();

/** Kuratierte Projekte — vom Admin gepflegt, für Nutzer nur lesbar. */
router.get("/", requireUser, requireAcceptedTerms, (_req, res) => {
  const projects = store.collection("impactProjects").filter((p) => p.active !== false);
  res.json({
    projects,
    disclaimer:
      "Alle Projekte werden auf einer lizenzierten Partner-Plattform angeboten (ECSP-Zulassung liegt beim Partner). AboWandler stellt nur den Kontakt her (Tippgeber) und erhält dafür ggf. eine Provision (Anzeige*). Keine Anlageberatung — Investitionen in Startups bergen Totalverlustrisiko.",
  });
});

/** Admin: Projekt anlegen/aktualisieren. */
router.post("/", requireAdmin, (req, res) => {
  const { title, partner, url, pitch, minInvest, category } = req.body || {};
  if (!String(title || "").trim()) return res.status(400).json({ error: "Titel fehlt." });
  if (!/^https:\/\//.test(String(url || ""))) return res.status(400).json({ error: "Partner-Link muss mit https:// beginnen." });

  const projects = store.collection("impactProjects");
  const project = {
    id: `imp-${Date.now()}`,
    title: String(title).slice(0, 120),
    partner: String(partner || "").slice(0, 80),
    url: String(url),
    pitch: String(pitch || "").slice(0, 500),
    minInvest: Number(minInvest) || null,
    category: String(category || "startup").slice(0, 40),
    active: true,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  projects.push(project);
  store.setCollection("impactProjects", projects);
  res.status(201).json(project);
});

router.delete("/:id", requireAdmin, (req, res) => {
  const projects = store.collection("impactProjects");
  if (!projects.some((p) => p.id === req.params.id)) return res.status(404).json({ error: "Projekt nicht gefunden." });
  store.setCollection("impactProjects", projects.filter((p) => p.id !== req.params.id));
  res.status(204).end();
});

export default router;

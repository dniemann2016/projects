import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import aiRouter from "./routes/ai.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import accountsRouter from "./routes/accounts.js";
import etfsRouter from "./routes/etfs.js";
import investRouter from "./routes/invest.js";
import tipsRouter from "./routes/tips.js";
import userRouter from "./routes/user.js";
import usersRouter from "./routes/users.js";
import adminRouter from "./routes/admin.js";
import scanRouter from "./routes/scan.js";
import billingRouter, { billingWebhookHandler } from "./routes/billing.js";
import holdingsRouter from "./routes/holdings.js";
import brokersRouter from "./routes/brokers.js";
import analyzeRouter from "./routes/analyze.js";
import cancelPagesRouter from "./routes/cancelPages.js";
import impactRouter from "./routes/impact.js";
import legalRouter from "./routes/legal.js";
import marketProjectsRouter from "./routes/marketProjects.js";
import marketBidsRouter from "./routes/marketBids.js";
import marketMessagesRouter from "./routes/marketMessages.js";
import marketProfilesRouter from "./routes/marketProfiles.js";
import marketTeamsRouter from "./routes/marketTeams.js";
import marketNetworkRouter from "./routes/marketNetwork.js";
import marketOrganonRouter from "./routes/marketOrganon.js";
import marketOffersRouter from "./routes/marketOffers.js";
import marketVerificationRouter from "./routes/marketVerification.js";
import marketReviewsRouter from "./routes/marketReviews.js";
import marketMilestonesRouter from "./routes/marketMilestones.js";
import marketTeamBuilderRouter from "./routes/marketTeamBuilder.js";
import marketCollaborationRouter from "./routes/marketCollaboration.js";
import marketSearchRouter from "./routes/marketSearch.js";
import marketContestsRouter from "./routes/marketContests.js";
import marketPaymentsRouter from "./routes/marketPayments.js";
import marketNotificationsRouter from "./routes/marketNotifications.js";
import marketWorkSamplesRouter from "./routes/marketWorkSamples.js";
import marketPlannerRouter from "./routes/marketPlanner.js";
import marketAdminRouter from "./routes/marketAdmin.js";
import { processAutoReleases } from "./lib/marketEscrow.js";
import { seedMarketIfEmpty } from "./lib/marketStore.js";
import { seedMarketDemosV2 } from "./lib/marketSeedDemos.js";
import { rateLimit } from "./lib/rateLimit.js";
import { getLanIp } from "./lib/network.js";

const app = express();
app.disable("x-powered-by");
seedMarketIfEmpty();
seedMarketDemosV2();
app.use(cors());

// Security-Header gegen Clickjacking, MIME-Sniffing, XSS.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Stripe Webhook braucht Raw-Body — vor express.json()
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);

app.use(express.json({ limit: "10mb" }));

app.use("/api/ai", rateLimit({ windowMs: 60_000, max: 15, message: "KI-Rate-Limit erreicht — bitte kurz warten." }), aiRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/etfs", etfsRouter);
app.use("/api/invest", investRouter);
app.use("/api/tips", tipsRouter);
app.use("/api/user", userRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/scan", scanRouter);
app.use("/api/billing", billingRouter);
app.use("/api/holdings", holdingsRouter);
app.use("/api/brokers", brokersRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/impact", impactRouter);
app.use("/api/legal", legalRouter);
app.use("/api/market/projects", marketProjectsRouter);
app.use("/api/market/bids", marketBidsRouter);
app.use("/api/market/messages", marketMessagesRouter);
app.use("/api/market/profiles", marketProfilesRouter);
app.use("/api/market/teams", marketTeamsRouter);
app.use("/api/market/network", marketNetworkRouter);
app.use("/api/market/organon", marketOrganonRouter);
app.use("/api/market/offers", marketOffersRouter);
app.use("/api/market/verification", marketVerificationRouter);
app.use("/api/market/reviews", marketReviewsRouter);
app.use("/api/market/milestones", marketMilestonesRouter);
app.use("/api/market/team-builder", marketTeamBuilderRouter);
app.use("/api/market/collab", marketCollaborationRouter);
app.use("/api/market/search", marketSearchRouter);
app.use("/api/market/contests", marketContestsRouter);
app.use("/api/market/payments", marketPaymentsRouter);
app.use("/api/market/notifications", marketNotificationsRouter);
app.use("/api/market/work-samples", marketWorkSamplesRouter);
app.use("/api/market/planner", marketPlannerRouter);
app.use("/api/market/admin", marketAdminRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// SEO-Landingpages „<Anbieter> kündigen" — server-gerendert, eine pro Merchant.
app.use("/kuendigen", cancelPagesRouter);

// When ABOWANDLER_STATIC_DIR is set (packaged desktop app), the built
// frontend is served from the same process/port — no separate Vite dev
// server needed, and everything runs on one local origin.
const isFullApp = Boolean(process.env.ABOWANDLER_STATIC_DIR);
if (isFullApp) {
  const staticDir = process.env.ABOWANDLER_STATIC_DIR;
  app.use(express.static(staticDir));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

const PORT = process.env.PORT || 8787;
// Full-app runs (double-click launcher, standalone executable) bind to all
// interfaces by default, so the same running app is reachable from a phone
// or tablet on the same WiFi — still entirely local, no cloud involved.
// Plain backend-only dev mode (paired with a separate Vite dev server)
// stays on localhost only unless HOST is set explicitly.
const HOST = process.env.HOST || (isFullApp ? "0.0.0.0" : "127.0.0.1");

function startListening() {
  const server = app.listen(PORT, HOST, () => {
    console.log(`Projects läuft auf http://127.0.0.1:${PORT}`);
    if (HOST === "0.0.0.0") {
      const lanIp = getLanIp();
      if (lanIp) {
        console.log(`Im selben WLAN erreichbar (z.B. vom Handy) unter: http://${lanIp}:${PORT}`);
      }
    }
    setInterval(() => {
      try { processAutoReleases(); } catch (e) { console.error("auto-release", e.message); }
    }, 60 * 60 * 1000);
    try { processAutoReleases(); } catch (_) { /* ignore */ }
  });

  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      // Anderer Prozess bedient den Port bereits — für Electron-Fallback OK.
      console.warn(`Port ${PORT} belegt — vorhandener Server wird genutzt.`);
      if (process.env.ABOWANDLER_REQUIRE_LISTEN === "1") process.exit(1);
      return;
    }
    console.error("Server-Fehler:", err.message);
    process.exit(1);
  });
}

startListening();

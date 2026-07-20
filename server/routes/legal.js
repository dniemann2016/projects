import { Router } from "express";
import { TERMS_VERSION, LIABILITY_SHORT, getImpressum, getLaunchChecklist } from "../lib/legal.js";

const router = Router();

router.get("/", (_req, res) => {
  const launch = getLaunchChecklist();
  res.json({
    termsVersion: TERMS_VERSION,
    liabilityShort: LIABILITY_SHORT,
    impressum: getImpressum(),
    launchReady: launch.launchReady,
    launchMissing: launch.missing,
  });
});

export default router;

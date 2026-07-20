import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_DATA_DIR } from "../lib/paths.js";

const tips = JSON.parse(fs.readFileSync(path.join(BUNDLED_DATA_DIR, "tips.json"), "utf8"));

const router = Router();

router.get("/", (req, res) => {
  res.json(tips);
});

export default router;

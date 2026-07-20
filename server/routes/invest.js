import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_DATA_DIR } from "../lib/paths.js";

const etfs = JSON.parse(fs.readFileSync(path.join(BUNDLED_DATA_DIR, "etfs.json"), "utf8"));
const extra = JSON.parse(fs.readFileSync(path.join(BUNDLED_DATA_DIR, "invest.json"), "utf8"));

// One universe across all asset classes; the ETF list keeps its own route for
// the classic calculator, this one feeds the Investieren page.
const universe = [...etfs.map((e) => ({ ...e, class: "etf" })), ...extra];

const router = Router();

router.get("/", (req, res) => {
  const { q, class: cls } = req.query;
  let list = universe;
  if (cls && cls !== "alle") list = list.filter((a) => a.class === cls);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        a.category.toLowerCase().includes(needle) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(needle))
    );
  }
  res.json(list);
});

export default router;

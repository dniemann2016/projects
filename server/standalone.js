// Entry point for the compiled single-file executable (Node SEA build).
// Sets up on-device paths before the actual server starts, then opens
// the default browser — no separate Node.js install needed on the
// target machine, since the runtime is embedded in the executable.
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";

process.env.ABOWANDLER_DATA_DIR = path.join(os.homedir(), ".abowandler", "data");
process.env.PORT = process.env.PORT || "8787";
// HOST is intentionally left to index.js's own default (0.0.0.0 for a full
// app run) unless the user sets it explicitly — e.g. to migrate to a real
// server/host later, or to lock it back down to 127.0.0.1-only.

// dist/ (frontend) and data/ (seed + ETF reference data) ship next to the
// compiled executable rather than being embedded in the binary itself.
const exeDir = path.dirname(process.execPath);
process.env.ABOWANDLER_STATIC_DIR = path.join(exeDir, "dist");
process.env.ABOWANDLER_BUNDLED_DATA_DIR = path.join(exeDir, "data");

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} ${url}`, () => {});
}

async function main() {
  await import("./index.js");

  // Always browse via localhost, even when the server binds to 0.0.0.0 for
  // LAN access — 0.0.0.0 itself isn't a visitable address.
  const localUrl = `http://127.0.0.1:${process.env.PORT}`;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${localUrl}/api/health`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  openBrowser(localUrl);
}

main();

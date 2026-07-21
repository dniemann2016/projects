const { app } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "spawn-probe.log");
const childLog = path.join(__dirname, "spawn-child.log");

app.whenReady().then(() => {
  const entry = "/Users/davidniemann/Downloads/Projects.app/Contents/Resources/server/index.js";
  const out = fs.openSync(childLog, "w");
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: "8787",
      HOST: "127.0.0.1",
      ABOWANDLER_DATA_DIR: "/tmp/projects-probe-data",
      ABOWANDLER_STATIC_DIR: "/Users/davidniemann/Downloads/Projects.app/Contents/Resources/dist",
    },
    stdio: ["ignore", out, out],
  });
  fs.writeFileSync(logFile, `spawned pid=${child.pid}\nexec=${process.execPath}\n`);
  child.on("error", (e) => fs.appendFileSync(logFile, "spawn error "+e.stack+"\n"));
  child.on("exit", (c,s) => fs.appendFileSync(logFile, `exit code=${c} signal=${s}\n`));
  setTimeout(async () => {
    try {
      const r = await fetch("http://127.0.0.1:8787/api/health");
      fs.appendFileSync(logFile, `health ${r.status}\n`);
    } catch (e) {
      fs.appendFileSync(logFile, `health fail ${e.message}\n`);
    }
    try { child.kill(); } catch {}
    app.quit();
  }, 4000);
});

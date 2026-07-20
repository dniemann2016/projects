// Wenn die Shell fälschlich ELECTRON_RUN_AS_NODE setzt, startet die .app als
// reines Node und das Backend fehlt → Login zeigt "Failed to fetch".
// Für Child-Spawns setzen wir die Variable gezielt wieder; hier muss sie weg.
if (process.env.ELECTRON_RUN_AS_NODE) {
  delete process.env.ELECTRON_RUN_AS_NODE;
}

const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const PORT = Number(process.env.PORT || 8787);
const HOST = "127.0.0.1";

let serverProcess = null;
let serverOwned = false; // true = wir haben den Prozess gestartet und dürfen ihn beenden
let mainWindow = null;
let serverStartedInProcess = false;

function logLine(msg) {
  try {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "projects-desktop.log"), `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // ignore
  }
  console.log(msg);
}

function serverEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "server", "index.js")
    : path.join(__dirname, "..", "server", "index.js");
}

function staticDirPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.join(__dirname, "..", "dist");
}

function dataDirPath() {
  return path.join(app.getPath("userData"), "data");
}

function serverEnv() {
  return {
    ...process.env,
    PORT: String(PORT),
    HOST,
    ABOWANDLER_DATA_DIR: dataDirPath(),
    ABOWANDLER_STATIC_DIR: staticDirPath(),
  };
}

async function healthOk() {
  try {
    const res = await fetch(`http://${HOST}:${PORT}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await healthOk()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function findSystemNode() {
  const candidates = [
    process.env.PROJECTS_NODE_PATH,
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node",
    "/usr/bin/node",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function spawnServer(command, args, envExtra = {}) {
  const logPath = path.join(app.getPath("userData"), "projects-server.log");
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  const out = fs.openSync(logPath, "a");
  const child = spawn(command, args, {
    env: { ...serverEnv(), ...envExtra },
    stdio: ["ignore", out, out],
    detached: false,
  });
  child.on("error", (err) => logLine(`server spawn error: ${err.message}`));
  child.on("exit", (code, signal) => {
    logLine(`server exit code=${code} signal=${signal}`);
    if (serverProcess === child) serverProcess = null;
  });
  serverProcess = child;
  serverOwned = true;
  logLine(`spawned server pid=${child.pid} via ${command}`);
  return child;
}

async function startServerInProcess() {
  if (serverStartedInProcess) return true;
  const entry = serverEntryPath();
  Object.assign(process.env, serverEnv());
  // Drop ELECTRON_RUN_AS_NODE so main stays a real Electron process.
  delete process.env.ELECTRON_RUN_AS_NODE;
  await import(pathToFileURL(entry).href);
  serverStartedInProcess = true;
  serverOwned = false; // same process — quit kills it with the app
  logLine("server started in-process");
  return true;
}

async function startServer() {
  if (await healthOk()) {
    logLine("reusing existing backend on :8787");
    serverOwned = false;
    return true;
  }

  // 1) System Node — eigener Prozess, blockiert nicht den Electron-Main-Thread
  //    (In-Process-Express hing zuvor: TCP accept, aber keine HTTP-Antworten).
  const nodeBin = findSystemNode();
  if (nodeBin) {
    try {
      spawnServer(nodeBin, [serverEntryPath()]);
      if (await waitForServer(12000)) return true;
    } catch (err) {
      logLine(`system node spawn failed: ${err?.message || err}`);
    }
  }

  // 2) Electron-as-Node fallback
  try {
    spawnServer(process.execPath, [serverEntryPath()], { ELECTRON_RUN_AS_NODE: "1" });
    if (await waitForServer(12000)) return true;
  } catch (err) {
    logLine(`electron-as-node spawn failed: ${err?.message || err}`);
  }

  // 3) Last resort: in-process (nur wenn kein Node verfügbar)
  try {
    await startServerInProcess();
    if (await waitForServer(8000)) return true;
  } catch (err) {
    logLine(`in-process server failed: ${err?.stack || err}`);
  }

  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    title: "Projects",
    show: false,
    backgroundColor: "#1d1d1f",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === "darwin") app.dock?.show();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      if (process.platform === "darwin") app.dock?.show();
    }
  }, 2500);

  const startUrl = process.env.ELECTRON_START_URL || `http://${HOST}:${PORT}`;
  mainWindow.loadURL(startUrl);
}

function stopServer() {
  if (!serverOwned || !serverProcess) return;
  try {
    serverProcess.kill();
  } catch {
    // ignore
  }
  serverProcess = null;
  serverOwned = false;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    logLine(`Projects desktop starting packaged=${app.isPackaged}`);
    const ok = await startServer();
    if (!ok) {
      dialog.showErrorBox(
        "Projects — Backend fehlt",
        "Der lokale Server auf Port 8787 konnte nicht gestartet werden.\n\n" +
          "Bitte die App erneut öffnen oder im Terminal starten:\n" +
          "cd ~/Downloads/Projects && ABOWANDLER_STATIC_DIR=dist PORT=8787 node server/index.js"
      );
    }
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopServer);

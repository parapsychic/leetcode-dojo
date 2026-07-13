// Electron main process for dx dbye.
// Dev:  loads the running `next dev` server (http://localhost:3000).
// Prod: spawns the bundled Next standalone server using Electron's own Node,
//       then loads it. The standalone server runs all API routes (Claude Agent
//       SDK, LeetCode proxy, JSON progress store) exactly as in the web app.

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
const DEV_URL = process.env.EFDX_DEV_URL || "http://localhost:3000";

// Fixed log path (works before app is ready) so startup issues are diagnosable.
const LOG_PATH = path.join(os.tmpdir(), "efdx-main.log");

let serverProcess = null;
let mainWindow = null;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    /* ignore */
  }
  try {
    process.stdout.write(line);
  } catch {
    /* ignore */
  }
}

log("main.js loaded; isPackaged=" + app.isPackaged + " execPath=" + process.execPath);
process.on("uncaughtException", (err) => log("uncaughtException", err && err.stack ? err.stack : String(err)));
process.on("unhandledRejection", (err) => log("unhandledRejection", String(err)));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("server timeout"));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

async function startProdServer() {
  const port = await getFreePort();
  const serverDir = path.join(process.resourcesPath, "app");
  const serverEntry = path.join(serverDir, "server.js");
  log("starting server", serverEntry, "port", port, "execPath", process.execPath);

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      // JSON progress store writes here (writable, per-user).
      EFDX_DATA_DIR: app.getPath("userData"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => log("[server]", d.toString().trim()));
  serverProcess.stderr.on("data", (d) => log("[server:err]", d.toString().trim()));
  serverProcess.on("error", (err) => log("[server:spawn-error]", err.message));
  serverProcess.on("exit", (code) => log("[server] exited with code", String(code)));

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  log("server ready at", url);
  return url;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: "#0b0f17",
    title: "dx dbye",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  let url = DEV_URL;
  if (!isDev) {
    try {
      url = await startProdServer();
    } catch (err) {
      log("Failed to start server:", err && err.message ? err.message : String(err));
    }
  }
  log("loading url", url);
  try {
    await mainWindow.loadURL(url);
    log("loaded url ok");
  } catch (err) {
    log("loadURL error", err && err.message ? err.message : String(err));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
  }
});

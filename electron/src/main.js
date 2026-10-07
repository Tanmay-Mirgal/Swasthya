// @ts-check
const path = require("path");
const { app, BrowserWindow, ipcMain, session } = require("electron");
const { config } = require("./config");
const security = require("./security");
const permissions = require("./permissions");
const windowState = require("./windowState");
const menu = require("./menu");
const protocol = require("./protocol");
const updater = require("./updater");

const PARTITION = "persist:swasthya";
const APP_URL = config.appUrl;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Set<import("electron").WebContents>} */
const popupContents = new Set();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((a) => a.startsWith(`${protocol.SCHEME}://`));
    if (link) protocol.handleUrl(link);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/** Windows a page opens itself (Clerk, payment pages): no preload, no Node, sandboxed. */
const popupOptions = {
  autoHideMenuBar: true,
  webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: PARTITION },
};

/** @param {import("electron").WebContents} contents */
function guardOpenedWindows(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    const openerUrl = contents.getURL();
    const inApp =
      url === "about:blank" ||
      security.isTrustedUrl(url) ||
      // A payment provider may hand the customer to their bank in a popup.
      (security.isPaymentUrl(openerUrl) && url.startsWith("https://"));
    if (inApp) return { action: "allow", overrideBrowserWindowOptions: popupOptions };
    security.openExternalSafely(url);
    return { action: "deny" };
  });
  contents.on("did-create-window", (child) => popupContents.add(child.webContents));
}

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault());
  guardOpenedWindows(contents);

  // Only the main window is pinned to Swasthya (+ sign-in/payment providers); popups navigate freely
  // between bank pages but cannot reach Node.
  const guard = (/** @type {Electron.Event} */ e, /** @type {string} */ url) => {
    if (popupContents.has(contents) || security.isTrustedUrl(url) || url.startsWith("file:")) return;
    e.preventDefault();
    security.openExternalSafely(url);
  };
  contents.on("will-navigate", guard);
  contents.on("will-redirect", guard);
});

function createWindow() {
  const state = windowState.load({ width: config.defaultWidth, height: config.defaultHeight });

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    title: config.appName,
    backgroundColor: "#FBFBF8",
    icon: path.join(__dirname, "..", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });
  if (state.maximized) mainWindow.maximize();
  windowState.track(mainWindow);

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 /* aborted */ || validatedURL.includes("offline.html")) return;
    console.warn(`[Swasthya Desktop] Failed to load ${validatedURL}: ${errorDescription}`);
    void mainWindow?.loadFile(path.join(__dirname, "..", "offline.html"), { query: { url: APP_URL } });
  });

  void mainWindow.loadURL(APP_URL);
}

// Only pages of the app itself may talk to the shell.
const fromApp = (/** @type {Electron.IpcMainEvent | Electron.IpcMainInvokeEvent} */ e) =>
  security.isAppUrl(e.senderFrame?.url || "");

ipcMain.on("swasthya:get-version", (e) => {
  e.returnValue = fromApp(e) ? app.getVersion() : "";
});
ipcMain.handle("swasthya:start-login", (e) => (fromApp(e) ? protocol.startLogin() : false));

app.whenReady().then(() => {
  permissions.install(session.fromPartition(PARTITION));
  menu.install();
  protocol.init(() => mainWindow);
  createWindow();
  updater.init();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});


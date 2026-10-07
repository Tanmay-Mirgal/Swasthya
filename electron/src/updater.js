// @ts-check
// Updates for the desktop shell only. The interface itself is the website, which updates on every
// web deploy; this is just for Electron/Chromium and shell changes.
const { app, dialog, shell } = require("electron");
const { config } = require("./config");

const FOUR_HOURS = 4 * 60 * 60 * 1000;

function init() {
  if (!app.isPackaged) return;
  const { autoUpdater } = require("electron-updater");

  // Unsigned macOS builds cannot be replaced in place, so there we only point to the release page.
  const canInstall = process.platform !== "darwin" || config.macAutoUpdate;
  autoUpdater.autoDownload = canInstall;
  autoUpdater.autoInstallOnAppQuit = canInstall;

  autoUpdater.on("update-available", async (info) => {
    if (canInstall || !config.releasesUrl) return;
    const { response } = await dialog.showMessageBox({
      type: "info",
      message: `Swasthya ${info.version} is available`,
      detail: "Download the new version to update.",
      buttons: ["Open download page", "Later"],
      defaultId: 0,
    });
    if (response === 0) void shell.openExternal(config.releasesUrl);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      message: `Swasthya ${info.version} is ready`,
      detail: "Restart to finish updating.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (error) => console.warn("[Swasthya Desktop] update check failed:", error?.message));

  const check = () => void autoUpdater.checkForUpdates().catch(() => undefined);
  setTimeout(check, 15_000);
  setInterval(check, FOUR_HOURS);
}

module.exports = { init };

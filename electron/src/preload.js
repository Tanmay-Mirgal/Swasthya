// @ts-check
// The only thing the page can learn about the desktop shell. No Node, no filesystem, no raw IPC.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("SwasthyaDesktop", {
  isDesktop: true,
  platform: process.platform,
  version: ipcRenderer.sendSync("swasthya:get-version"),
  /** Sign in through the system browser (needed for social login, which providers block in embedded windows). */
  startExternalLogin: () => ipcRenderer.invoke("swasthya:start-login"),
});

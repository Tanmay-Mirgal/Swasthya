// @ts-check
// A real application menu. Without it macOS has no Cut/Copy/Paste/Quit shortcuts.
const { app, Menu } = require("electron");
const { config } = require("./config");
const { openExternalSafely } = require("./security");

function install() {
  const isMac = process.platform === "darwin";
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac ? [{ role: /** @type {const} */ ("appMenu") }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(app.isPackaged ? [] : [{ role: /** @type {const} */ ("toggleDevTools") }]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [{ label: "Open Swasthya in your browser", click: () => openExternalSafely(config.appUrl) }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { install };

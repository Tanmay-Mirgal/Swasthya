// @ts-check
// Remember the window size and position between launches (a small JSON file; no dependency).
const fs = require("fs");
const path = require("path");
const { app, screen } = require("electron");

const file = () => path.join(app.getPath("userData"), "window-state.json");

/** @param {{ width: number; height: number }} fallback */
function load(fallback) {
  try {
    const saved = JSON.parse(fs.readFileSync(file(), "utf8"));
    const visible = screen.getAllDisplays().some((d) => {
      const b = d.workArea;
      return saved.x >= b.x - 50 && saved.y >= b.y - 50 && saved.x < b.x + b.width - 100 && saved.y < b.y + b.height - 100;
    });
    if (visible && saved.width >= 400 && saved.height >= 300) return saved;
    return { width: saved.width || fallback.width, height: saved.height || fallback.height, maximized: Boolean(saved.maximized) };
  } catch {
    return { ...fallback };
  }
}

/** @param {import("electron").BrowserWindow} win */
function track(win) {
  let timer = null;
  const save = () => {
    if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
    const maximized = win.isMaximized();
    const bounds = maximized ? win.getNormalBounds() : win.getBounds();
    try {
      fs.writeFileSync(file(), JSON.stringify({ ...bounds, maximized }));
    } catch {
      /* not critical */
    }
  };
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  win.on("resize", later);
  win.on("move", later);
  win.on("close", save);
}

module.exports = { load, track };

// @ts-check
// Camera / microphone / notification permissions: only for Swasthya's own origin, and with the
// operating-system privacy switch respected (macOS prompt, macOS + Windows "denied" guidance).
const { dialog, shell, systemPreferences } = require("electron");
const { isAppUrl } = require("./security");

const ALLOWED = new Set(["media", "fullscreen", "notifications", "clipboard-sanitized-write"]);

const SETTINGS = {
  darwin: { camera: "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera", microphone: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone" },
  win32: { camera: "ms-settings:privacy-webcam", microphone: "ms-settings:privacy-microphone" },
};

let warned = new Set();

/** @param {"camera"|"microphone"} kind */
async function osAllows(kind) {
  if (process.platform !== "darwin" && process.platform !== "win32") return true;
  const status = systemPreferences.getMediaAccessStatus(kind);
  if (status === "granted" || status === "unknown") return true;
  if (status === "not-determined" && process.platform === "darwin") {
    return systemPreferences.askForMediaAccess(kind);
  }
  // denied / restricted: only the user can change this, so say where.
  if (!warned.has(kind)) {
    warned.add(kind);
    const label = kind === "camera" ? "camera" : "microphone";
    const { response } = await dialog.showMessageBox({
      type: "info",
      message: `Swasthya can’t use your ${label}`,
      detail: `Allow Swasthya to use your ${label} in your system privacy settings, then try again.`,
      buttons: ["Open settings", "Not now"],
      defaultId: 0,
    });
    const target = SETTINGS[process.platform]?.[kind];
    if (response === 0 && target) void shell.openExternal(target);
  }
  return false;
}

/** @param {import("electron").Session} ses */
function install(ses) {
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => ALLOWED.has(permission) && isAppUrl(requestingOrigin));

  ses.setPermissionRequestHandler(async (_wc, permission, callback, details) => {
    if (!ALLOWED.has(permission) || !isAppUrl(details.requestingUrl)) return callback(false);
    if (permission !== "media") return callback(true);

    const types = /** @type {string[]} */ (/** @type {any} */ (details).mediaTypes ?? ["video", "audio"]);
    try {
      for (const type of types) {
        if (type === "video" && !(await osAllows("camera"))) return callback(false);
        if (type === "audio" && !(await osAllows("microphone"))) return callback(false);
      }
      callback(true);
    } catch (error) {
      console.warn("[Swasthya Desktop] media permission check failed", error);
      callback(false);
    }
  });
}

module.exports = { install };

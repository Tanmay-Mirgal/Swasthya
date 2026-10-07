// @ts-check
// swasthya:// exists for ONE purpose: handing a system-browser sign-in back to the desktop window.
// Social login providers (Google) refuse embedded windows, so the user signs in in their normal
// browser and the browser returns a one-time code. The code alone is useless: it can only be
// redeemed together with a secret (PKCE verifier) that never leaves this process until the page
// redeems it, and it is only accepted for a sign-in this app instance started.
const crypto = require("crypto");
const { app, shell } = require("electron");
const path = require("path");
const { appOrigin } = require("./config");

const SCHEME = "swasthya";
const LOGIN_TTL_MS = 5 * 60 * 1000;
const b64url = (/** @type {Buffer} */ buf) => buf.toString("base64url");

/** @type {{ state: string; verifier: string; expires: number } | null} */
let pending = null;
/** @type {() => (import("electron").BrowserWindow | null)} */
let getWindow = () => null;

function register() {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(SCHEME);
  }
}

function startLogin() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  pending = { state, verifier, expires: Date.now() + LOGIN_TTL_MS };
  const url = `${appOrigin}/desktop-auth/?state=${state}&challenge=${challenge}`;
  void shell.openExternal(url);
  return true;
}

/** @param {string} raw */
function handleUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== `${SCHEME}:` || url.hostname !== "auth") return;

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const current = pending;
  pending = null; // one attempt per login, valid or not
  if (!current || Date.now() > current.expires) return;
  const a = Buffer.from(state);
  const b = Buffer.from(current.state);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return;
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(code)) return;

  const win = getWindow();
  if (!win) return;
  // Fragment: never sent to a server or logged. The page reads it and clears it.
  void win.loadURL(`${appOrigin}/desktop-auth/complete/#code=${code}&verifier=${current.verifier}`);
  if (win.isMinimized()) win.restore();
  win.focus();
}

/** @param {() => (import("electron").BrowserWindow | null)} windowGetter */
function init(windowGetter) {
  getWindow = windowGetter;
  register();
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleUrl(url);
  });
}

module.exports = { init, startLogin, handleUrl, SCHEME };

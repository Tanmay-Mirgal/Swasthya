// @ts-check
// Navigation and external-link policy. The window may only show Swasthya (and the sign-in / payment
// providers it depends on); everything else opens in the system browser, and only over safe schemes.
const { shell } = require("electron");
const { config, appOrigin } = require("./config");

const SAFE_EXTERNAL = new Set(["https:", "mailto:", "tel:"]);

/** @param {string} pattern @param {string} origin */
function originMatches(pattern, origin) {
  if (!pattern.includes("*")) return pattern === origin;
  const [scheme, host] = pattern.split("://");
  try {
    const o = new URL(origin);
    return o.protocol === `${scheme}:` && o.hostname.endsWith(host.replace("*", "")) && o.hostname.length > host.length - 1;
  } catch {
    return false;
  }
}

/** @param {string} url */
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** The app itself. */
function isAppUrl(url) {
  return originOf(url) === appOrigin;
}

/** The app plus the providers allowed to take over the main window (Clerk, payments). */
function isTrustedUrl(url) {
  const origin = originOf(url);
  if (!origin || origin === "null") return false;
  return origin === appOrigin || config.trustedOrigins.some((p) => originMatches(p, origin));
}

function isPaymentUrl(url) {
  const origin = originOf(url);
  return Boolean(origin) && config.paymentOrigins.some((p) => originMatches(p, origin));
}

/** Open a link in the OS browser, but never an arbitrary scheme (file:, smb:, custom handlers). */
function openExternalSafely(url) {
  try {
    if (SAFE_EXTERNAL.has(new URL(url).protocol)) void shell.openExternal(url);
  } catch {
    /* not a URL: ignore */
  }
}

module.exports = { isAppUrl, isTrustedUrl, isPaymentUrl, openExternalSafely, originOf };

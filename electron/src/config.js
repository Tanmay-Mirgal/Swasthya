// @ts-check
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULTS = {
  appUrl: "https://swasthya.tanmaymirgal.dev",
  appName: "Swasthya",
  minWidth: 1024,
  minHeight: 700,
  defaultWidth: 1366,
  defaultHeight: 850,
  releasesUrl: "",
  macAutoUpdate: false,
  trustedOrigins: /** @type {string[]} */ ([]),
  paymentOrigins: /** @type {string[]} */ ([]),
};

function load() {
  const config = { ...DEFAULTS };
  try {
    const file = path.join(__dirname, "..", "electron.config.json");
    if (fs.existsSync(file)) Object.assign(config, JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    console.warn("[Swasthya Desktop] Could not read electron.config.json, using defaults", error);
  }
  // Pointing a packaged app at another server is a phishing risk, so only a dev run may override the URL.
  if (!app.isPackaged && process.env.SWASTHYA_APP_URL) config.appUrl = process.env.SWASTHYA_APP_URL;
  return config;
}

const config = load();
const appOrigin = new URL(config.appUrl).origin;

module.exports = { config, appOrigin };

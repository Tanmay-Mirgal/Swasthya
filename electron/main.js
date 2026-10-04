const { app, BrowserWindow, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. Load Environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 2. Load Fallback configuration from electron.config.json if available
let config = {
  appUrl: 'https://rehablens.vercel.app',
  appName: 'RehabLens - AI Physical Therapy',
  minWidth: 1024,
  minHeight: 700,
  defaultWidth: 1366,
  defaultHeight: 850
};

try {
  const configPath = path.join(__dirname, 'electron.config.json');
  if (fs.existsSync(configPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...fileConfig };
  }
} catch (e) {
  console.warn('Could not read electron.config.json, using defaults', e);
}

// Environment variable overrides config file if provided
const TARGET_URL = process.env.APP_URL || config.appUrl || 'http://localhost:3000';

let mainWindow = null;

// Single instance lock (prevent multiple windows opening)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.defaultWidth,
    height: config.defaultHeight,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    title: config.appName,
    backgroundColor: '#090D16',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: true
    },
    autoHideMenuBar: true,
    show: false
  });

  // Remove default menu for sleek native appearance
  Menu.setApplicationMenu(null);

  // Auto grant Camera and Microphone permissions (Critical for MediaPipe and Video Calls)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'notifications', 'mediaKeySystem'];
    if (allowed.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'camera', 'microphone', 'notifications', 'mediaKeySystem'];
    return allowed.includes(permission);
  });

  // Smooth window reveal when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load user Vercel / Web URL
  console.log(`[RehabLens Desktop] Loading: ${TARGET_URL}`);
  mainWindow.loadURL(TARGET_URL);

  // If loading fails (e.g. user is offline or server unreachable), show offline fallback
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Avoid redirect loop if offline page itself is loading
    if (!validatedURL.includes('offline.html') && errorCode !== -3 /* aborted */) {
      console.warn(`[RehabLens Desktop] Failed to load ${validatedURL}: ${errorDescription}`);
      const offlinePath = path.join(__dirname, 'offline.html');
      mainWindow.loadFile(offlinePath, {
        query: { url: TARGET_URL }
      });
    }
  });

  // Handle external links (open in user's default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Keep internal navigation in electron, external (OAuth, docs, etc.) in default browser
    try {
      const targetHost = new URL(url).hostname;
      const currentHost = new URL(TARGET_URL).hostname;

      if (targetHost === currentHost) {
        return { action: 'allow' };
      }
    } catch {
      // invalid URL parse
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Reload shortcuts
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.loadURL(TARGET_URL);
      event.preventDefault();
    }
    // DevTools shortcut (Ctrl+Shift+I)
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

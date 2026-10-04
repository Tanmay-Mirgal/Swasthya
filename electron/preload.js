const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop environment flags and APIs to window
contextBridge.exposeInMainWorld('RehabLensDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron
});

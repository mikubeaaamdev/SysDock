const { contextBridge, ipcRenderer } = require('electron');

// Expose system info APIs to the renderer process
contextBridge.exposeInMainWorld('systemAPI', {
  getCPUInfo: () => ipcRenderer.invoke('get-cpu-info'),
  getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
  getDiskInfo: () => ipcRenderer.invoke('get-disk-info'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  openSettings: () => ipcRenderer.invoke('open-settings')
});

// Expose settings APIs to the renderer process
contextBridge.exposeInMainWorld('settingsAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  close: () => ipcRenderer.invoke('close-settings'),
  themeChanged: (theme) => ipcRenderer.send('theme-changed', theme)
});

// Expose electron APIs for IPC communication
contextBridge.exposeInMainWorld('electronAPI', {
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (event, theme) => callback(theme))
});

console.log('Preload script loaded');
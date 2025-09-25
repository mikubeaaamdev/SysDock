const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const si = require("systeminformation");
const os = require("os");
const { version } = require("./package.json");

let mainWindow;
let settingsWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true, // Hide menu bar
    show: false, // Don't show until ready
    icon: path.join(__dirname, 'assets/icon.ico') // You can add an icon later
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile("src/index.html");

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

function createSettingsWindow() {
  // Prevent multiple settings windows
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    minWidth: 350,
    minHeight: 400,
    maxWidth: 500,
    maxHeight: 600,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: false,
    resizable: true,
    title: 'SysDock Settings'
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.loadFile("src/settings.html");

  // Clean up reference when window is closed
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// IPC handlers for settings
ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('get-app-info', () => {
  return {
    version: version,
    name: 'SysDock',
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    platform: process.platform,
    arch: process.arch
  };
});

// Handle settings window closing
ipcMain.handle('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

// Handle theme changes from settings
ipcMain.on('theme-changed', (event, theme) => {
  console.log('Theme changed to:', theme);
  // Forward theme change to main window if needed
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme-changed', theme);
  }
});

// Cache for static system information to reduce repeated calls
let staticSystemInfo = {
  cpu: null,
  lastCpuUpdate: 0,
  networkInterfaces: null,
  lastNetworkUpdate: 0
};

const CACHE_DURATION = 30000; // Cache static info for 30 seconds

// IPC handlers for system information
ipcMain.handle("get-cpu-info", async () => {
  try {
    // Cache CPU static information (brand, cores, etc.) for 30 seconds
    const now = Date.now();
    if (!staticSystemInfo.cpu || (now - staticSystemInfo.lastCpuUpdate) > CACHE_DURATION) {
      staticSystemInfo.cpu = await si.cpu();
      staticSystemInfo.lastCpuUpdate = now;
    }
    
    // Always get fresh dynamic data (speed, load)
    const cpuCurrentSpeed = await si.cpuCurrentSpeed();
    const currentLoad = await si.currentLoad();
    
    return {
      manufacturer: staticSystemInfo.cpu.manufacturer,
      brand: staticSystemInfo.cpu.brand,
      cores: staticSystemInfo.cpu.cores,
      physicalCores: staticSystemInfo.cpu.physicalCores,
      speed: cpuCurrentSpeed.avg,
      currentLoad: Math.round(currentLoad.currentLoad),
      currentLoadUser: Math.round(currentLoad.currentLoadUser),
      currentLoadSystem: Math.round(currentLoad.currentLoadSystem)
    };
  } catch (error) {
    console.error("Error getting CPU info:", error);
    return null;
  }
});

ipcMain.handle("get-memory-info", async () => {
  try {
    const mem = await si.mem();
    const totalMem = mem.total;
    const usedMem = mem.used;
    const freeMem = mem.free;
    
    return {
      total: Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100, // GB
      used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100, // GB
      free: Math.round(freeMem / 1024 / 1024 / 1024 * 100) / 100, // GB
      usage: Math.round((usedMem / totalMem) * 100)
    };
  } catch (error) {
    console.error("Error getting memory info:", error);
    return null;
  }
});

ipcMain.handle("get-disk-info", async () => {
  try {
    const disks = await si.fsSize();
    return disks.map(disk => ({
      fs: disk.fs,
      type: disk.type,
      size: Math.round(disk.size / 1024 / 1024 / 1024 * 100) / 100, // GB
      used: Math.round(disk.used / 1024 / 1024 / 1024 * 100) / 100, // GB
      available: Math.round(disk.available / 1024 / 1024 / 1024 * 100) / 100, // GB
      usage: Math.round(disk.use)
    }));
  } catch (error) {
    console.error("Error getting disk info:", error);
    return [];
  }
});

ipcMain.handle("get-network-info", async () => {
  try {
    // Get network interfaces (cache these as they don't change often)
    const now = Date.now();
    if (!staticSystemInfo.networkInterfaces || (now - staticSystemInfo.lastNetworkUpdate) > CACHE_DURATION) {
      staticSystemInfo.networkInterfaces = await si.networkInterfaces();
      staticSystemInfo.lastNetworkUpdate = now;
    }
    
    // Get fresh network stats
    const networkStats = await si.networkStats();
    
    return {
      interfaces: staticSystemInfo.networkInterfaces.map(iface => ({
        iface: iface.iface,
        ifaceName: iface.ifaceName,
        ip4: iface.ip4,
        ip6: iface.ip6,
        mac: iface.mac,
        internal: iface.internal,
        virtual: iface.virtual,
        operstate: iface.operstate
      })),
      stats: networkStats.map(stat => ({
        iface: stat.iface,
        operstate: stat.operstate,
        rx_bytes: stat.rx_bytes,
        tx_bytes: stat.tx_bytes,
        rx_sec: stat.rx_sec,
        tx_sec: stat.tx_sec
      }))
    };
  } catch (error) {
    console.error("Error getting network info:", error);
    return { interfaces: [], stats: [] };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
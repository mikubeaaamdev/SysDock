console.log("SysDock renderer process started!");

// Global update interval
let updateInterval;

// Charts
let cpuChart = null;
let memoryChart = null;

// Historical data for charts (40 data points = ~3.5 minutes at 5-second intervals, reduced for performance)
const maxDataPoints = 40;
const chartData = {
  cpu: [],
  memory: [],
  timestamps: []
};

// DOM elements
const elements = {
  cpuLoad: document.getElementById('cpu-load'),
  cpuProgress: document.getElementById('cpu-progress'),
  cpuBrand: document.getElementById('cpu-brand'),
  cpuCores: document.getElementById('cpu-cores'),
  cpuSpeed: document.getElementById('cpu-speed'),
  
  memoryUsage: document.getElementById('memory-usage'),
  memoryProgress: document.getElementById('memory-progress'),
  memoryUsed: document.getElementById('memory-used'),
  memoryFree: document.getElementById('memory-free'),
  memoryTotal: document.getElementById('memory-total'),
  
  diskCount: document.getElementById('disk-count'),
  diskList: document.getElementById('disk-list'),
  
  networkStatus: document.getElementById('network-status'),
  networkInterfaces: document.getElementById('network-interfaces'),
  
  lastUpdated: document.getElementById('last-updated'),
  refreshBtn: document.getElementById('refresh-btn'),
  settingsBtn: document.getElementById('settings-btn')
};

// Utility functions
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 GB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getUsageClass(percentage) {
  if (percentage >= 80) return 'high';
  if (percentage >= 60) return 'medium';
  return 'low';
}

function getDiskUsageClass(percentage) {
  if (percentage >= 90) return 'critical';
  if (percentage >= 80) return 'high';
  if (percentage >= 60) return 'medium';
  return 'low';
}

function updateTimestamp() {
  const now = new Date();
  elements.lastUpdated.textContent = now.toLocaleTimeString();
}

// Theme Management
function getStoredTheme() {
  return localStorage.getItem('sysdock-theme');
}

function setStoredTheme(theme) {
  localStorage.setItem('sysdock-theme', theme);
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getCurrentTheme() {
  const stored = getStoredTheme();
  if (stored === 'auto' || !stored) {
    return getSystemTheme();
  }
  return stored;
}

function applyTheme(theme) {
  // Temporarily disable transitions
  document.body.classList.add('no-transition');
  
  let actualTheme = theme;
  if (theme === 'auto') {
    actualTheme = getSystemTheme();
  }
  
  // Apply theme
  document.documentElement.setAttribute('data-theme', actualTheme);
  
  // Re-enable transitions after a short delay
  setTimeout(() => {
    document.body.classList.remove('no-transition');
  }, 50);
  
  console.log(`Theme applied: ${theme} (actual: ${actualTheme})`);
}

// Initialize theme
function initializeTheme() {
  const storedTheme = getStoredTheme() || 'auto';
  applyTheme(storedTheme);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentStored = getStoredTheme() || 'auto';
    if (currentStored === 'auto') {
      applyTheme('auto');
    }
  });
  
  // Listen for theme changes from settings window
  if (window.electronAPI && window.electronAPI.onThemeChanged) {
    console.log('Setting up theme change listener');
    window.electronAPI.onThemeChanged((theme) => {
      console.log('Theme changed from settings:', theme);
      setStoredTheme(theme);
      applyTheme(theme);
    });
  } else {
    console.warn('electronAPI not available for theme changes');
  }
}

// Chart configuration similar to Task Manager
function getChartConfig(label, color) {
  return {
    type: 'line',
    data: {
      labels: Array(maxDataPoints).fill(''),
      datasets: [{
        label: label,
        data: Array(maxDataPoints).fill(0),
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          display: false,
          grid: {
            display: false
          }
        },
        y: {
          min: 0,
          max: 100,
          display: true,
          grid: {
            color: '#e1e4e8',
            lineWidth: 1
          },
          ticks: {
            font: {
              size: 10,
              family: 'Consolas, Monaco, monospace'
            },
            color: '#6a737d',
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      animation: {
        duration: 0
      },
      interaction: {
        intersect: false
      }
    }
  };
}

// Initialize charts
function initializeCharts() {
  const cpuCtx = document.getElementById('cpu-chart');
  const memoryCtx = document.getElementById('memory-chart');

  if (cpuCtx) {
    cpuChart = new Chart(cpuCtx, getChartConfig('CPU Usage', '#0366d6'));
  }

  if (memoryCtx) {
    memoryChart = new Chart(memoryCtx, getChartConfig('Memory Usage', '#28a745'));
  }

  console.log('Charts initialized');
}

// Update chart data
function updateChartData(chart, newValue) {
  if (!chart) return;
  
  const data = chart.data.datasets[0].data;
  data.shift(); // Remove oldest data point
  data.push(newValue); // Add new data point
  
  chart.update('none'); // Update without animation for better performance
}

// Update CPU information
async function updateCPUInfo() {
  try {
    const cpuInfo = await window.systemAPI.getCPUInfo();
    if (!cpuInfo) return;

    // Update CPU load
    const load = cpuInfo.currentLoad;
    elements.cpuLoad.textContent = `${load}%`;
    elements.cpuLoad.className = `cpu-load ${getUsageClass(load)}`;
    elements.cpuProgress.style.width = `${load}%`;
    
    // Apply color to progress bar based on usage
    elements.cpuProgress.className = `progress-fill ${getUsageClass(load)}`;

    // Update CPU details
    elements.cpuBrand.textContent = `${cpuInfo.manufacturer} ${cpuInfo.brand}`;
    elements.cpuCores.textContent = `${cpuInfo.cores} (${cpuInfo.physicalCores} physical)`;
    elements.cpuSpeed.textContent = `${cpuInfo.speed} GHz`;

    // Update chart
    updateChartData(cpuChart, load);

    // Store historical data
    chartData.cpu.push(load);
    if (chartData.cpu.length > maxDataPoints) {
      chartData.cpu.shift();
    }

  } catch (error) {
    console.error('Error updating CPU info:', error);
    elements.cpuLoad.textContent = 'Error';
  }
}

// Update Memory information
async function updateMemoryInfo() {
  try {
    const memInfo = await window.systemAPI.getMemoryInfo();
    if (!memInfo) return;

    // Update memory usage
    const usage = memInfo.usage;
    elements.memoryUsage.textContent = `${usage}%`;
    elements.memoryUsage.className = `memory-usage ${getUsageClass(usage)}`;
    elements.memoryProgress.style.width = `${usage}%`;
    
    // Apply color to progress bar based on usage
    elements.memoryProgress.className = `progress-fill ${getUsageClass(usage)}`;

    // Update memory details
    elements.memoryUsed.textContent = `${memInfo.used} GB`;
    elements.memoryFree.textContent = `${memInfo.free} GB`;
    elements.memoryTotal.textContent = `${memInfo.total} GB`;

    // Update chart
    updateChartData(memoryChart, usage);

    // Store historical data
    chartData.memory.push(usage);
    if (chartData.memory.length > maxDataPoints) {
      chartData.memory.shift();
    }

  } catch (error) {
    console.error('Error updating memory info:', error);
    elements.memoryUsage.textContent = 'Error';
  }
}

// Update Disk information
async function updateDiskInfo() {
  try {
    const diskInfo = await window.systemAPI.getDiskInfo();
    if (!diskInfo || !Array.isArray(diskInfo)) return;

    elements.diskCount.textContent = `${diskInfo.length} Drive${diskInfo.length !== 1 ? 's' : ''}`;
    
    // Clear existing disk items
    elements.diskList.innerHTML = '';

    diskInfo.forEach(disk => {
      const diskItem = document.createElement('div');
      diskItem.className = 'disk-item';

      const usage = disk.usage || 0;
      const usageClass = getDiskUsageClass(usage);
      
      diskItem.innerHTML = `
        <div class="disk-info">
          <span class="disk-name">${disk.fs || 'Unknown'}</span>
          <span class="disk-usage">${usage}% (${disk.used}/${disk.size} GB)</span>
        </div>
        <div class="disk-progress">
          <div class="disk-progress-fill ${usageClass}" style="width: ${usage}%"></div>
        </div>
      `;

      // Color code border based on usage
      const borderColors = {
        'low': '#0366d6',
        'medium': '#f9c74f', 
        'high': '#f94144',
        'critical': '#d90429'
      };
      diskItem.style.borderLeftColor = borderColors[usageClass];

      elements.diskList.appendChild(diskItem);
    });

  } catch (error) {
    console.error('Error updating disk info:', error);
    elements.diskCount.textContent = 'Error';
  }
}

// Update Network information
async function updateNetworkInfo() {
  try {
    const networkInfo = await window.systemAPI.getNetworkInfo();
    if (!networkInfo || !networkInfo.interfaces) return;

    const activeInterfaces = networkInfo.interfaces.filter(iface => 
      !iface.internal && iface.operstate === 'up'
    );

    elements.networkStatus.textContent = `${activeInterfaces.length} Active Interface${activeInterfaces.length !== 1 ? 's' : ''}`;
    
    // Clear existing network items
    elements.networkInterfaces.innerHTML = '';

    networkInfo.interfaces.forEach(iface => {
      if (iface.internal) return; // Skip internal interfaces

      const networkItem = document.createElement('div');
      networkItem.className = 'network-interface';

      const isUp = iface.operstate === 'up';
      const ip4 = iface.ip4 || 'N/A';
      const mac = iface.mac || 'N/A';

      networkItem.innerHTML = `
        <div class="interface-name">${iface.ifaceName || iface.iface}</div>
        <div class="interface-details">
          IP: ${ip4}<br>
          MAC: ${mac}
        </div>
        <span class="interface-status ${isUp ? 'status-up' : 'status-down'}">
          ${isUp ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      `;

      // Color code border based on status
      networkItem.style.borderLeftColor = isUp ? '#28a745' : '#d73a49';

      elements.networkInterfaces.appendChild(networkItem);
    });

  } catch (error) {
    console.error('Error updating network info:', error);
    elements.networkStatus.textContent = 'Error';
  }
}

// Update all system information
async function updateAllInfo() {
  console.log('Updating system information...');
  
  // Add loading state
  document.body.classList.add('loading');
  
  try {
    await Promise.all([
      updateCPUInfo(),
      updateMemoryInfo(),
      updateDiskInfo(),
      updateNetworkInfo()
    ]);
    
    updateTimestamp();
  } catch (error) {
    console.error('Error updating system info:', error);
  } finally {
    document.body.classList.remove('loading');
  }
}

// Start automatic updates
function startAutoUpdate(interval = 3000) {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(updateAllInfo, interval);
  console.log(`Auto-update started with ${interval}ms interval`);
}

// Stop automatic updates
function stopAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('Auto-update stopped');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing SysDock...');
  
  // Initialize theme first
  initializeTheme();
  
  // Initialize charts
  initializeCharts();
  
  // Initial update
  updateAllInfo();
  
  // Start auto-update
  startAutoUpdate(5000); // Update every 5 seconds (reduced from 3 for better performance)
  
  // Refresh button event
  elements.refreshBtn.addEventListener('click', () => {
    console.log('Manual refresh triggered');
    updateAllInfo();
  });
  
  // Settings button event
  elements.settingsBtn.addEventListener('click', async () => {
    console.log('Settings button clicked');
    try {
      if (window.systemAPI && window.systemAPI.openSettings) {
        await window.systemAPI.openSettings();
      } else {
        console.error('Settings API not available');
      }
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  });
  
  console.log('SysDock initialized successfully!');
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopAutoUpdate();
});

// Expose functions globally for debugging
window.sysDock = {
  updateAllInfo,
  startAutoUpdate,
  stopAutoUpdate,
  updateCPUInfo,
  updateMemoryInfo,
  updateDiskInfo,
  updateNetworkInfo,
  applyTheme,
  getCurrentTheme,
  charts: {
    cpu: cpuChart,
    memory: memoryChart
  },
  data: chartData
};
/* ===================================
   SETTINGS WINDOW JAVASCRIPT
   =================================== */

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initializeSettings();
  await loadAppInfo();
  setupEventListeners();
});

// Initialize all settings components
async function initializeSettings() {
  // Initialize theme selector
  const themeSelector = document.getElementById('theme-select');
  const currentTheme = localStorage.getItem('theme') || 'auto';
  if (themeSelector) {
    themeSelector.value = currentTheme;
  }
  
  // Apply current theme
  applyTheme(currentTheme);
}

// Load application information
async function loadAppInfo() {
  try {
    console.log('Loading app info...');
    const appInfo = await window.settingsAPI.getAppInfo();
    console.log('Received app info:', appInfo);
    
    // Update app information elements
    updateElement('appVersion', appInfo.version);
    updateElement('electronVersion', appInfo.electronVersion);
    updateElement('nodeVersion', appInfo.nodeVersion);
    updateElement('chromeVersion', appInfo.chromeVersion);
    updateElement('buildDate', formatDate(new Date()));
    
    // Update app name if available
    const appName = document.querySelector('.app-icon h3');
    if (appName) {
      appName.textContent = appInfo.name || 'SysDock';
    }
    
    console.log('App info updated successfully');
  } catch (error) {
    console.error('Error loading app info:', error);
    
    // Fallback values if API fails
    updateElement('appVersion', '1.0.0');
    updateElement('electronVersion', 'Unknown');
    updateElement('nodeVersion', 'Unknown');
    updateElement('chromeVersion', 'Unknown');
    updateElement('buildDate', formatDate(new Date()));
  }
}

// Helper function to safely update element content
function updateElement(id, content) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = content;
  } else {
    console.warn(`Element with id '${id}' not found`);
  }
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Setup all event listeners
function setupEventListeners() {
  // Theme selector change
  const themeSelector = document.getElementById('theme-select');
  if (themeSelector) {
    themeSelector.addEventListener('change', handleThemeChange);
  } else {
    console.error('Theme selector not found!');
  }
  
  // Close button
  const closeBtn = document.getElementById('close-settings');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettings);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  console.log('Event listeners setup complete');
}

// Handle theme changes
function handleThemeChange(event) {
  const selectedTheme = event.target.value;
  console.log('Theme changed to:', selectedTheme);
  
  // Save theme preference
  localStorage.setItem('theme', selectedTheme);
  console.log('Theme saved to localStorage:', localStorage.getItem('theme'));
  
  // Apply theme immediately to settings window
  applyTheme(selectedTheme);
  
  // Notify main process about theme change
  try {
    if (window.settingsAPI && window.settingsAPI.themeChanged) {
      console.log('Notifying main process of theme change');
      window.settingsAPI.themeChanged(selectedTheme);
    } else {
      console.error('Settings API not available');
    }
  } catch (error) {
    console.error('Error notifying theme change:', error);
  }
}

// Apply theme to the settings window
function applyTheme(theme) {
  const body = document.body;
  
  console.log('Applying theme to settings window:', theme);
  console.log('Body element:', body);
  
  if (theme === 'auto') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const actualTheme = prefersDark ? 'dark' : 'light';
    body.setAttribute('data-theme', actualTheme);
    console.log('Applied auto theme - actual theme:', actualTheme);
  } else {
    body.setAttribute('data-theme', theme);
    console.log('Applied theme directly:', theme);
  }
  
  console.log('Current data-theme attribute:', body.getAttribute('data-theme'));
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(event) {
  // Close on Escape key
  if (event.key === 'Escape') {
    closeSettings();
  }
  
  // Close on Ctrl+W or Cmd+W
  if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
    event.preventDefault();
    closeSettings();
  }
}

// Close settings window
async function closeSettings() {
  try {
    console.log('Closing settings window...');
    if (window.settingsAPI && window.settingsAPI.close) {
      await window.settingsAPI.close();
    } else {
      window.close();
    }
  } catch (error) {
    console.error('Error closing settings:', error);
    window.close();
  }
}

// Listen for system theme changes when in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const currentTheme = localStorage.getItem('theme') || 'auto';
  if (currentTheme === 'auto') {
    applyTheme('auto');
  }
});

// Export functions for debugging (development only)
if (process.env.NODE_ENV === 'development') {
  window.settingsDebug = {
    initializeSettings,
    loadAppInfo,
    applyTheme,
    closeSettings
  };
}
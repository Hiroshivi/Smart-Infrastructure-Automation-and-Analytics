// ==================== PROFESSIONAL IOT PLATFORM ====================
// Main JavaScript File
// ====================================================================

// ==================== USER DATABASE ====================
const USERS = {
  admin: { 
    password: 'admin123', 
    role: 'admin', 
    name: 'Admin User',
    permissions: ['view', 'control', 'manage', 'settings']
  },
  operator: { 
    password: 'oper123', 
    role: 'operator', 
    name: 'Operator User',
    permissions: ['view', 'control']
  },
  viewer: { 
    password: 'view123', 
    role: 'viewer', 
    name: 'Viewer User',
    permissions: ['view']
  }
};

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let mqttClient = null;
let isConnected = false;
let loginTime = null;

// Device Icons Map
const DEVICE_ICONS = {
  light: '💡',
  ac: '🌡️',
  door: '🔒',
  camera: '📹',
  sensor: '📊',
  fan: '🌀',
  tv: '📺'
};

// Device Storage with sample data
let devices = [
  { id: 'device-001', name: 'Living Room Light', type: 'light', location: 'Living Room', status: 'online', icon: '💡', lastSeen: Date.now() },
  { id: 'device-002', name: 'Bedroom AC', type: 'ac', location: 'Bedroom', status: 'online', icon: '🌡️', lastSeen: Date.now() },
  { id: 'device-003', name: 'Front Door Lock', type: 'door', location: 'Entrance', status: 'offline', icon: '🔒', lastSeen: Date.now() - 300000 },
  { id: 'device-004', name: 'Kitchen Light', type: 'light', location: 'Kitchen', status: 'online', icon: '💡', lastSeen: Date.now() },
  { id: 'device-005', name: 'Security Camera', type: 'camera', location: 'Front Door', status: 'online', icon: '📹', lastSeen: Date.now() },
  { id: 'device-006', name: 'Temperature Sensor', type: 'sensor', location: 'Living Room', status: 'online', icon: '📊', lastSeen: Date.now() }
];

// Activity Log Storage
let activityLog = [];
let commandsToday = 0;
let alertsCount = 0;

// Chart instances
let commandsChart, statusChart, activityChart, performanceChart;

// MQTT Configuration
let mqttConfig = {
  brokerUrl: 'ws://broker.hivemq.com:8000/mqtt',
  commandTopic: 'smarthome/commands',
  statusTopic: 'smarthome/status'
};

// ==================== INITIALIZATION ====================
window.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
  loadSavedData();
});

function setupEventListeners() {
  // Login form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', handleNavigation);
  });
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', handleFilter);
  });
  
  // Log filter buttons
  document.querySelectorAll('[data-log-filter]').forEach(btn => {
    btn.addEventListener('click', handleLogFilter);
  });
  
  // Control device select
  const controlDevice = document.getElementById('controlDevice');
  if (controlDevice) {
    controlDevice.addEventListener('change', updateCommandOptions);
  }
  
  // Control command select
  const controlCommand = document.getElementById('controlCommand');
  if (controlCommand) {
    controlCommand.addEventListener('change', showCommandParams);
  }
}

// ==================== AUTHENTICATION ====================
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (USERS[username] && USERS[username].password === password) {
    currentUser = {
      username: username,
      ...USERS[username]
    };
    
    loginTime = new Date();

    // Update UI
    document.getElementById('currentUser').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.toUpperCase();

    // Hide settings for non-admin users
    if (currentUser.role !== 'admin') {
      const settingsNav = document.getElementById('settingsNav');
      if (settingsNav) settingsNav.style.display = 'none';
    }

    // Switch to dashboard
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');

    addLog('success', `${currentUser.name} logged in successfully`, 'info');
    updateDashboard();
    initCharts();
    
    // Show welcome message
    setTimeout(() => {
      alert(`Welcome, ${currentUser.name}! 👋`);
    }, 500);
  } else {
    alert('❌ Invalid username or password');
  }
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    if (mqttClient && isConnected) {
      disconnectMQTT();
    }
    
    addLog('info', `${currentUser.name} logged out`, 'info');
    
    currentUser = null;
    loginTime = null;
    
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // Reset navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector('[data-page="overview"]').classList.add('active');
  }
}

// ==================== NAVIGATION ====================
function handleNavigation(e) {
  const page = this.dataset.page;
  
  // Check permissions
  if (page === 'control' && !currentUser.permissions.includes('control')) {
    alert('❌ You don\'t have permission to access device control');
    return;
  }
  
  if (page === 'settings' && !currentUser.permissions.includes('settings')) {
    alert('❌ You don\'t have permission to access settings');
    return;
  }

  // Update navigation
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  this.classList.add('active');

  // Show selected page
  document.querySelectorAll('.page-content').forEach(content => {
    content.classList.add('hidden');
  });
  document.getElementById(page + 'Page').classList.remove('hidden');

  // Page-specific actions
  if (page === 'analytics') {
    updateCharts();
  } else if (page === 'devices') {
    renderDevices();
  } else if (page === 'control') {
    populateDeviceSelect();
  } else if (page === 'settings') {
    populateSettings();
  } else if (page === 'logs') {
    renderFullLogs();
  }
}

function navigateToPage(pageName) {
  const navItem = document.querySelector(`[data-page="${pageName}"]`);
  if (navItem) {
    navItem.click();
  }
}

// ==================== DASHBOARD UPDATE ====================
function updateDashboard() {
  const total = devices.length;
  const online = devices.filter(d => d.status === 'online').length;

  document.getElementById('totalDevices').textContent = total;
  document.getElementById('onlineDevices').textContent = online;
  document.getElementById('commandsToday').textContent = commandsToday;
  document.getElementById('alertsCount').textContent = alertsCount;

  renderDevicesOverview();
  renderRecentActivity();
  updateStats();
}

function refreshDashboard() {
  updateDashboard();
  alert('✅ Dashboard refreshed!');
}

function renderDevicesOverview() {
  const container = document.getElementById('devicesOverview');
  container.innerHTML = '';

  // Show only first 6 devices
  const displayDevices = devices.slice(0, 6);

  displayDevices.forEach(device => {
    const card = createDeviceCard(device);
    container.appendChild(card);
  });
}

function createDeviceCard(device) {
  const card = document.createElement('div');
  card.className = 'device-card';
  card.onclick = () => showDeviceDetails(device);

  card.innerHTML = `
    <div class="device-header">
      <div class="device-icon">${device.icon}</div>
      <span class="device-status ${device.status}">${device.status}</span>
    </div>
    <div class="device-info">
      <div class="device-name">${device.name}</div>
      <div class="device-location">📍 ${device.location}</div>
      <div class="device-id">ID: ${device.id}</div>
    </div>
    <div class="device-controls" onclick="event.stopPropagation()">
      <button class="btn-control ${device.status === 'online' ? 'on' : 'off'}" 
              onclick="toggleDevice('${device.id}')">
        ${device.status === 'online' ? '🔴 Turn OFF' : '🟢 Turn ON'}
      </button>
      <button class="btn-control off" onclick="controlDevice('${device.id}')">
        ⚙️ Control
      </button>
    </div>
  `;

  return card;
}

function showDeviceDetails(device) {
  const details = `
    📱 Device: ${device.name}
    🆔 ID: ${device.id}
    📍 Location: ${device.location}
    🔌 Type: ${device.type}
    ⚡ Status: ${device.status}
    🕒 Last Seen: ${new Date(device.lastSeen).toLocaleString()}
  `;
  alert(details);
}

// ==================== DEVICE MANAGEMENT ====================
function renderDevices(filter = 'all') {
  const container = document.getElementById('devicesGrid');
  container.innerHTML = '';

  let filteredDevices = devices;

  if (filter === 'online') {
    filteredDevices = devices.filter(d => d.status === 'online');
  } else if (filter === 'offline') {
    filteredDevices = devices.filter(d => d.status === 'offline');
  } else if (filter !== 'all') {
    filteredDevices = devices.filter(d => d.type === filter);
  }

  if (filteredDevices.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #6b7280;">No devices found</p>';
    return;
  }

  filteredDevices.forEach(device => {
    const card = createDeviceCard(device);
    container.appendChild(card);
  });
}

function refreshDevices() {
  renderDevices();
  addLog('info', 'Device list refreshed', 'info');
  alert('✅ Devices refreshed!');
}

function handleFilter(e) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  this.classList.add('active');
  const filter = this.dataset.filter;
  renderDevices(filter);
}

function toggleDevice(deviceId) {
  if (!currentUser.permissions.includes('control')) {
    alert('❌ You don\'t have permission to control devices');
    return;
  }

  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const newStatus = device.status === 'online' ? 'offline' : 'online';
  device.status = newStatus;
  device.lastSeen = Date.now();

  addLog('success', `${device.name} turned ${newStatus}`, 'success');
  commandsToday++;
  
  updateDashboard();
  renderDevices();
  
  // Send MQTT command if connected
  if (isConnected) {
    sendDeviceCommand(device.id, newStatus === 'online' ? 'turn_on' : 'turn_off');
  }
}

function controlDevice(deviceId) {
  navigateToPage('control');
  setTimeout(() => {
    document.getElementById('controlDevice').value = deviceId;
    updateCommandOptions();
  }, 300);
}

// ==================== ADD DEVICE ====================
function openAddDeviceModal() {
  if (!currentUser.permissions.includes('manage')) {
    alert('❌ You don\'t have permission to add devices');
    return;
  }
  
  document.getElementById('newDeviceId').value = 'device-' + String(Date.now()).slice(-6);
  document.getElementById('addDeviceModal').classList.add('active');
}

function closeAddDeviceModal() {
  document.getElementById('addDeviceModal').classList.remove('active');
  clearAddDeviceForm();
}

function clearAddDeviceForm() {
  document.getElementById('newDeviceName').value = '';
  document.getElementById('newDeviceLocation').value = '';
  document.getElementById('newDeviceType').value = 'light';
  document.getElementById('newDeviceStatus').value = 'online';
}

function updateDeviceIcon() {
  const type = document.getElementById('newDeviceType').value;
  const icon = DEVICE_ICONS[type] || '🔌';
  return icon;
}

function addDevice() {
  const name = document.getElementById('newDeviceName').value.trim();
  const type = document.getElementById('newDeviceType').value;
  const location = document.getElementById('newDeviceLocation').value.trim();
  const deviceId = document.getElementById('newDeviceId').value.trim();
  const status = document.getElementById('newDeviceStatus').value;

  if (!name || !location || !deviceId) {
    alert('❌ Please fill all required fields');
    return;
  }

  // Check if device ID already exists
  if (devices.find(d => d.id === deviceId)) {
    alert('❌ Device ID already exists. Please use a unique ID.');
    return;
  }

  const newDevice = {
    id: deviceId,
    name: name,
    type: type,
    location: location,
    status: status,
    icon: DEVICE_ICONS[type] || '🔌',
    lastSeen: Date.now()
  };

  devices.push(newDevice);
  addLog('success', `New device added: ${name}`, 'success');
  
  closeAddDeviceModal();
  updateDashboard();
  renderDevices();
  
  alert(`✅ Device "${name}" added successfully!`);
}

// ==================== MQTT CONNECTION ====================
function connectMQTT() {
  const brokerUrl = document.getElementById('brokerUrl').value.trim();
  
  if (!brokerUrl) {
    alert('❌ Please enter a broker URL in settings');
    navigateToPage('settings');
    return;
  }

  if (!brokerUrl.startsWith('ws://') && !brokerUrl.startsWith('wss://')) {
    alert('❌ Broker URL must start with ws:// or wss://\n\nExample: ws://broker.hivemq.com:8000/mqtt');
    return;
  }

  console.log('🔌 Connecting to MQTT broker:', brokerUrl);
  addLog('info', 'Attempting to connect to MQTT broker...', 'info');

  try {
    const clientId = 'iot_platform_' + Math.random().toString(16).substr(2, 8);
    
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: clientId,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000
    });

    mqttClient.on('connect', function() {
      console.log('✅ Connected to MQTT broker');
      isConnected = true;
      updateConnectionUI(true);
      addLog('success', 'Connected to MQTT broker successfully!', 'success');

      // Subscribe to status topic
      const statusTopic = document.getElementById('statusTopic').value;
      mqttClient.subscribe(statusTopic, function(err) {
        if (!err) {
          console.log('📡 Subscribed to:', statusTopic);
          addLog('info', `Subscribed to topic: ${statusTopic}`, 'info');
        }
      });
    });

    mqttClient.on('message', function(topic, message) {
      console.log('📩 Received message on', topic);
      const msgStr = message.toString();
      addLog('info', `Received: ${msgStr}`, 'info');

      try {
        const jsonMsg = JSON.parse(msgStr);
        handleDeviceMessage(jsonMsg);
      } catch(e) {
        console.log('Non-JSON message:', msgStr);
      }
    });

    mqttClient.on('error', function(error) {
      console.error('❌ MQTT Error:', error);
      updateConnectionUI(false);
      addLog('error', 'Connection error: ' + error.message, 'error');
    });

    mqttClient.on('close', function() {
      console.log('⚠️ Disconnected from MQTT broker');
      isConnected = false;
      updateConnectionUI(false);
      addLog('warning', 'Disconnected from MQTT broker', 'warning');
    });

    mqttClient.on('reconnect', function() {
      console.log('🔄 Reconnecting...');
      addLog('info', 'Reconnecting to broker...', 'info');
    });

  } catch (error) {
    console.error('❌ Failed to connect:', error);
    alert('Failed to connect: ' + error.message);
    addLog('error', 'Failed to connect: ' + error.message, 'error');
  }
}

function disconnectMQTT() {
  if (mqttClient) {
    mqttClient.end();
    mqttClient = null;
    isConnected = false;
    updateConnectionUI(false);
    addLog('info', 'Disconnected from MQTT broker', 'info');
    console.log('Disconnected from MQTT broker');
  }
}

function updateConnectionUI(connected) {
  const statusIndicator = document.getElementById('statusIndicator');
  const connectionText = document.getElementById('connectionText');
  const brokerInfo = document.getElementById('brokerInfo');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const connectionBar = document.querySelector('.connection-bar');

  if (connected) {
    statusIndicator.className = 'status-indicator connected';
    connectionText.textContent = 'Connected to MQTT Broker';
    brokerInfo.textContent = document.getElementById('brokerUrl').value;
    connectBtn.classList.add('hidden');
    disconnectBtn.classList.remove('hidden');
    connectionBar.classList.add('connected');
  } else {
    statusIndicator.className = 'status-indicator disconnected';
    connectionText.textContent = 'Disconnected from MQTT Broker';
    brokerInfo.textContent = 'Not connected';
    connectBtn.classList.remove('hidden');
    disconnectBtn.classList.add('hidden');
    connectionBar.classList.remove('connected');
  }
}

function handleDeviceMessage(message) {
  // Update device status based on message
  if (message.deviceId) {
    const device = devices.find(d => d.id === message.deviceId);
    if (device) {
      device.status = message.status || 'online';
      device.lastSeen = Date.now();
      updateDashboard();
      renderDevices();
    }
  }
}

// ==================== DEVICE CONTROL ====================
function populateDeviceSelect() {
  const select = document.getElementById('controlDevice');
  select.innerHTML = '<option value="">Choose a device...</option>';

  devices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = `${device.icon} ${device.name} (${device.location})`;
    select.appendChild(option);
  });
}

function updateCommandOptions() {
  const deviceId = document.getElementById('controlDevice').value;
  const commandSelect = document.getElementById('controlCommand');
  
  if (!deviceId) {
    commandSelect.innerHTML = '<option value="">Choose a command...</option>';
    return;
  }

  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  // Populate commands based on device type
  commandSelect.innerHTML = '<option value="">Choose a command...</option>';
  
  if (device.type === 'light') {
    commandSelect.innerHTML += `
      <option value="turn_on">Turn ON</option>
      <option value="turn_off">Turn OFF</option>
      <option value="set_brightness">Set Brightness</option>
    `;
  } else if (device.type === 'ac') {
    commandSelect.innerHTML += `
      <option value="turn_on">Turn ON</option>
      <option value="turn_off">Turn OFF</option>
      <option value="set_temperature">Set Temperature</option>
    `;
  } else if (device.type === 'door') {
    commandSelect.innerHTML += `
      <option value="lock">Lock</option>
      <option value="unlock">Unlock</option>
    `;
  } else {
    commandSelect.innerHTML += `
      <option value="turn_on">Turn ON</option>
      <option value="turn_off">Turn OFF</option>
    `;
  }

  updateCommandPreview();
}

function showCommandParams() {
  const command = document.getElementById('controlCommand').value;
  const paramsDiv = document.getElementById('commandParams');
  
  paramsDiv.innerHTML = '';

  if (command === 'set_brightness') {
    paramsDiv.innerHTML = `
      <div class="form-group">
        <label>💡 Brightness Level (0-100)</label>
        <input type="range" id="brightness" min="0" max="100" value="50" 
               oninput="updateBrightnessValue(this.value); updateCommandPreview()">
        <span id="brightnessValue">50%</span>
      </div>
    `;
  } else if (command === 'set_temperature') {
    paramsDiv.innerHTML = `
      <div class="form-group">
        <label>🌡️ Temperature (°C)</label>
        <input type="number" id="temperature" min="16" max="30" value="24" 
               onchange="updateCommandPreview()" style="width: 100%; padding: 10px; border-radius: 6px; border: 2px solid var(--border);">
      </div>
    `;
  }

  updateCommandPreview();
}

function updateBrightnessValue(value) {
  document.getElementById('brightnessValue').textContent = value + '%';
}

function updateCommandPreview() {
  const deviceId = document.getElementById('controlDevice').value;
  const command = document.getElementById('controlCommand').value;
  const preview = document.getElementById('commandPreview');

  if (!deviceId || !command) {
    preview.textContent = 'Select a device and command to see preview';
    return;
  }

  const device = devices.find(d => d.id === deviceId);
  
  let params = {};
  if (command === 'set_brightness' && document.getElementById('brightness')) {
    params.brightness = parseInt(document.getElementById('brightness').value);
  } else if (command === 'set_temperature' && document.getElementById('temperature')) {
    params.temperature = parseInt(document.getElementById('temperature').value);
  }

  const message = {
    version: '1.0',
    type: 'command',
    command: command,
    params: params,
    metadata: {
      timestamp: new Date().toISOString(),
      deviceId: deviceId,
      requestId: 'req-' + Date.now(),
      priority: 'normal',
      ttl: 300
    }
  };

  preview.textContent = JSON.stringify(message, null, 2);
}

function sendCommand() {
  if (!currentUser.permissions.includes('control')) {
    alert('❌ You don\'t have permission to send commands');
    return;
  }

  const deviceId = document.getElementById('controlDevice').value;
  const command = document.getElementById('controlCommand').value;

  if (!deviceId || !command) {
    alert('❌ Please select a device and command');
    return;
  }

  if (!isConnected) {
    alert('❌ Not connected to MQTT broker. Please connect first.');
    return;
  }

  let params = {};
  if (command === 'set_brightness' && document.getElementById('brightness')) {
    params.brightness = parseInt(document.getElementById('brightness').value);
  } else if (command === 'set_temperature' && document.getElementById('temperature')) {
    params.temperature = parseInt(document.getElementById('temperature').value);
  }

  sendDeviceCommand(deviceId, command, params);
}

function sendDeviceCommand(deviceId, command, params = {}) {
  const message = {
    version: '1.0',
    type: 'command',
    command: command,
    params: params,
    metadata: {
      timestamp: new Date().toISOString(),
      deviceId: deviceId,
      requestId: 'req-' + Date.now(),
      priority: 'normal',
      ttl: 300
    }
  };

  const commandTopic = document.getElementById('commandTopic').value;
  const payload = JSON.stringify(message);

  mqttClient.publish(commandTopic, payload, { qos: 1 }, function(err) {
    if (err) {
      console.error('❌ Failed to send:', err);
      alert('Failed to send command: ' + err.message);
      addLog('error', `Failed to send command to ${deviceId}`, 'error');
    } else {
      console.log('✅ Command sent:', command);
      const device = devices.find(d => d.id === deviceId);
      addLog('success', `Command "${command}" sent to ${device ? device.name : deviceId}`, 'success');
      commandsToday++;
      updateDashboard();
      alert('✅ Command sent successfully!');
    }
  });
}

function clearControlForm() {
  document.getElementById('controlDevice').value = '';
  document.getElementById('controlCommand').value = '';
  document.getElementById('commandParams').innerHTML = '';
  document.getElementById('commandPreview').textContent = 'Select a device and command to see preview';
}

// ==================== ACTIVITY LOG ====================
function addLog(type, message, category = 'info') {
  const log = {
    type: type,
    category: category,
    message: message,
    timestamp: new Date(),
    user: currentUser ? currentUser.name : 'System'
  };

  activityLog.unshift(log);

  // Keep only last 100 logs
  if (activityLog.length > 100) {
    activityLog = activityLog.slice(0, 100);
  }

  renderRecentActivity();
  saveData();
}

function renderRecentActivity() {
  const container = document.getElementById('recentActivity');
  if (!container) return;

  container.innerHTML = '';

  const recentLogs = activityLog.slice(0, 10);

  if (recentLogs.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No recent activity</p>';
    return;
  }

  recentLogs.forEach(log => {
    const entry = createLogEntry(log);
    container.appendChild(entry);
  });
}

function renderFullLogs(filter = 'all') {
  const container = document.getElementById('fullActivityLog');
  if (!container) return;

  container.innerHTML = '';

  let filteredLogs = activityLog;
  if (filter !== 'all') {
    filteredLogs = activityLog.filter(log => log.category === filter);
  }

  if (filteredLogs.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No logs found</p>';
    return;
  }

  filteredLogs.forEach(log => {
    const entry = createLogEntry(log);
    container.appendChild(entry);
  });
}

function createLogEntry(log) {
  const entry = document.createElement('div');
  entry.className = `log-entry ${log.category}`;

  const timeStr = log.timestamp.toLocaleTimeString();
  const dateStr = log.timestamp.toLocaleDateString();

  entry.innerHTML = `
    <div class="log-time">${dateStr} ${timeStr}</div>
    <div>
      <span class="log-type">${log.category.toUpperCase()}</span>
      ${log.message}
      <br><small style="color: #9ca3af;">by ${log.user}</small>
    </div>
  `;

  return entry;
}

function handleLogFilter(e) {
  document.querySelectorAll('[data-log-filter]').forEach(btn => btn.classList.remove('active'));
  this.classList.add('active');
  const filter = this.dataset.logFilter;
  renderFullLogs(filter);
}

function exportLogs() {
  const dataStr = JSON.stringify(activityLog, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `activity-logs-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  alert('✅ Logs exported successfully!');
}

function clearLogs() {
  if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
    activityLog = [];
    renderRecentActivity();
    renderFullLogs();
    saveData();
    alert('✅ Logs cleared!');
  }
}

// ==================== CHARTS & ANALYTICS ====================
function initCharts() {
  createCommandsChart();
  createStatusChart();
  createActivityChart();
  createPerformanceChart();
}

function createCommandsChart() {
  const ctx = document.getElementById('commandsChart');
  if (!ctx) return;

  const last7Days = [];
  const commandCounts = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    commandCounts.push(Math.floor(Math.random() * 50) + 10);
  }

  commandsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7Days,
      datasets: [{
        label: 'Commands Sent',
        data: commandCounts,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 10
          }
        }
      }
    }
  });
}

function createStatusChart() {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Online', 'Offline'],
      datasets: [{
        data: [online, offline],
        backgroundColor: ['#10b981', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function createActivityChart() {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const hours = [];
  const activities = [];

  for (let i = 23; i >= 0; i--) {
    const hour = (new Date().getHours() - i + 24) % 24;
    hours.push(`${hour}:00`);
    activities.push(Math.floor(Math.random() * 20));
  }

  activityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.filter((_, i) => i % 4 === 0),
      datasets: [{
        label: 'Activity',
        data: activities.filter((_, i) => i % 4 === 0),
        backgroundColor: '#f59e0b',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function createPerformanceChart() {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) return;

  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['5m ago', '4m ago', '3m ago', '2m ago', '1m ago', 'Now'],
      datasets: [{
        label: 'Response Time (ms)',
        data: [120, 145, 110, 98, 105, 92],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + 'ms';
            }
          }
        }
      }
    }
  });
}

function updateCharts() {
  if (commandsChart) {
    commandsChart.data.datasets[0].data = commandsChart.data.datasets[0].data.map(() => 
      Math.floor(Math.random() * 50) + 10
    );
    commandsChart.update();
  }

  if (statusChart) {
    const online = devices.filter(d => d.status === 'online').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    statusChart.data.datasets[0].data = [online, offline];
    statusChart.update();
  }
}

function exportReport() {
  alert('📊 Exporting analytics report...\n\nThis feature exports charts and statistics to PDF.');
  addLog('info', 'Analytics report exported', 'info');
}

// ==================== SETTINGS ====================
function populateSettings() {
  document.getElementById('brokerUrl').value = mqttConfig.brokerUrl;
  document.getElementById('commandTopic').value = mqttConfig.commandTopic;
  document.getElementById('statusTopic').value = mqttConfig.statusTopic;

  if (currentUser) {
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileRole').textContent = currentUser.role.toUpperCase();
    document.getElementById('loginTime').textContent = loginTime ? loginTime.toLocaleString() : 'N/A';
  }
}

function saveSettings() {
  mqttConfig.brokerUrl = document.getElementById('brokerUrl').value.trim();
  mqttConfig.commandTopic = document.getElementById('commandTopic').value.trim();
  mqttConfig.statusTopic = document.getElementById('statusTopic').value.trim();

  saveData();
  addLog('success', 'Settings saved successfully', 'success');
  alert('✅ Settings saved successfully!');
}

function resetSettings() {
  if (confirm('Reset all settings to default values?')) {
    mqttConfig = {
      brokerUrl: 'ws://broker.hivemq.com:8000/mqtt',
      commandTopic: 'smarthome/commands',
      statusTopic: 'smarthome/status'
    };
    populateSettings();
    saveData();
    alert('✅ Settings reset to default!');
  }
}

function changeTheme() {
  const theme = document.getElementById('themeSelect').value;
  alert(`🎨 Theme changed to: ${theme}\n\nNote: Theme switching functionality can be implemented with CSS variables.`);
}

// ==================== DATA PERSISTENCE ====================
function saveData() {
  const data = {
    devices: devices,
    activityLog: activityLog,
    commandsToday: commandsToday,
    alertsCount: alertsCount,
    mqttConfig: mqttConfig
  };

  try {
    localStorage.setItem('iot_platform_data', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

function loadSavedData() {
  try {
    const savedData = localStorage.getItem('iot_platform_data');
    if (savedData) {
      const data = JSON.parse(savedData);
      devices = data.devices || devices;
      activityLog = data.activityLog || [];
      commandsToday = data.commandsToday || 0;
      alertsCount = data.alertsCount || 0;
      mqttConfig = data.mqttConfig || mqttConfig;
      
      // Convert log timestamps back to Date objects
      activityLog = activityLog.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    }
  } catch (e) {
    console.error('Failed to load saved data:', e);
  }
}

function updateStats() {
  // Simulate random alerts
  alertsCount = Math.floor(Math.random() * 5);
  
  // Update device last seen times
  devices.forEach(device => {
    if (device.status === 'online' && Math.random() > 0.95) {
      device.lastSeen = Date.now();
    }
  });
  
  saveData();
}

// Auto-save data every 30 seconds
setInterval(saveData, 30000);

// Auto-update stats every 10 seconds
setInterval(updateStats, 10000);

console.log('🚀 IoT Platform loaded successfully!');
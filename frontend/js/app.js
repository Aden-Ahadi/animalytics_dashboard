// Animalytics Dashboard - Main Application Logic

const API_BASE = 'http://localhost:5000/api';
let currentView = 'home';
let selectedCowId = null;
let updateInterval = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Animalytics Dashboard initialized');
    
    // Setup navigation
    setupNavigation();
    
    // Setup modal handlers
    setupModals();
    
    // Load initial data
    loadAllData();
    
    // Start auto-refresh (every 30 seconds)
    startAutoRefresh();
    
    // Setup event listeners
    setupEventListeners();
});

function setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const viewName = tab.dataset.view;
            switchView(viewName);
        });
    });
}

function switchView(viewName) {
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.view === viewName) {
            tab.classList.add('active');
        }
    });
    
    // Update active view
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');

    if (viewName !== 'map') {
        const detailPanel = document.getElementById('cow-detail-panel');
        if (detailPanel) {
            detailPanel.style.display = 'none';
        }
        if (window.setAnimalFocusMode) {
            window.setAnimalFocusMode(false);
        }
    }
    
    currentView = viewName;
    
    // Load view-specific data
    loadViewData(viewName);
}

function loadViewData(viewName) {
    switch(viewName) {
        case 'home':
            loadHomeData();
            break;
        case 'map':
            if (window.renderMap) window.renderMap();
            break;
        case 'analytics':
            if (window.loadAnalytics) window.loadAnalytics();
            break;
        case 'workers':
            loadWorkersData();
            break;
    }
}

async function loadAllData() {
    try {
        await Promise.all([
            loadHerdStatus(),
            loadCriticalAlerts(),
            loadEarlyWarnings()
        ]);
        
        updateLastUpdateTime();
        updateConnectionStatus(true);
    } catch (error) {
        console.error('Error loading data:', error);
        updateConnectionStatus(false);
    }
}

async function loadHerdStatus() {
    try {
        const response = await fetch(`${API_BASE}/herd-status`);
        const data = await response.json();
        
        document.getElementById('total-cattle').textContent = data.total || 247;
        document.getElementById('healthy-cattle').textContent = data.healthy || 0;
        document.getElementById('warning-cattle').textContent = data.warning || 0;
        document.getElementById('critical-cattle').textContent = data.critical || 0;
        
        const total = data.total || 247;
        document.getElementById('healthy-percent').textContent = 
            `${Math.round((data.healthy / total) * 100)}%`;
        document.getElementById('warning-percent').textContent = 
            `${Math.round((data.warning / total) * 100)}%`;
        document.getElementById('critical-percent').textContent = 
            `${Math.round((data.critical / total) * 100)}%`;
        
        // Update notification badge
        const totalAlerts = (data.critical || 0) + (data.warning || 0);
        document.getElementById('notification-count').textContent = totalAlerts;
        const badgeEl = document.getElementById('notification-badge');
        if (badgeEl) {
            badgeEl.setAttribute('aria-label', `${totalAlerts} alerts`);
            badgeEl.title = `${totalAlerts} Alerts`;
        }
    } catch (error) {
        console.error('Error loading herd status:', error);
    }
}

function formatDiseaseLabel(disease) {
    const labels = {
        East_Coast_Fever: 'East Coast Fever (ECF)',
        Trypanosomiasis: 'Trypanosomiasis (Nagana)',
        Foot_And_Mouth_Disease: 'Foot & Mouth Disease (FMD)',
        Mastitis: 'Mastitis',
        Lameness_Hoof_Disease: 'Lameness / Hoof Disease',
        Heat_Stress: 'Heat Stress'
    };
    return labels[disease] || (disease || 'Unknown Disease').replace(/_/g, ' ');
}

async function loadCriticalAlerts() {
    try {
        const response = await fetch(`${API_BASE}/critical-alerts`);
        const alerts = await response.json();
        
        const container = document.getElementById('critical-alerts-container');
        
        if (alerts.length === 0) {
            container.innerHTML = '<div class="empty-state">No critical alerts</div>';
            return;
        }
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert-card critical">
                <div class="alert-icon" style="background: #fee2e2; color: #dc2626;"><i class="fa-solid fa-siren-on"></i></div>
                <div class="alert-info">
                    <div class="alert-cow-id">${alert.cow_id}</div>
                    <div class="alert-disease">${formatDiseaseLabel(alert.disease)}</div>
                    <div class="alert-meta">
                        <span>Score: ${alert.health_score}/100</span>
                        <span>Duration: ${alert.duration_hours}h</span>
                        <span>Location: ${alert.location?.lat?.toFixed(4)}, ${alert.location?.lng?.toFixed(4)}</span>
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-danger btn-sm" onclick="viewCowOnMap('${alert.cow_id}')">
                        <i class="fa-solid fa-location-dot"></i> View on Map
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading critical alerts:', error);
    }
}

async function loadEarlyWarnings() {
    try {
        const response = await fetch(`${API_BASE}/early-warnings`);
        const warnings = await response.json();
        
        const container = document.getElementById('early-warnings-container');
        
        if (warnings.length === 0) {
            container.innerHTML = '<div class="empty-state">No early warnings</div>';
            return;
        }
        
        container.innerHTML = warnings.map(warning => `
            <div class="alert-card warning">
                <div class="alert-icon" style="background: #fef3c7; color: #d97706;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="alert-info">
                    <div class="alert-cow-id">${warning.cow_id}</div>
                    <div class="alert-disease">${formatDiseaseLabel(warning.disease || 'Monitoring Required')}</div>
                    <div class="alert-meta">
                        <span>Score: ${warning.health_score}/100</span>
                        <span>Duration: ${warning.duration_hours}h</span>
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewCowOnMap('${warning.cow_id}')">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading early warnings:', error);
    }
}

async function loadHomeData() {
    await loadHerdStatus();
    await loadCriticalAlerts();
    await loadEarlyWarnings();
}

async function loadWorkersData() {
    try {
        const response = await fetch(`${API_BASE}/map-data`);
        const data = await response.json();
        
        const workersGrid = document.getElementById('workers-grid');
        const workers = data.workers || [];
        
        if (workers.length === 0) {
            workersGrid.innerHTML = '<div class="empty-state">No workers available</div>';
            return;
        }
        
        workersGrid.innerHTML = workers.map(worker => `
            <div class="worker-card">
                <div class="worker-header">
                    <div class="worker-name">${worker.name}</div>
                    <span class="worker-status ${worker.status}">${worker.status}</span>
                </div>
                <div class="worker-info">
                    Location: ${worker.lat.toFixed(4)}, ${worker.lng.toFixed(4)}
                    ${worker.assigned_to ? `<br>Assigned to: ${worker.assigned_to}` : ''}
                </div>
                <button class="btn btn-primary" onclick="assignWorker('${worker.id}')">
                    ${worker.status === 'available' ? '<i class="fa-solid fa-user-plus"></i> Assign Task' : '<i class="fa-solid fa-clipboard-check"></i> View Task'}
                </button>
            </div>
        `).join('');
        
        // Load task queue
        loadTaskQueue();
    } catch (error) {
        console.error('Error loading workers:', error);
    }
}

async function loadTaskQueue() {
    try {
        const criticalResponse = await fetch(`${API_BASE}/critical-alerts`);
        const warningsResponse = await fetch(`${API_BASE}/early-warnings`);
        
        const critical = await criticalResponse.json();
        const warnings = await warningsResponse.json();
        
        const taskQueue = document.getElementById('task-queue');
        const tasks = [...critical, ...warnings];
        
        if (tasks.length === 0) {
            taskQueue.innerHTML = '<div class="empty-state">No pending tasks</div>';
            return;
        }
        
        taskQueue.innerHTML = tasks.map((task, index) => `
            <div class="task-item ${task.health_score < 50 ? 'urgent' : ''}">
                <div>
                    <strong>${index + 1}. ${task.cow_id}</strong> - 
                    ${task.disease} 
                    (${task.duration_hours}h)
                    ${task.health_score < 50 ? ' - URGENT' : ''}
                </div>
                <button class="btn btn-sm btn-primary" onclick="assignWorkerToTask('${task.cow_id}')">
                    <i class="fa-solid fa-paper-plane"></i> Assign
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading task queue:', error);
    }
}

function viewCowOnMap(cowId) {
    selectedCowId = cowId;
    switchView('map');
    setTimeout(() => {
        if (window.selectCow) {
            window.selectCow(cowId);
        }
    }, 100);
}

async function assignWorker(workerId) {
    const cowId = prompt('Enter Cow ID to assign:');
    if (!cowId) return;
    
    try {
        const response = await fetch(`${API_BASE}/assign-worker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ worker_id: workerId, cow_id: cowId })
        });
        
        const result = await response.json();
        alert(result.message);
        loadWorkersData();
    } catch (error) {
        alert('Error assigning worker: ' + error.message);
    }
}

async function assignWorkerToTask(cowId) {
    const workerId = prompt('Enter Worker ID (worker-1, worker-2, worker-3):');
    if (!workerId) return;
    
    try {
        const response = await fetch(`${API_BASE}/assign-worker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ worker_id: workerId, cow_id: cowId })
        });
        
        const result = await response.json();
        alert(result.message);
        loadWorkersData();
    } catch (error) {
        alert('Error assigning worker: ' + error.message);
    }
}

function setupModals() {
    const photoModal = document.getElementById('photo-modal');
    const closePhotoModal = document.getElementById('close-photo-modal');
    
    closePhotoModal.addEventListener('click', () => {
        photoModal.style.display = 'none';
    });
    
    photoModal.addEventListener('click', (e) => {
        if (e.target === photoModal) {
            photoModal.style.display = 'none';
        }
    });
}

function setupEventListeners() {
    // Close detail panel
    const closeDetail = document.getElementById('close-detail');
    if (closeDetail) {
        closeDetail.addEventListener('click', () => {
            document.getElementById('cow-detail-panel').style.display = 'none';
            if (window.setAnimalFocusMode) {
                window.setAnimalFocusMode(false);
            }
        });
    }
    
    // Upload photo button
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    if (uploadPhotoBtn) {
        uploadPhotoBtn.addEventListener('click', () => {
            document.getElementById('photo-modal').style.display = 'flex';
        });
    }
    
    // Mark treated button
    const markTreatedBtn = document.getElementById('mark-treated-btn');
    if (markTreatedBtn) {
        markTreatedBtn.addEventListener('click', async () => {
            if (!selectedCowId) return;
            
            if (confirm(`Mark ${selectedCowId} as treated?`)) {
                try {
                    const response = await fetch(`${API_BASE}/mark-treated`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cow_id: selectedCowId })
                    });
                    
                    const result = await response.json();
                    alert(result.message);
                    document.getElementById('cow-detail-panel').style.display = 'none';
                    if (window.setAnimalFocusMode) {
                        window.setAnimalFocusMode(false);
                    }
                    loadAllData();
                } catch (error) {
                    alert('Error marking as treated: ' + error.message);
                }
            }
        });
    }
}

function startAutoRefresh() {
    // Refresh every 30 seconds
    updateInterval = setInterval(() => {
        loadAllData();
        if (currentView === 'map' && window.renderMap) {
            window.renderMap();
        }
    }, 30000);
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    document.getElementById('last-update-time').textContent = timeString;
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    
    if (connected) {
        dot.style.background = '#059669';
        text.textContent = 'Connected';
    } else {
        dot.style.background = '#dc2626';
        text.textContent = 'Disconnected';
    }
}

// Export functions for use in other modules
window.API_BASE = API_BASE;
window.selectedCowId = null;
window.setSelectedCow = (id) => { window.selectedCowId = id; };

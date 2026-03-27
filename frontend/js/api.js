// Centralized API client

const API_BASE = 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}

const api = {
    getHerdStatus:     () => apiFetch('/herd-status'),
    getCriticalAlerts: () => apiFetch('/critical-alerts'),
    getEarlyWarnings:  () => apiFetch('/early-warnings'),
    getMapData:        () => apiFetch('/map-data'),
    getCow:            (id) => apiFetch(`/cow/${id}`),
    getAnalytics:      () => apiFetch('/analytics'),

    diagnosePhoto: (formData) => apiFetch('/diagnose-photo', {
        method: 'POST',
        body: formData
    }),

    geminiChat: (payload) => apiFetch('/gemini-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }),

    assignWorker: (workerId, cowId) => apiFetch('/assign-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId, cow_id: cowId })
    }),

    markTreated: (cowId) => apiFetch('/mark-treated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cow_id: cowId })
    })
};

window.api = api;
window.API_BASE = API_BASE;

// Realistic map visualization using Leaflet + OpenStreetMap

let map;
let cows = [];
let workers = [];
let cowLayer;
let workerLayer;
let ranchLayer;
const cowMarkersById = new Map();

const RANCH_POLYGON = [
    [-6.7957, 39.2048],
    [-6.7839, 39.2066],
    [-6.7818, 39.2162],
    [-6.7911, 39.2191],
    [-6.7978, 39.2140]
];
const DEFAULT_ZOOM = 17;

let ranchBounds;
let ranchCenter;
const ANIMAL_FOCUS_ZOOM = 18;

document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map-canvas');
    if (!mapContainer || typeof L === 'undefined') return;

    initializeMap();

    document.getElementById('map-filter')?.addEventListener('change', renderMap);
    document.getElementById('show-workers')?.addEventListener('change', renderMap);

    renderMap();
});

function initializeMap() {
    ranchBounds = L.latLngBounds(RANCH_POLYGON);
    ranchCenter = ranchBounds.getCenter();

    map = L.map('map-canvas', {
        zoomControl: true,
        attributionControl: true,
        minZoom: 16,
        maxZoom: 19,
        maxBounds: ranchBounds.pad(0.12),
        maxBoundsViscosity: 1.0
    }).setView([ranchCenter.lat, ranchCenter.lng], DEFAULT_ZOOM);

    ranchLayer = L.layerGroup().addTo(map);
    cowLayer = L.layerGroup().addTo(map);
    workerLayer = L.layerGroup().addTo(map);

    drawRanchBase();

    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('Animalytics Ranch Map (offline)');

    map.fitBounds(ranchBounds, { padding: [18, 18], maxZoom: DEFAULT_ZOOM });
}

function drawRanchBase() {
    ranchLayer.clearLayers();

    const ranchOutline = L.polygon(RANCH_POLYGON, {
        color: '#7b5b3a',
        weight: 2,
        opacity: 0.95,
        fillColor: '#c7b08a',
        fillOpacity: 0.66
    }).addTo(ranchLayer);

    const innerBounds = ranchBounds.pad(-0.16);
    const n = innerBounds.getNorth();
    const s = innerBounds.getSouth();
    const e = innerBounds.getEast();
    const w = innerBounds.getWest();

    const paddocks = [
        [[s, w], [s, (w + e) / 2], [(s + n) / 2, (w + e) / 2], [(s + n) / 2, w]],
        [[s, (w + e) / 2], [s, e], [(s + n) / 2, e], [(s + n) / 2, (w + e) / 2]],
        [[(s + n) / 2, w], [(s + n) / 2, (w + e) / 2], [n, (w + e) / 2], [n, w]],
        [[(s + n) / 2, (w + e) / 2], [(s + n) / 2, e], [n, e], [n, (w + e) / 2]]
    ];

    paddocks.forEach((points, index) => {
        L.polygon(points, {
            color: '#8b6a47',
            weight: 1,
            opacity: 0.8,
            fillColor: index % 2 === 0 ? '#b9a076' : '#cdb58e',
            fillOpacity: 0.36
        }).addTo(ranchLayer);
    });

    L.polyline(
        [
            [innerBounds.getSouth() + 0.0005, innerBounds.getWest() + 0.0005],
            [innerBounds.getCenter().lat, innerBounds.getCenter().lng],
            [innerBounds.getNorth() - 0.0004, innerBounds.getEast() - 0.0006]
        ],
        {
            color: '#efe2c8',
            weight: 3,
            opacity: 0.95
        }
    ).addTo(ranchLayer);

    L.circle([innerBounds.getCenter().lat - 0.0007, innerBounds.getCenter().lng + 0.0012], {
        radius: 42,
        color: '#2f6993',
        fillColor: '#5aa8d9',
        fillOpacity: 0.75,
        weight: 1
    }).addTo(ranchLayer);

    L.circleMarker([innerBounds.getCenter().lat + 0.0009, innerBounds.getCenter().lng - 0.0011], {
        radius: 6,
        color: '#6e4f31',
        fillColor: '#8b6740',
        fillOpacity: 1
    }).addTo(ranchLayer).bindTooltip('Barn', { direction: 'top', offset: [0, -8] });

    ranchOutline.bringToBack();
}

async function loadMapData() {
    try {
        const response = await fetch(`${window.API_BASE}/map-data`);
        const data = await response.json();
        cows = data.cows || [];
        workers = data.workers || [];
    } catch (error) {
        console.error('Error loading map data:', error);
    }
}

async function renderMap() {
    if (!map || !cowLayer || !workerLayer) return;

    await loadMapData();

    cowLayer.clearLayers();
    workerLayer.clearLayers();
    cowMarkersById.clear();

    const filter = document.getElementById('map-filter')?.value || 'all';
    const showWorkers = document.getElementById('show-workers')?.checked;

    const projected = projectIntoRanch(cows, workers);
    const projectedCows = projected.cows;
    const projectedWorkers = projected.workers;

    projectedCows.forEach(cow => {
        if (!isValidCoordinate(cow.lat, cow.lng)) return;
        if (filter !== 'all' && cow.status !== filter) return;

        const marker = L.marker([cow.lat, cow.lng], {
            icon: createCowIcon(cow.status)
        }).addTo(cowLayer);

        marker.bindTooltip(`${cow.cow_id} (${cow.status || 'unknown'})`, {
            direction: 'top',
            offset: [0, -12]
        });

        marker.on('click', () => {
            focusOnMarker(marker);
            showCowDetails(cow.cow_id);
        });

        cowMarkersById.set(cow.cow_id, marker);
    });

    if (showWorkers) {
        projectedWorkers.forEach(worker => {
            if (!isValidCoordinate(worker.lat, worker.lng)) return;

            const workerMarker = L.marker([worker.lat, worker.lng], {
                icon: createWorkerIcon()
            }).addTo(workerLayer);

            workerMarker.bindTooltip(`${worker.name} (${worker.status})`, {
                direction: 'top',
                offset: [0, -12]
            });

        });
    }

    map.fitBounds(ranchBounds, { padding: [16, 16], maxZoom: DEFAULT_ZOOM });

    // Map can render into hidden tab, so refresh dimensions once visible.
    setTimeout(() => map.invalidateSize(), 120);
}

function projectIntoRanch(cowData, workerData) {
    const allPoints = [...cowData, ...workerData].filter(point =>
        isValidCoordinate(point.lat, point.lng)
    );

    if (allPoints.length === 0) {
        return { cows: cowData, workers: workerData };
    }

    const latValues = allPoints.map(p => p.lat);
    const lngValues = allPoints.map(p => p.lng);

    const srcMinLat = Math.min(...latValues);
    const srcMaxLat = Math.max(...latValues);
    const srcMinLng = Math.min(...lngValues);
    const srcMaxLng = Math.max(...lngValues);

    const targetBounds = ranchBounds.pad(-0.2);
    const targetMinLat = targetBounds.getSouth();
    const targetMaxLat = targetBounds.getNorth();
    const targetMinLng = targetBounds.getWest();
    const targetMaxLng = targetBounds.getEast();

    const latSpan = Math.max(srcMaxLat - srcMinLat, 1e-9);
    const lngSpan = Math.max(srcMaxLng - srcMinLng, 1e-9);

    const projectPoint = (point) => {
        if (!isValidCoordinate(point.lat, point.lng)) return point;

        const latRatio = (point.lat - srcMinLat) / latSpan;
        const lngRatio = (point.lng - srcMinLng) / lngSpan;

        return {
            ...point,
            lat: targetMinLat + (latRatio * (targetMaxLat - targetMinLat)),
            lng: targetMinLng + (lngRatio * (targetMaxLng - targetMinLng))
        };
    };

    return {
        cows: cowData.map(projectPoint),
        workers: workerData.map(projectPoint)
    };
}

function createCowIcon(status) {
    const colors = {
        healthy: '#059669',
        warning: '#d97706',
        critical: '#dc2626'
    };

    const color = colors[status] || '#6b7280';

    return L.divIcon({
        className: 'map-cow-marker',
        html: `<span class="map-pin" style="background:${color}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });
}

function createWorkerIcon() {
    return L.divIcon({
        className: 'map-worker-marker',
        html: '<span class="map-worker-pin">W</span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function isValidCoordinate(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng);
}

async function showCowDetails(cowId) {
    try {
        const response = await fetch(`${window.API_BASE}/cow/${cowId}`);
        const cow = await response.json();
        
        document.getElementById('detail-cow-id').textContent = cow.cow_id;
        document.getElementById('detail-status').textContent = cow.status || 'Unknown';
        document.getElementById('detail-health-score').textContent = 
            `${cow.health_score || 0}/100`;
        document.getElementById('detail-disease').textContent = 
            cow.disease || 'No diagnosis';
        document.getElementById('detail-duration').textContent = 
            `${cow.duration_hours || 0} hours`;
        document.getElementById('detail-location').textContent = 
            `${cow.location?.lat?.toFixed(4)}, ${cow.location?.lng?.toFixed(4)}`;
        document.getElementById('detail-recommendation').textContent = 
            cow.recommendation || 'Monitor closely.';
        
        window.selectedCowId = cowId;
        setAnimalFocusMode(true);
        document.getElementById('cow-detail-panel').style.display = 'block';
    } catch (error) {
        console.error('Error loading cow details:', error);
    }
}

function focusOnMarker(marker) {
    if (!map || !marker) return;

    map.setView(marker.getLatLng(), Math.max(map.getZoom(), ANIMAL_FOCUS_ZOOM), { animate: true });
    // Shift map center left so the right-side detail card does not cover the selected animal.
    map.panBy([-130, 0], { animate: true });
}

function setAnimalFocusMode(enabled) {
    const mapView = document.getElementById('map-view');
    if (!mapView) return;

    mapView.classList.toggle('animal-focused', Boolean(enabled));
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 80);
}

function selectCow(cowId) {
    const marker = cowMarkersById.get(cowId);
    if (marker) {
        focusOnMarker(marker);
        marker.openTooltip();
    }

    showCowDetails(cowId);
}

window.renderMap = renderMap;
window.selectCow = selectCow;
window.setAnimalFocusMode = setAnimalFocusMode;

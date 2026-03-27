// Analytics and charts with Chart.js

let chartsInstance = {
    healthPie: null,
    diseaseBar: null,
    treatment: null
};

async function loadAnalytics() {
    try {
        const data = await api.getAnalytics();

        const savings = data.cost_savings || {};
        document.getElementById('early-treatments').textContent =
            `${savings.early_treatments || 0} cows`;
        document.getElementById('early-treatment-cost').textContent =
            `$${savings.early_treatment_cost || 0}`;
        document.getElementById('late-prevented').textContent =
            `${savings.early_treatments || 0} cows`;
        document.getElementById('late-treatment-saved').textContent =
            `$${(savings.late_treatment_cost - savings.early_treatment_cost) || 0} saved`;
        document.getElementById('deaths-prevented').textContent =
            `${savings.deaths_prevented || 0} cows`;
        document.getElementById('death-cost-saved').textContent =
            `$${savings.death_cost_saved || 0} saved`;
        document.getElementById('total-saved').textContent =
            `$${savings.total_saved || 0}`;

        const herdStatus = data.herd_status || {};
        document.getElementById('stat-healthy').textContent = herdStatus.healthy || 0;
        document.getElementById('stat-warning').textContent = herdStatus.warning || 0;
        document.getElementById('stat-critical').textContent = herdStatus.critical || 0;

        drawHealthPieChart(herdStatus);
        drawDiseaseBarChart(data.disease_distribution || {});
        drawTreatmentChart(savings);
        updateAlertHistory(data.alert_history || []);

    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function drawHealthPieChart(herdStatus) {
    const ctx = document.getElementById('health-pie-chart');
    if (!ctx) return;

    if (chartsInstance.healthPie) chartsInstance.healthPie.destroy();

    const healthy = herdStatus.healthy || 0;
    const warning = herdStatus.warning || 0;
    const critical = herdStatus.critical || 0;

    chartsInstance.healthPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Healthy', 'At Risk', 'Critical'],
            datasets: [{
                data: [healthy, warning, critical],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderColor: ['#059669', '#d97706', '#dc2626'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 12, weight: 500 },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.parsed;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function drawDiseaseBarChart(diseaseData) {
    const ctx = document.getElementById('disease-bar-chart');
    if (!ctx) return;

    if (chartsInstance.diseaseBar) chartsInstance.diseaseBar.destroy();

    const diseaseOrder = [
        'East_Coast_Fever',
        'Trypanosomiasis',
        'Foot_And_Mouth_Disease',
        'Mastitis',
        'Lameness_Hoof_Disease',
        'Heat_Stress'
    ];

    const counts = diseaseOrder.map(d => Number(diseaseData[d] || 0));
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

    chartsInstance.diseaseBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: diseaseOrder.map(d => window.formatDiseaseLabel(d)),
            datasets: [{
                label: 'Cases',
                data: counts,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 6,
                hoverBorderWidth: 2
            }]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Cases: ${context.parsed.y}`
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    borderRadius: 4,
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function drawTreatmentChart(savings) {
    const ctx = document.getElementById('treatment-chart');
    if (!ctx) return;

    if (chartsInstance.treatment) chartsInstance.treatment.destroy();

    const earlyTreatments = savings.early_treatments || 0;
    const preventedDeaths = savings.deaths_prevented || 0;
    const effectiveness = earlyTreatments > 0
        ? (preventedDeaths / earlyTreatments * 100).toFixed(1)
        : 0;

    chartsInstance.treatment = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Early Treatments', 'Deaths Prevented', 'Effectiveness %'],
            datasets: [{
                label: 'Count/Percentage',
                data: [earlyTreatments, preventedDeaths, effectiveness],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                borderColor: ['#1e40af', '#059669', '#d97706'],
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataIndex === 2) return `Effectiveness: ${context.parsed.y}%`;
                            if (context.dataIndex === 0) return `Early Treatments: ${context.parsed.y}`;
                            return `Deaths Prevented: ${context.parsed.y}`;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    borderRadius: 4
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 5 },
                    grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateAlertHistory(history) {
    const tbody = document.getElementById('alert-history-body');
    if (!tbody) return;

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No alert history</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(alert => `
        <tr>
            <td>${new Date(alert.timestamp).toLocaleDateString()}</td>
            <td><strong>${alert.cow_id}</strong></td>
            <td>${window.formatDiseaseLabel(alert.disease)}</td>
            <td><span class="badge ${alert.severity}">${alert.severity}</span></td>
            <td>${alert.status}</td>
        </tr>
    `).join('');
}

window.loadAnalytics = loadAnalytics;

// Application State
const state = {
    activeTab: 'overview',
    teamsList: [],
    overviewData: null,
    clusterData: null,
    
    // Raw Table Pagination & Filtering
    table: {
        data: [],
        filteredData: [],
        currentPage: 1,
        pageSize: 7,
        sortColumn: 'team',
        sortDirection: 'asc',
        searchQuery: ''
    },
    
    // Simulation
    simMode: 'Generic (All Teams)',
    simTeam: '',
    
    // Charts instances
    charts: {
        overviewDist: null,
        teamRadar: null,
        simRadar: null
    }
};

// Playstyle Metadata definitions
const playstyleMeta = {
    'Tiki-Taka': {
        class: 'tiki-taka',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
        desc: 'Extremely high pass counts, short passing sequences, and patient build-up play. Designed to monopolize possession and disorganize defensive blocks.'
    },
    'Possessional Play': {
        class: 'possessional',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
        desc: 'Structured positioning, utilizing wide areas, and progressive circulation. Focuses on spatial dominance and positional superiorities to find passing lanes.'
    },
    'Vertical': {
        class: 'vertical',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        desc: 'Direct, high-tempo transitions seeking to exploit space behind the opposition line quickly. Emphasizes forward-thinking passes and rapid vertical movement.'
    },
    'Haramball': {
        class: 'haramball',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>`,
        desc: 'Low-block defensive rigidity combined with physical duels and high PPDA. Prioritizes defensive compactness, grit, and clinical counter-attacks.'
    }
};

// Map playstyle display name to metadata keys
const playstyleMap = (val) => {
    if (!val) return 'Tiki-Taka';
    if (val.toLowerCase().includes('tiki')) return 'Tiki-Taka';
    if (val.toLowerCase().includes('possess')) return 'Possessional Play';
    if (val.toLowerCase().includes('vertical')) return 'Vertical';
    return 'Haramball';
};

// Initialize Application on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSliders();
    fetchOverviewData();
    fetchTeamsList();
    initSimulation();
});

// Count-up numbers animation helper
function animateCountUp(element, endVal, duration = 1000) {
    if (!element) return;
    let startVal = 0;
    let startTime = null;
    
    // Check if endVal contains decimals or is integer
    const hasDecimals = endVal % 1 !== 0;
    
    function step(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const currentVal = startVal + progress * (endVal - startVal);
        
        element.textContent = hasDecimals 
            ? currentVal.toFixed(2) 
            : Math.floor(currentVal).toLocaleString();
            
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }
    window.requestAnimationFrame(step);
}

// ----------------------------------------------------
// NAVIGATION SYSTEM
// ----------------------------------------------------
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            
            // Toggle sidebar active item
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle visible content views
            document.querySelectorAll('.tab-view').forEach(view => {
                view.classList.remove('active');
            });
            
            const targetView = document.getElementById(tabId);
            if (targetView) {
                targetView.classList.add('active');
                state.activeTab = tabId;
                
                // Lazy-initialize charts/data on view entry
                onTabEnter(tabId);
            }
        });
    });
}

function onTabEnter(tabId) {
    if (tabId === 'clusters' && !state.clusterData) {
        fetchClusterData();
    }
}

// ----------------------------------------------------
// SLIDERS SYSTEM
// ----------------------------------------------------
function initSliders() {
    const inputs = [
        { id: 'slider-passes', badgeId: 'val-passes', suffix: '' },
        { id: 'slider-shots', badgeId: 'val-shots', suffix: '' },
        { id: 'slider-pass-len', badgeId: 'val-pass-len', suffix: 'm' },
        { id: 'slider-carries', badgeId: 'val-carries', suffix: '' },
        { id: 'slider-ppda', badgeId: 'val-ppda', suffix: '' },
        { id: 'slider-xg', badgeId: 'val-xg', suffix: '' },
        { id: 'slider-deep', badgeId: 'val-deep', suffix: '' },
        { id: 'slider-mid', badgeId: 'val-mid', suffix: '' },
        { id: 'slider-final', badgeId: 'val-final', suffix: '' }
    ];
    
    inputs.forEach(input => {
        const slider = document.getElementById(input.id);
        const badge = document.getElementById(input.badgeId);
        
        if (slider && badge) {
            // Live slider label update
            slider.addEventListener('input', () => {
                const val = parseFloat(slider.value);
                badge.textContent = input.suffix ? `${val}${input.suffix}` : val.toFixed(slider.step % 1 === 0 ? 0 : 2);
            });
        }
    });
    
    // Bind Predictor form trigger
    const predictBtn = document.getElementById('predict-btn');
    if (predictBtn) {
        predictBtn.addEventListener('click', runPrediction);
    }
}

// ----------------------------------------------------
// DATA REQUESTS: OVERVIEW
// ----------------------------------------------------
async function fetchOverviewData() {
    try {
        const response = await fetch('/api/overview');
        const data = await response.json();
        state.overviewData = data;
        
        // Render Summary stats with animation
        animateCountUp(document.getElementById('metric-teams'), data.team_count);
        animateCountUp(document.getElementById('metric-passes'), data.avg_passes);
        animateCountUp(document.getElementById('metric-ppda'), data.avg_ppda);
        
        // Render Playstyle Distribution chart
        renderOverviewDistribution(data.playstyle_counts);
        
        // Load table data
        state.table.data = data.teams_data;
        applyTableFilters();
        initTableEvents();
    } catch (err) {
        console.error("Error fetching overview metrics:", err);
    }
}

function renderOverviewDistribution(counts) {
    const ctx = document.getElementById('playstyle-distribution-chart').getContext('2d');
    
    // Map nice gradient color variables
    const labels = Object.keys(counts);
    const dataset = Object.values(counts);
    
    const colors = [
        'rgba(6, 182, 212, 0.65)',  // Cyan (Possessional Play)
        'rgba(249, 115, 22, 0.65)',  // Orange (Vertical)
        'rgba(234, 179, 8, 0.65)',   // Yellow (Haramball)
        'rgba(16, 185, 129, 0.65)'   // Emerald (Tiki-Taka)
    ];
    
    const borders = [
        '#06b6d4', '#f97316', '#eab308', '#10b981'
    ];
    
    if (state.charts.overviewDist) {
        state.charts.overviewDist.destroy();
    }
    
    state.charts.overviewDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dataset,
                backgroundColor: colors,
                borderColor: borders,
                borderWidth: 1.5,
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
                    bodyFont: { family: 'Inter', size: 13 },
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', weight: 500 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { family: 'Inter' } }
                }
            }
        }
    });
}

// ----------------------------------------------------
// DATA TABLE LOGIC (Raw dataset explorer)
// ----------------------------------------------------
function initTableEvents() {
    // Search input bound
    const search = document.getElementById('table-search');
    search.addEventListener('input', (e) => {
        state.table.searchQuery = e.target.value.toLowerCase();
        state.table.currentPage = 1;
        applyTableFilters();
    });
    
    // Sort column headers bound
    const headers = document.querySelectorAll('#raw-data-table th');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            if (state.table.sortColumn === column) {
                state.table.sortDirection = state.table.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.table.sortColumn = column;
                state.table.sortDirection = 'asc';
            }
            
            // Adjust class indicators
            headers.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            header.classList.add(state.table.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            
            sortAndRenderTable();
        });
    });
    
    // Pagination buttons bound
    document.getElementById('prev-page').addEventListener('click', () => {
        if (state.table.currentPage > 1) {
            state.table.currentPage--;
            renderTableRows();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        const maxPages = Math.ceil(state.table.filteredData.length / state.table.pageSize);
        if (state.table.currentPage < maxPages) {
            state.table.currentPage++;
            renderTableRows();
        }
    });
}

function applyTableFilters() {
    const query = state.table.searchQuery;
    
    state.table.filteredData = state.table.data.filter(row => {
        const teamMatch = row.team.toLowerCase().includes(query);
        const styleMatch = row.playstyle.toLowerCase().includes(query);
        return teamMatch || styleMatch;
    });
    
    sortAndRenderTable();
}

function sortAndRenderTable() {
    const col = state.table.sortColumn;
    const dir = state.table.sortDirection === 'asc' ? 1 : -1;
    
    state.table.filteredData.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        if (typeof valA === 'string') {
            return valA.localeCompare(valB) * dir;
        } else {
            return (valA - valB) * dir;
        }
    });
    
    renderTableRows();
}

function renderTableRows() {
    const tbody = document.querySelector('#raw-data-table tbody');
    tbody.innerHTML = '';
    
    const totalItems = state.table.filteredData.length;
    const pageSize = state.table.pageSize;
    const maxPages = Math.max(1, Math.ceil(totalItems / pageSize));
    
    // Keep page in bound bounds
    if (state.table.currentPage > maxPages) {
        state.table.currentPage = maxPages;
    }
    
    const startIdx = (state.table.currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalItems);
    
    // Toggle prev/next button states
    document.getElementById('prev-page').disabled = state.table.currentPage === 1;
    document.getElementById('next-page').disabled = state.table.currentPage === maxPages;
    
    document.getElementById('page-indicator').textContent = `Page ${state.table.currentPage} of ${maxPages}`;
    
    if (totalItems === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No matching tactical teams found.</td></tr>`;
        return;
    }
    
    const slice = state.table.filteredData.slice(startIdx, endIdx);
    slice.forEach(row => {
        const styleMeta = playstyleMeta[playstyleMap(row.playstyle)];
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td style="font-weight: 600;">${row.team}</td>
            <td><span class="playstyle-badge ${styleMeta.class}">${row.playstyle}</span></td>
            <td>${Math.round(row.passes)}</td>
            <td>${Math.round(row.shots)}</td>
            <td>${row.average_pass_length.toFixed(1)}m</td>
            <td>${row.xg_per_shot.toFixed(3)}</td>
            <td>${row.ppda.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// DATA REQUESTS: TEAM PROFILE DRILL DOWN
// ----------------------------------------------------
async function fetchTeamsList() {
    try {
        const response = await fetch('/api/teams');
        const list = await response.json();
        state.teamsList = list;
        
        // Populate Select elements
        populateTeamSelector('team-selector', list);
        populateTeamSelector('sim-team-selector', list);
        
        // Hook analysis dropdown listener
        const selector = document.getElementById('team-selector');
        selector.addEventListener('change', (e) => {
            fetchTeamDetails(e.target.value);
        });
    } catch (err) {
        console.error("Error loading teams list:", err);
    }
}

function populateTeamSelector(elementId, teams) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    select.innerHTML = `<option value="" disabled selected>-- Select a Team --</option>`;
    teams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team;
        opt.textContent = team;
        select.appendChild(opt);
    });
}

async function fetchTeamDetails(teamName) {
    if (!teamName) return;
    
    try {
        const response = await fetch(`/api/team/${encodeURIComponent(teamName)}`);
        const data = await response.json();
        
        // Render detailed key stats cards
        const container = document.getElementById('team-stats-container');
        const meta = playstyleMeta[playstyleMap(data.playstyle)];
        
        container.innerHTML = `
            <div class="glass-card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; border-color: var(--border-active);">
                <span style="font-weight: 500; font-size: 0.9rem;">Model Classification</span>
                <span class="playstyle-badge ${meta.class}">${data.playstyle}</span>
            </div>
            
            <div class="glass-card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: var(--text-secondary); font-size: 0.85rem;">Passes</span>
                <span style="font-family: 'Outfit'; font-weight: 700; font-size: 1.2rem;">${data.stats.passes}</span>
            </div>
            
            <div class="glass-card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: var(--text-secondary); font-size: 0.85rem;">Shots</span>
                <span style="font-family: 'Outfit'; font-weight: 700; font-size: 1.2rem;">${data.stats.shots}</span>
            </div>
            
            <div class="glass-card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: var(--text-secondary); font-size: 0.85rem;">PPDA</span>
                <span style="font-family: 'Outfit'; font-weight: 700; font-size: 1.2rem;">${data.stats.ppda.toFixed(2)}</span>
            </div>
            
            <div class="glass-card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: var(--text-secondary); font-size: 0.85rem;">Avg Pass Length</span>
                <span style="font-family: 'Outfit'; font-weight: 700; font-size: 1.2rem;">${data.stats.average_pass_length.toFixed(1)}m</span>
            </div>
            
            <div class="glass-card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: var(--text-secondary); font-size: 0.85rem;">xG per Shot</span>
                <span style="font-family: 'Outfit'; font-weight: 700; font-size: 1.2rem;">${data.stats.xg_per_shot.toFixed(3)}</span>
            </div>
        `;
        
        // Render radar chart comparison
        renderRadarChart(teamName, data.radar_data);
    } catch (err) {
        console.error("Error loading team metrics:", err);
    }
}

function renderRadarChart(teamName, radarValues) {
    const ctx = document.getElementById('team-radar-chart').getContext('2d');
    const features = ["Passes", "Shots", "Avg Pass Length", "xG/Shot", "PPDA"];
    
    if (state.charts.teamRadar) {
        state.charts.teamRadar.destroy();
    }
    
    state.charts.teamRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: features,
            datasets: [{
                label: `${teamName} (Normalized)`,
                data: radarValues,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: '#6366f1',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#6366f1',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#f8fafc', font: { family: 'Outfit', size: 13 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Outfit', size: 12, weight: 'bold' },
                    bodyFont: { family: 'Inter', size: 12 },
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 11, weight: 'bold' } },
                    ticks: { display: false },
                    min: 0,
                    max: 1
                }
            }
        }
    });
}

// ----------------------------------------------------
// PLAYSTYLE PREDICTION SYSTEM
// ----------------------------------------------------
async function runPrediction() {
    const loader = document.getElementById('prediction-loader');
    const resultBox = document.getElementById('prediction-result-container');
    
    // Gather values
    const passes = parseFloat(document.getElementById('slider-passes').value);
    const shots = parseFloat(document.getElementById('slider-shots').value);
    const average_pass_length = parseFloat(document.getElementById('slider-pass-len').value);
    const carries = parseFloat(document.getElementById('slider-carries').value);
    const ppda = parseFloat(document.getElementById('slider-ppda').value);
    const xg_per_shot = parseFloat(document.getElementById('slider-xg').value);
    const avg_pass_angle_deep = parseFloat(document.getElementById('slider-deep').value);
    const avg_pass_angle_mid = parseFloat(document.getElementById('slider-mid').value);
    const avg_pass_angle_final = parseFloat(document.getElementById('slider-final').value);
    
    loader.style.display = 'flex';
    
    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                passes, shots, average_pass_length, carries, ppda, xg_per_shot,
                avg_pass_angle_deep, avg_pass_angle_mid, avg_pass_angle_final
            })
        });
        
        const data = await response.json();
        const predictedPlaystyle = data.playstyle;
        const meta = playstyleMeta[playstyleMap(predictedPlaystyle)];
        
        // Show result details with delayed reveal animation
        setTimeout(() => {
            loader.style.display = 'none';
            resultBox.innerHTML = `
                <div class="result-card-reveal">
                    <div class="playstyle-glow-box ${meta.class}">
                        ${meta.icon}
                    </div>
                    <div class="result-header">Classification Model Result</div>
                    <div class="result-title">${predictedPlaystyle}</div>
                    <p class="result-desc">${meta.desc}</p>
                </div>
            `;
        }, 600);
        
    } catch (err) {
        loader.style.display = 'none';
        resultBox.innerHTML = `
            <div style="color: #ef4444; text-align:center;">
                <p>Failed to request playstyle prediction.</p>
                <small>${err.message}</small>
            </div>
        `;
    }
}

// ----------------------------------------------------
// KDE SIMULATION SYSTEM
// ----------------------------------------------------
function initSimulation() {
    // Mode toggling
    const pills = document.querySelectorAll('.pill-option');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            const mode = pill.getAttribute('data-mode');
            state.simMode = mode;
            
            // Show/hide specific team group option
            const group = document.getElementById('sim-team-group');
            group.style.display = mode === 'Specific Team' ? 'block' : 'none';
        });
    });
    
    document.getElementById('simulate-btn').addEventListener('click', runSimulation);
}

async function runSimulation() {
    const loader = document.getElementById('simulation-loader');
    const container = document.getElementById('sim-output-container');
    
    const team_name = state.simMode === 'Specific Team' 
        ? document.getElementById('sim-team-selector').value 
        : null;
        
    if (state.simMode === 'Specific Team' && !team_name) {
        alert("Please choose a team to simulate.");
        return;
    }
    
    loader.style.display = 'flex';
    
    try {
        const response = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sim_mode: state.simMode,
                team_name: team_name
            })
        });
        
        const data = await response.json();
        
        setTimeout(() => {
            loader.style.display = 'none';
            renderSimulationOutput(data);
        }, 800);
        
    } catch (err) {
        loader.style.display = 'none';
        container.innerHTML = `
            <div style="color: #ef4444; padding: 2rem; text-align: center;">
                <p>Simulation error encountered.</p>
                <small>${err.message}</small>
            </div>
        `;
    }
}

function renderSimulationOutput(data) {
    const container = document.getElementById('sim-output-container');
    const meta = playstyleMeta[playstyleMap(data.predicted_playstyle)];
    
    // Compute comparison deltas
    const s = data.simulated_stats;
    const b = data.baseline_stats;
    
    // Delta rendering template generator
    const getDeltaHTML = (simVal, baseVal, type = 'normal') => {
        let diff = simVal - baseVal;
        let isPositive = diff > 0;
        
        // Reverse polarity indicators for defensive metrics like PPDA
        // lower PPDA means stronger pressing activity (positive)
        if (type === 'inverse') {
            isPositive = !isPositive;
        }
        
        const sign = diff > 0 ? '+' : '';
        const badgeClass = isPositive ? 'pos' : 'neg';
        const arrow = isPositive ? '▲' : '▼';
        
        return `<span class="comp-badge ${badgeClass}">${arrow} ${sign}${diff.toFixed(2)}</span>`;
    };
    
    container.innerHTML = `
        <!-- Display Header playstyle -->
        <div class="glass-card" style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; border-color: var(--border-active);">
            <div class="playstyle-glow-box ${meta.class}" style="margin: 0; width: 60px; height: 60px;">
                ${meta.icon}
            </div>
            <div>
                <span class="playstyle-badge ${meta.class}">${data.predicted_playstyle}</span>
                <h4 style="margin-top: 0.25rem; font-family: Outfit; font-size: 1.15rem;">Simulated Match Prediction</h4>
            </div>
        </div>
        
        <h4 style="font-family: Outfit; font-size: 1.1rem; margin-bottom: 1rem;">Simulated Metrics comparison</h4>
        
        <div class="comparison-grid">
            <div class="comparison-card">
                <div class="comp-label">Passes</div>
                <div class="comp-val">${s.passes}</div>
                ${getDeltaHTML(s.passes, b.passes)}
            </div>
            
            <div class="comparison-card">
                <div class="comp-label">Shots</div>
                <div class="comp-val">${s.shots}</div>
                ${getDeltaHTML(s.shots, b.shots)}
            </div>
            
            <div class="comparison-card">
                <div class="comp-label">PPDA</div>
                <div class="comp-val">${s.ppda.toFixed(2)}</div>
                ${getDeltaHTML(s.ppda, b.ppda, 'inverse')}
            </div>
            
            <div class="comparison-card">
                <div class="comp-label">Avg Pass Length</div>
                <div class="comp-val">${s.average_pass_length.toFixed(1)}m</div>
                ${getDeltaHTML(s.average_pass_length, b.average_pass_length)}
            </div>
            
            <div class="comparison-card">
                <div class="comp-label">xG per Shot</div>
                <div class="comp-val">${s.xg_per_shot.toFixed(3)}</div>
                ${getDeltaHTML(s.xg_per_shot, b.xg_per_shot)}
            </div>
            
            <div class="comparison-card">
                <div class="comp-label">Carries per Pass</div>
                <div class="comp-val">${s.carries_per_pass.toFixed(3)}</div>
                ${getDeltaHTML(s.carries_per_pass, b.carries_per_pass)}
            </div>
        </div>
        
        <div style="height: 340px; margin-top: 2rem;">
            <canvas id="sim-radar-chart"></canvas>
        </div>
    `;
    
    // Render Simulation Radar
    renderSimRadarChart(data.scaled_base_radar, data.scaled_sim_radar);
}

function renderSimRadarChart(baselineRadar, simulatedRadar) {
    const ctx = document.getElementById('sim-radar-chart').getContext('2d');
    const features = ["Passes", "Shots", "Avg Pass Length", "xG/Shot", "PPDA"];
    
    if (state.charts.simRadar) {
        state.charts.simRadar.destroy();
    }
    
    state.charts.simRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: features,
            datasets: [
                {
                    label: 'Baseline Average',
                    data: baselineRadar,
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0
                },
                {
                    label: 'Simulated Performance',
                    data: simulatedRadar,
                    backgroundColor: 'rgba(249, 115, 22, 0.25)',
                    borderColor: '#f97316',
                    borderWidth: 2,
                    pointBackgroundColor: '#f97316',
                    pointBorderColor: '#ffffff',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#f8fafc', font: { family: 'Outfit', size: 12 } }
                }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 10, weight: 'bold' } },
                    ticks: { display: false },
                    min: 0,
                    max: 1
                }
            }
        }
    });
}

// ----------------------------------------------------
// PCA CLUSTERS PLOTS (Plotly)
// ----------------------------------------------------
async function fetchClusterData() {
    try {
        const response = await fetch('/api/clusters');
        const points = await response.json();
        state.clusterData = points;
        
        render2DClusterPlot(points);
        render3DClusterPlot(points);
    } catch (err) {
        console.error("Error drawing cluster models:", err);
    }
}

function getClusterPlotlyColors() {
    return {
        'Tiki-Taka': '#10b981',
        'Possessional Play': '#06b6d4',
        'Vertical': '#f97316',
        'Haramball': '#eab308'
    };
}

function render2DClusterPlot(points) {
    const playstyles = [...new Set(points.map(p => p.playstyle))];
    const colors = getClusterPlotlyColors();
    
    const traces = playstyles.map(style => {
        const subset = points.filter(p => p.playstyle === style);
        return {
            x: subset.map(p => p.pc1_2d),
            y: subset.map(p => p.pc2_2d),
            text: subset.map(p => p.team),
            name: style,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 9,
                color: colors[playstyleMap(style)],
                line: { color: 'rgba(0,0,0,0.2)', width: 1 }
            },
            hovertemplate: '<b>%{text}</b><br>Playstyle: ' + style + '<br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>'
        };
    });
    
    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 30, b: 40, l: 40, r: 20 },
        legend: {
            font: { color: '#94a3b8', size: 10, family: 'Inter' },
            orientation: 'h',
            y: -0.15
        },
        xaxis: {
            gridcolor: 'rgba(255, 255, 255, 0.05)',
            zerolinecolor: 'rgba(255, 255, 255, 0.08)',
            tickfont: { color: '#64748b' }
        },
        yaxis: {
            gridcolor: 'rgba(255, 255, 255, 0.05)',
            zerolinecolor: 'rgba(255, 255, 255, 0.08)',
            tickfont: { color: '#64748b' }
        }
    };
    
    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('plotly-2d-container', traces, layout, config);
}

function render3DClusterPlot(points) {
    const playstyles = [...new Set(points.map(p => p.playstyle))];
    const colors = getClusterPlotlyColors();
    
    const traces = playstyles.map(style => {
        const subset = points.filter(p => p.playstyle === style);
        return {
            x: subset.map(p => p.pc1_3d),
            y: subset.map(p => p.pc2_3d),
            z: subset.map(p => p.pc3_3d),
            text: subset.map(p => p.team),
            name: style,
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                size: 6,
                color: colors[playstyleMap(style)],
                opacity: 0.95
            },
            hovertemplate: '<b>%{text}</b><br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>PC3: %{z:.2f}<extra></extra>'
        };
    });
    
    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 0, b: 0, l: 0, r: 0 },
        legend: {
            font: { color: '#94a3b8', size: 10, family: 'Inter' },
            orientation: 'h',
            y: 0.02
        },
        scene: {
            xaxis: {
                backgroundcolor: 'rgba(0,0,0,0)',
                gridcolor: 'rgba(255,255,255,0.05)',
                zerolinecolor: 'rgba(255,255,255,0.08)',
                tickfont: { color: '#64748b', size: 9 },
                title: { text: 'PC1', font: { color: '#94a3b8', size: 10 } }
            },
            yaxis: {
                backgroundcolor: 'rgba(0,0,0,0)',
                gridcolor: 'rgba(255,255,255,0.05)',
                zerolinecolor: 'rgba(255,255,255,0.08)',
                tickfont: { color: '#64748b', size: 9 },
                title: { text: 'PC2', font: { color: '#94a3b8', size: 10 } }
            },
            zaxis: {
                backgroundcolor: 'rgba(0,0,0,0)',
                gridcolor: 'rgba(255,255,255,0.05)',
                zerolinecolor: 'rgba(255,255,255,0.08)',
                tickfont: { color: '#64748b', size: 9 },
                title: { text: 'PC3', font: { color: '#94a3b8', size: 10 } }
            }
        }
    };
    
    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('plotly-3d-container', traces, layout, config);
}

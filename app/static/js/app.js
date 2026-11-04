/**
 * ITG HOLDING ENTERPRISE DECISION SYSTEM — DASHBOARD CLIENT ENGINE
 * Handles tab navigation, dynamic multi-tier filtering, API data fetching,
 * interactive Chart.js visualizations, Kanban workflow, and modal forms.
 */

// Global Application State
const state = {
    currentTab: 'portfolio',
    subsidiaryId: 0,
    cluster: 'All',
    ragStatus: 'All',
    lifecycleStatus: 'All',
    scheduleBucket: 'All',
    subsidiaries: [],
    projects: [],
    risksData: null,
    matrixFilter: null,
    charts: {
        subsidiaryHealth: null,
        contractModel: null,
        scurve: null
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initFilters();
    initModals();
    await loadSubsidiaries();
    await refreshActiveTab();
});

// =========================================================================
// NAVIGATION CONTROLLER
// =========================================================================
function initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    state.currentTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${tabId}`);
    });
    refreshActiveTab();
}

async function refreshActiveTab() {
    switch (state.currentTab) {
        case 'portfolio':
            await loadPortfolioDashboard();
            break;
        case 'risks':
            await loadRisksDashboard();
            break;
        case 'tasks':
            await loadTasksDashboard();
            break;
        case 'financials':
            await loadFinancialsDashboard();
            break;
        case 'scurve':
            await loadSCurveDashboard();
            break;
        case 'timeline':
            await loadTimelineDashboard();
            break;
    }
}

// =========================================================================
// FILTERS CONTROLLER (TIER 1 PERSISTENT FILTERS & VELOCITY BUCKETS)
// =========================================================================
function initFilters() {
    const subSelect = document.getElementById('subsidiaryFilter');
    subSelect.addEventListener('change', (e) => {
        state.subsidiaryId = parseInt(e.target.value) || 0;
        refreshActiveTab();
    });

    const clusterSelect = document.getElementById('clusterFilter');
    if (clusterSelect) {
        clusterSelect.addEventListener('change', (e) => {
            state.cluster = e.target.value || 'All';
            refreshActiveTab();
        });
    }

    const statusSelect = document.getElementById('statusFilter');
    statusSelect.addEventListener('change', (e) => {
        state.lifecycleStatus = e.target.value;
        refreshActiveTab();
    });

    const ragButtons = document.querySelectorAll('.rag-btn');
    ragButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            ragButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.ragStatus = btn.getAttribute('data-rag');
            refreshActiveTab();
        });
    });

    // Project table search filter
    const searchInput = document.getElementById('projectSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#projectsTableBody tr');
            rows.forEach(r => {
                r.style.display = r.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
        });
    }

    // Demo Data Seed & Reset buttons
    document.getElementById('btnSeedDemo').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/demo/seed', { method: 'POST' });
            const data = await res.json();
            showToast(data.message, 'success');
            await loadSubsidiaries();
            await refreshActiveTab();
        } catch (err) {
            showToast('Failed to load sample data', 'error');
        }
    });

    document.getElementById('btnResetData').addEventListener('click', async () => {
        if (!confirm('Reset application to clean Zero-Data state? All projects, WBS items, cut-off snapshots, risks, and change requests will be wiped.')) return;
        try {
            const res = await fetch('/api/demo/reset', { method: 'POST' });
            const data = await res.json();
            showToast(data.message, 'success');

            // Reset frontend state & filters cleanly
            state.projects = [];
            state.risksData = null;
            state.matrixFilter = null;
            state.cutoffProjects = [];
            state.subsidiaryId = 0;
            state.cluster = 'All';
            state.ragStatus = 'All';
            state.lifecycleStatus = 'All';
            state.scheduleBucket = 'All';

            const subFilter = document.getElementById('subsidiaryFilter');
            if (subFilter) subFilter.value = '0';
            const clusterFilter = document.getElementById('clusterFilter');
            if (clusterFilter) clusterFilter.value = 'All';
            const statusFilter = document.getElementById('statusFilter');
            if (statusFilter) statusFilter.value = 'All';
            document.querySelectorAll('.rag-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-rag') === 'All');
            });

            const scurveSel = document.getElementById('scurveProjectSelector');
            if (scurveSel) scurveSel.value = '0';
            const tasksSel = document.getElementById('tasksProjectSelector');
            if (tasksSel) tasksSel.value = '0';

            const pSearch = document.getElementById('projectSearchInput');
            if (pSearch) pSearch.value = '';
            const rSearch = document.getElementById('riskSearchInput');
            if (rSearch) rSearch.value = '';

            await refreshActiveTab();
        } catch (err) {
            showToast('Failed to reset system', 'error');
        }
    });
}

function buildFilterQuery(extra = {}) {
    const params = new URLSearchParams();
    if (state.subsidiaryId > 0) params.set('subsidiary_id', state.subsidiaryId);
    if (state.cluster && state.cluster !== 'All') params.set('sector', state.cluster);
    if (state.lifecycleStatus && state.lifecycleStatus !== 'All') params.set('status', state.lifecycleStatus);
    if (state.ragStatus && state.ragStatus !== 'All') params.set('rag_status', state.ragStatus);
    if (state.scheduleBucket && state.scheduleBucket !== 'All') params.set('schedule_bucket', state.scheduleBucket);
    for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0') {
            params.set(k, v);
        }
    }
    return params.toString();
}

function setScheduleVelocityFilter(bucket) {
    if (state.scheduleBucket === bucket && bucket !== 'All') {
        state.scheduleBucket = 'All';
    } else {
        state.scheduleBucket = bucket;
    }
    refreshActiveTab();
}

function setClusterFilter(sectorName) {
    const clusterSelect = document.getElementById('clusterFilter');
    if (state.cluster === sectorName) {
        state.cluster = 'All';
    } else {
        state.cluster = sectorName;
    }
    if (clusterSelect) {
        clusterSelect.value = state.cluster;
    }
    refreshActiveTab();
}

async function loadSubsidiaries() {
    try {
        const res = await fetch('/api/subsidiaries');
        state.subsidiaries = await res.json();
        
        const subSelect = document.getElementById('subsidiaryFilter');
        const formSubSelect = document.getElementById('p_subsidiary');
        
        subSelect.innerHTML = '<option value="0">All ITG Holding (18 Affiliates)</option>';
        formSubSelect.innerHTML = '';

        // Group by sectors
        const sectors = {};
        state.subsidiaries.forEach(s => {
            if (!sectors[s.sector]) sectors[s.sector] = [];
            sectors[s.sector].push(s);
        });

        for (const [sectorName, affiliateList] of Object.entries(sectors)) {
            const group1 = document.createElement('optgroup');
            group1.label = sectorName;
            const group2 = document.createElement('optgroup');
            group2.label = sectorName;

            affiliateList.forEach(s => {
                const opt1 = document.createElement('option');
                opt1.value = s.id;
                opt1.textContent = `${s.name} (${s.code})`;
                group1.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = s.id;
                opt2.textContent = `${s.name} (${s.code})`;
                group2.appendChild(opt2);
            });

            subSelect.appendChild(group1);
            formSubSelect.appendChild(group2);
        }
    } catch (err) {
        console.error('Error loading affiliates:', err);
    }
}

// =========================================================================
// TAB 1: PORTFOLIO OVERVIEW & SMART PMO HUB LOADER
// =========================================================================
async function loadPortfolioDashboard() {
    try {
        const url = `/api/dashboard/portfolio?${buildFilterQuery()}`;

        const res = await fetch(url);
        const data = await res.json();

        // 1. Update Top Executive Stat Cards
        const rollup = data.rollup;
        document.getElementById('kpiTotalProjects').textContent = rollup.total_projects;
        document.getElementById('kpiGroupBAC').textContent = formatCurrency(rollup.group_bac);
        document.getElementById('kpiBurnRate').textContent = `${rollup.group_budget_consumed_pct}%`;
        document.getElementById('kpiActualCost').textContent = `${formatCurrency(rollup.group_ac)} actual spent`;
        document.getElementById('kpiIndices').textContent = `${rollup.group_cpi.toFixed(2)} / ${rollup.group_spi.toFixed(2)}`;
        document.getElementById('kpiOverrunExposure').textContent = `Exposure: ${formatCurrency(rollup.group_overrun_exposure)}`;
        document.getElementById('kpiPipelineCount').textContent = `${rollup.health_distribution.healthy} Healthy, ${rollup.health_distribution.at_risk} At Risk, ${rollup.health_distribution.critical} Critical`;

        // 2. Update CEO 3-Bucket Schedule Delivery Velocity Tracker
        const vCounts = data.velocity_counts || (rollup.schedule_counts || { ADVANCED: 0, ON_TRACK: 0, DELAYED: 0 });
        const totalVel = (vCounts.ADVANCED || 0) + (vCounts.ON_TRACK || 0) + (vCounts.DELAYED || 0);
        const pctAdv = totalVel > 0 ? Math.round((vCounts.ADVANCED / totalVel) * 100) : 0;
        const pctOn = totalVel > 0 ? Math.round((vCounts.ON_TRACK / totalVel) * 100) : 0;
        const pctDel = totalVel > 0 ? Math.round((vCounts.DELAYED / totalVel) * 100) : 0;

        const elAdv = document.getElementById('velCountAdvanced');
        const elPctAdv = document.getElementById('velPctAdvanced');
        const elOn = document.getElementById('velCountOnTrack');
        const elPctOn = document.getElementById('velPctOnTrack');
        const elDel = document.getElementById('velCountDelayed');
        const elPctDel = document.getElementById('velPctDelayed');

        if (elAdv) elAdv.textContent = vCounts.ADVANCED || 0;
        if (elPctAdv) elPctAdv.textContent = `${pctAdv}% of portfolio`;
        if (elOn) elOn.textContent = vCounts.ON_TRACK || 0;
        if (elPctOn) elPctOn.textContent = `${pctOn}% of portfolio`;
        if (elDel) elDel.textContent = vCounts.DELAYED || 0;
        if (elPctDel) elPctDel.textContent = `${pctDel}% of portfolio`;

        // Highlight active Velocity card & show Reset Velocity Filter button
        const cardAdv = document.getElementById('velCardADVANCED');
        const cardOn = document.getElementById('velCardON_TRACK');
        const cardDel = document.getElementById('velCardDELAYED');
        const btnClearVel = document.getElementById('btnClearVelocityFilter');
        const badgeActiveVel = document.getElementById('activeVelocityFilterBadge');

        if (cardAdv) cardAdv.style.boxShadow = state.scheduleBucket === 'ADVANCED' ? '0 0 0 3px #10B981' : 'none';
        if (cardOn) cardOn.style.boxShadow = state.scheduleBucket === 'ON_TRACK' ? '0 0 0 3px #0284C7' : 'none';
        if (cardDel) cardDel.style.boxShadow = state.scheduleBucket === 'DELAYED' ? '0 0 0 3px #EF4444' : 'none';

        if (btnClearVel) {
            btnClearVel.style.display = state.scheduleBucket !== 'All' ? 'inline-flex' : 'none';
        }
        if (badgeActiveVel) {
            if (state.scheduleBucket !== 'All') {
                const labelMap = {
                    'ADVANCED': 'Filtered: Advanced / Ahead of Schedule',
                    'ON_TRACK': 'Filtered: On Track / On Schedule',
                    'DELAYED': 'Filtered: Delayed / Behind Schedule'
                };
                badgeActiveVel.style.display = 'inline-block';
                badgeActiveVel.textContent = labelMap[state.scheduleBucket] || state.scheduleBucket;
            } else {
                badgeActiveVel.style.display = 'none';
            }
        }

        // 3. Render 4 ITG Holding Business Cluster Rollup Cards
        renderClusterRollup(data.cluster_breakdown || []);

        // 4. Render Central PMO Project Database & Live Status Ledger Table
        const tbody = document.getElementById('projectsTableBody');
        tbody.innerHTML = '';

        if (data.projects.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" class="empty-state">
                        <i class="fa-solid fa-folder-open text-blue"></i>
                        <p>No projects match the current filter criteria. Adjust filters above or click <strong>+ Register Project</strong>.</p>
                    </td>
                </tr>`;
        } else {
            data.projects.forEach(p => {
                const tr = document.createElement('tr');
                const k = p.kpis;

                // Schedule Velocity Badge
                let velBadgeHtml = '';
                if (k.schedule_bucket === 'ADVANCED') {
                    velBadgeHtml = `<span class="badge badge-green" style="font-size:0.7rem;"><i class="fa-solid fa-rocket"></i> ${k.schedule_label || 'Ahead'}</span>`;
                } else if (k.schedule_bucket === 'DELAYED') {
                    const cls = k.delay_days > 30 ? 'badge-red' : 'badge-amber';
                    velBadgeHtml = `<span class="badge ${cls}" style="font-size:0.7rem;"><i class="fa-solid fa-clock-rotate-left"></i> ${k.schedule_label || 'Delayed'}</span>`;
                } else {
                    velBadgeHtml = `<span class="badge badge-blue" style="font-size:0.7rem;"><i class="fa-solid fa-calendar-check"></i> ${k.schedule_label || 'On Schedule'}</span>`;
                }

                const tcpiVal = k.tcpi !== undefined ? Number(k.tcpi).toFixed(2) : '1.00';
                const tcpiColor = k.tcpi > 1.10 ? '#DC2626' : (k.tcpi > 1.02 ? '#D97706' : '#64748B');

                tr.innerHTML = `
                    <td><span class="badge ${getRagBadgeClass(k.rag_status)}">${k.rag_status}</span></td>
                    <td>
                        <a href="javascript:void(0)" onclick="openProjectDetail(${p.id})" style="color:var(--text-primary); text-decoration:none; font-weight:700; cursor:pointer;" title="Click to view full 25 KPI Audit">
                            <i class="fa-solid fa-folder-open text-blue"></i> ${p.project_code}
                        </a><br/>
                        <span style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="openProjectDetail(${p.id})">${p.name}</span>
                    </td>
                    <td>
                        <span class="badge badge-clean">${p.subsidiary_code}</span><br/>
                        <span style="font-size:0.65rem; color:var(--text-muted);">${p.sector || ''}</span>
                    </td>
                    <td>
                        <div style="font-weight:600; font-size:0.78rem;">${p.pm}</div>
                        <span style="font-size:0.68rem; color:var(--text-muted);">${p.project_type}</span>
                    </td>
                    <td>
                        <select class="form-control" style="font-size:0.72rem; padding:0.2rem 0.4rem; height:auto; width:112px; font-weight:600; border-radius:6px;" onchange="quickUpdateProjectStatus(${p.id}, this.value)" title="1-Click Inline Lifecycle Status Switcher">
                            <option value="Active" ${p.status === 'Active' ? 'selected' : ''}>🟢 Active</option>
                            <option value="Not Started" ${p.status === 'Not Started' ? 'selected' : ''}>⚪ Not Started</option>
                            <option value="On Hold" ${p.status === 'On Hold' ? 'selected' : ''}>🟠 On Hold</option>
                            <option value="Closed" ${p.status === 'Closed' ? 'selected' : ''}>🔵 Closed</option>
                        </select>
                    </td>
                    <td>
                        ${velBadgeHtml}
                        <div style="font-size:0.66rem; color:var(--text-muted); margin-top:2px;">SV: ${k.sv_pct >= 0 ? '+' : ''}${k.sv_pct}%</div>
                    </td>
                    <td>${formatCurrency(k.revised_bac || p.bac)}</td>
                    <td>${formatCurrency(k.ac)}</td>
                    <td>
                        <div style="font-weight:700;">${k.overall_progress_pct}%</div>
                        <div style="background:#E2E8F0; border-radius:4px; height:5px; width:60px;">
                            <div style="background:#0284C7; height:5px; border-radius:4px; width:${Math.min(100, k.overall_progress_pct)}%;"></div>
                        </div>
                    </td>
                    <td>
                        <strong class="${k.cpi >= 0.95 ? 'text-green' : (k.cpi >= 0.9 ? 'text-amber' : 'text-red')}">${k.cpi.toFixed(2)}</strong>
                        <div style="font-size:0.66rem; color:${tcpiColor}; font-weight:600;" title="To-Complete Performance Index (Required efficiency to finish on BAC)">TCPI: ${tcpiVal}</div>
                    </td>
                    <td><strong class="${k.spi >= 0.95 ? 'text-green' : (k.spi >= 0.9 ? 'text-amber' : 'text-red')}">${k.spi.toFixed(2)}</strong></td>
                    <td>
                        <div style="font-weight:600; font-size:0.78rem;">${k.forecast_completion_date || p.baseline_end_date}</div>
                        <div style="font-size:0.65rem; color:var(--text-muted);">Base: ${k.revised_baseline_end_date || p.baseline_end_date}</div>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="openProjectDetail(${p.id})" title="View Complete 25 KPI Ledger"><i class="fa-solid fa-eye"></i> Audit</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // 5. Render Subsidiary Health Chart
        renderSubsidiaryHealthChart(data.subsidiary_breakdown);

        // 6. Render Smart PMO Diagnostic & CEO Action Insights
        renderExecutiveAlerts(data.projects);

    } catch (err) {
        console.error('Error loading portfolio dashboard:', err);
    }
}

function renderClusterRollup(clusters) {
    const grid = document.getElementById('clusterRollupGrid');
    if (!grid) return;

    const clusterIcons = {
        'Enterprise & Services': 'fa-server text-blue',
        'Software & Solutions': 'fa-code text-purple',
        'Distribution & Retail': 'fa-boxes-stacked text-amber',
        'Site & Power': 'fa-bolt text-emerald'
    };

    grid.innerHTML = clusters.map(c => {
        const isSelected = state.cluster === c.sector;
        const iconCls = clusterIcons[c.sector] || 'fa-layer-group text-blue';
        const sc = c.schedule_counts || { ADVANCED: 0, ON_TRACK: 0, DELAYED: 0 };
        return `
            <div onclick="setClusterFilter('${c.sector}')" style="background:${isSelected ? '#EFF6FF' : '#F8FAFC'}; border:${isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0'}; border-radius:8px; padding:0.65rem 0.85rem; cursor:pointer; transition:all 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                    <span style="font-size:0.75rem; font-weight:700; color:#0F172A;"><i class="fa-solid ${iconCls}"></i> ${c.sector}</span>
                    <span class="badge badge-clean" style="font-size:0.65rem;">${c.project_count} Proj</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.35rem;">
                    <span style="font-size:0.95rem; font-weight:800; color:#1E293B;">${formatCurrency(c.bac)}</span>
                    <span style="font-size:0.68rem; color:#64748B;">Spent: ${formatCurrency(c.ac)}</span>
                </div>
                <div style="display:flex; gap:0.35rem; font-size:0.65rem; font-weight:600;">
                    <span style="color:#059669; background:#ECFDF5; padding:1px 5px; border-radius:4px;" title="Advanced / Ahead">🚀 ${sc.ADVANCED || 0} Ahead</span>
                    <span style="color:#0284C7; background:#F0F9FF; padding:1px 5px; border-radius:4px;" title="On Track">✅ ${sc.ON_TRACK || 0} On Track</span>
                    <span style="color:#DC2626; background:#FEF2F2; padding:1px 5px; border-radius:4px;" title="Delayed">🚨 ${sc.DELAYED || 0} Delayed</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderSubsidiaryHealthChart(breakdown) {
    const ctx = document.getElementById('subsidiaryHealthChart');
    if (!ctx) return;

    if (state.charts.subsidiaryHealth) {
        state.charts.subsidiaryHealth.destroy();
    }

    const filtered = breakdown.filter(b => b.project_count > 0);
    const labels = filtered.length > 0 ? filtered.map(b => b.code) : ['No Projects'];
    const healthy = filtered.length > 0 ? filtered.map(b => b.rag_counts.GREEN) : [0];
    const atRisk = filtered.length > 0 ? filtered.map(b => b.rag_counts.AMBER) : [0];
    const critical = filtered.length > 0 ? filtered.map(b => b.rag_counts.RED) : [0];

    state.charts.subsidiaryHealth = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Healthy (Green)', data: healthy, backgroundColor: '#10B981' },
                { label: 'At Risk (Amber)', data: atRisk, backgroundColor: '#F59E0B' },
                { label: 'Critical (Red)', data: critical, backgroundColor: '#EF4444' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }
            }
        }
    });
}

function renderExecutiveAlerts(projects) {
    const container = document.getElementById('executiveAlertsList');
    const badge = document.getElementById('alertCountBadge');
    const insights = [];

    projects.forEach(p => {
        const k = p.kpis;
        // 1. Schedule & WBS Bottleneck Diagnostic
        if (k.schedule_bucket === 'DELAYED') {
            const blockedText = (k.blocked_wbs_items && k.blocked_wbs_items.length > 0)
                ? `Blocked WBS Deliverable: "${k.blocked_wbs_items[0]}"`
                : `SPI at ${k.spi.toFixed(2)} (${k.sv_pct}% schedule variance)`;
            insights.push({
                severity: k.delay_days > 30 ? 'critical' : 'warning',
                icon: 'fa-clock-rotate-left',
                borderColor: k.delay_days > 30 ? '#EF4444' : '#F59E0B',
                bgColor: k.delay_days > 30 ? '#FEF2F2' : '#FFFBEB',
                tag: `DELAYED (${k.schedule_label})`,
                tagCls: k.delay_days > 30 ? 'badge-red' : 'badge-amber',
                id: p.id,
                code: p.project_code,
                sub: p.subsidiary_code,
                name: p.name,
                msg: `${blockedText}. Forecast finish slipped to ${k.forecast_completion_date}.`,
                action: k.delay_days > 30 ? 'CEO Action: Convene SteerCo recovery review & unblock critical path.' : 'PMO Action: Fast-track pending WBS milestones.'
            });
        }

        // 2. Cost Burn & TCPI Recovery Feasibility Warning
        if (k.cpi < 0.95) {
            const tcpiNote = k.tcpi > 1.10
                ? `TCPI is ${k.tcpi.toFixed(2)} (Unrecoverable within original BAC — requires ${formatCurrency(Math.abs(k.vac))} overrun reserve)`
                : `TCPI is ${k.tcpi.toFixed(2)} (Requires strict cost efficiency on remaining work)`;
            insights.push({
                severity: k.cpi < 0.90 ? 'critical' : 'warning',
                icon: 'fa-coins',
                borderColor: k.cpi < 0.90 ? '#EF4444' : '#F59E0B',
                bgColor: k.cpi < 0.90 ? '#FEF2F2' : '#FFFBEB',
                tag: `COST OVERRUN (CPI ${k.cpi.toFixed(2)})`,
                tagCls: k.cpi < 0.90 ? 'badge-red' : 'badge-amber',
                id: p.id,
                code: p.project_code,
                sub: p.subsidiary_code,
                name: p.name,
                msg: `${tcpiNote}. EAC projected at ${formatCurrency(k.eac)}.`,
                action: 'CFO/PMO Action: Audit subcontractor burn rate & freeze non-essential scope.'
            });
        }

        // 3. Advanced / Outperforming Initiative Recognition
        if (k.schedule_bucket === 'ADVANCED' && k.cpi >= 1.0) {
            insights.push({
                severity: 'positive',
                icon: 'fa-rocket',
                borderColor: '#10B981',
                bgColor: '#ECFDF5',
                tag: `ADVANCED (${k.schedule_label})`,
                tagCls: 'badge-green',
                id: p.id,
                code: p.project_code,
                sub: p.subsidiary_code,
                name: p.name,
                msg: `Delivering ahead of baseline (SPI ${k.spi.toFixed(2)}, CPI ${k.cpi.toFixed(2)}) withprojected cost savings of ${formatCurrency(Math.max(0, k.vac))}.`,
                action: 'Executive Opportunity: Candidate for early client sign-off & resource reallocation.'
            });
        }
    });

    if (badge) badge.textContent = `${insights.length} Insights`;
    if (!container) return;

    if (insights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-check" style="color:var(--rag-green)"></i>
                <p>No critical deviations detected for the current filter selection.</p>
            </div>`;
    } else {
        container.innerHTML = insights.map(item => `
            <div style="border-left:4px solid ${item.borderColor}; background:${item.bgColor}; border-radius:6px; padding:0.55rem 0.75rem; margin-bottom:0.5rem; cursor:pointer;" onclick="openProjectDetail(${item.id})">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
                    <span style="font-size:0.76rem; font-weight:700; color:#0F172A;">
                        <i class="fa-solid ${item.icon}" style="color:${item.borderColor}; margin-right:4px;"></i>
                        ${item.code} (${item.sub}) — ${item.name}
                    </span>
                    <span class="badge ${item.tagCls}" style="font-size:0.62rem;">${item.tag}</span>
                </div>
                <div style="font-size:0.72rem; color:#334155; line-height:1.35;">${item.msg}</div>
                <div style="font-size:0.68rem; font-weight:700; color:#0F172A; margin-top:0.25rem;"><i class="fa-solid fa-bolt text-amber"></i> ${item.action}</div>
            </div>
        `).join('');
    }
}

async function quickUpdateProjectStatus(projectId, newStatus) {
    try {
        const res = await fetch(`/api/projects/${projectId}/status?status=${encodeURIComponent(newStatus)}`, {
            method: 'PATCH'
        });
        if (!res.ok) throw new Error(await res.text());
        showToast(`Project status updated to "${newStatus}"`, 'success');
        await refreshActiveTab();
    } catch (err) {
        showToast(`Failed to update status: ${err.message}`, 'error');
    }
}

async function exportPortfolioToCsv() {
    try {
        const res = await fetch(`/api/projects?${buildFilterQuery()}`);
        const projects = await res.json();
        if (!projects || projects.length === 0) {
            showToast('No projects available to export for current filter.', 'error');
            return;
        }

        const headers = [
            'Project Code', 'Project Name', 'Affiliate Code', 'Affiliate Name', 'ITG Cluster',
            'Client', 'Project Manager', 'Contract Type', 'Lifecycle Status',
            'Schedule Velocity', 'Schedule Label', 'RAG Health',
            'Baseline Start', 'Baseline Finish', 'Forecast Finish', 'Delay Days',
            'BAC ($)', 'Revised BAC ($)', 'Planned Value PV ($)', 'Earned Value EV ($)', 'Actual Cost AC ($)',
            'Progress (%)', 'CPI', 'SPI', 'TCPI', 'EAC ($)', 'VAC ($)'
        ];

        const escapeCsv = (val) => {
            const s = val === undefined || val === null ? '' : String(val);
            return `"${s.replace(/"/g, '""')}"`;
        };

        const rows = projects.map(p => {
            const k = p.kpis || {};
            return [
                p.project_code, p.name, p.subsidiary_code, p.subsidiary_name, p.sector,
                p.client, p.pm, p.project_type, p.status,
                k.schedule_bucket, k.schedule_label, k.rag_status,
                p.baseline_start_date, p.baseline_end_date, k.forecast_completion_date || p.baseline_end_date, k.delay_days || 0,
                p.bac, k.revised_bac || p.bac, k.pv || 0, k.ev || 0, k.ac || 0,
                k.overall_progress_pct || 0, k.cpi || 1, k.spi || 1, k.tcpi || 1, k.eac || p.bac, k.vac || 0
            ].map(escapeCsv).join(',');
        });

        const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `ITG_Holding_PMO_Portfolio_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Exported ${projects.length} projects to Excel-ready CSV!`, 'success');
    } catch (err) {
        showToast('Failed to export CSV', 'error');
    }
}

async function handleCsvFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
            showToast('CSV file must contain a header row and at least 1 project row.', 'error');
            event.target.value = '';
            return;
        }

        const parseCsvLine = (line) => {
            const result = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === ',' && !inQuotes) {
                    result.push(cur.trim());
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            result.push(cur.trim());
            return result;
        };

        const rawHeaders = parseCsvLine(lines[0].replace(/^\uFEFF/, '')).map(h => h.toLowerCase());
        const findCol = (...names) => rawHeaders.findIndex(h => names.some(n => h.includes(n)));

        const idxCode = findCol('project code', 'project_code', 'code');
        const idxName = findCol('project name', 'name');
        const idxSub = findCol('affiliate code', 'subsidiary_code', 'affiliate', 'subsidiary');
        const idxClient = findCol('client');
        const idxPm = findCol('project manager', 'pm');
        const idxType = findCol('contract type', 'project_type', 'type');
        const idxStatus = findCol('lifecycle status', 'status');
        const idxStart = findCol('baseline start', 'start');
        const idxEnd = findCol('baseline finish', 'end', 'finish');
        const idxBac = findCol('bac', 'budget');
        const idxContract = findCol('contract value', 'contract');

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCsvLine(lines[i]);
            if (cols.length < 2) continue;
            const bacVal = parseFloat((cols[idxBac] || '100000').replace(/[^0-9.-]+/g, '')) || 100000;
            rows.push({
                project_code: idxCode >= 0 ? cols[idxCode] : `ITG-IMP-${i}`,
                name: idxName >= 0 ? cols[idxName] : `Imported Project ${i}`,
                subsidiary_code: idxSub >= 0 ? cols[idxSub] : 'MDSL',
                client: idxClient >= 0 ? cols[idxClient] : 'Enterprise Client',
                pm: idxPm >= 0 ? cols[idxPm] : 'Assigned PM',
                project_type: idxType >= 0 ? cols[idxType] : 'Fixed Price',
                status: idxStatus >= 0 ? cols[idxStatus] : 'Active',
                baseline_start_date: idxStart >= 0 && cols[idxStart] ? cols[idxStart] : '2026-01-01',
                baseline_end_date: idxEnd >= 0 && cols[idxEnd] ? cols[idxEnd] : '2026-12-31',
                bac: bacVal,
                contract_value: idxContract >= 0 && cols[idxContract] ? (parseFloat(cols[idxContract].replace(/[^0-9.-]+/g, '')) || bacVal * 1.2) : bacVal * 1.2
            });
        }

        const res = await fetch('/api/projects/import-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Import failed');

        showToast(data.message, 'success');
        event.target.value = '';
        await refreshActiveTab();
    } catch (err) {
        showToast(`CSV Import Error: ${err.message}`, 'error');
        event.target.value = '';
    }
}

// =========================================================================
// TAB 2: RISKS & GOVERNANCE REGISTER LOADER
// =========================================================================
async function loadRisksDashboard() {
    try {
        const url = `/api/dashboard/risks?${buildFilterQuery()}`;

        const res = await fetch(url);
        const data = await res.json();
        state.risksData = data;

        // 1. Render Top Stat Cards
        document.getElementById('riskTotalOpen').textContent = data.summary.total_open_risks;
        document.getElementById('riskCriticalCount').textContent = data.summary.critical_high_count;
        document.getElementById('riskTotalExposure').textContent = formatCurrency(data.summary.total_exposure_cost);
        document.getElementById('riskPendingCRs').textContent = data.summary.pending_crs_count;
        document.getElementById('riskPendingCRCost').textContent = `${formatCurrency(data.summary.pending_crs_cost_impact)} scope impact`;

        // 2. Compute and Render Severity Counts in Legend
        let critCount = 0, highCount = 0, medCount = 0, lowCount = 0;
        (data.risks || []).filter(r => r.status === 'Open').forEach(r => {
            const s = r.calc_severity || r.severity;
            if (s === 'Critical') critCount++;
            else if (s === 'High') highCount++;
            else if (s === 'Medium') medCount++;
            else lowCount++;
        });
        document.getElementById('badgeCountCritical').textContent = critCount;
        document.getElementById('badgeCountHigh').textContent = highCount;
        document.getElementById('badgeCountMedium').textContent = medCount;
        document.getElementById('badgeCountLow').textContent = lowCount;

        // 3. Contingency Reserve vs Exposure
        const totalExp = data.summary.total_exposure_cost || 0;
        const totalCont = data.summary.total_contingency_reserve || 0;
        const contElem = document.getElementById('matrixContingencyVal');
        if (contElem) contElem.textContent = formatCurrency(totalCont);
        const expElem = document.getElementById('matrixExposureVal');
        if (expElem) expElem.textContent = formatCurrency(totalExp);
        const barElem = document.getElementById('matrixCoverageBar');
        const statusElem = document.getElementById('matrixContingencyStatus');
        if (barElem && statusElem) {
            if (totalCont === 0 && totalExp === 0) {
                barElem.style.width = '0%';
                barElem.style.backgroundColor = 'var(--text-muted)';
                statusElem.textContent = 'Zero Baseline';
                statusElem.className = 'badge badge-clean';
            } else if (totalExp > totalCont) {
                const pct = totalCont > 0 ? Math.min(100, Math.round((totalCont / totalExp) * 100)) : 0;
                barElem.style.width = `${pct}%`;
                barElem.style.backgroundColor = '#EF4444';
                statusElem.textContent = `Deficit: ${formatCurrency(totalExp - totalCont)}`;
                statusElem.className = 'badge badge-red';
            } else {
                const pct = totalCont > 0 ? Math.min(100, Math.round((totalExp / totalCont) * 100)) : 100;
                barElem.style.width = `${pct}%`;
                barElem.style.backgroundColor = '#10B981';
                statusElem.textContent = 'Reserve Covered';
                statusElem.className = 'badge badge-green';
            }
        }

        // 4. Render 5x5 Matrix
        renderRiskMatrix(data.matrix_5x5);

        // 4. Render Risks Table
        applyRiskFilters();

        // 5. Render Change Requests Table
        renderChangeRequestsTable(data.change_requests);

    } catch (err) {
        console.error('Error loading risks dashboard:', err);
    }
}

function renderRiskMatrix(matrix) {
    const tbody = document.getElementById('riskMatrixBody');
    if (!tbody || !matrix) return;

    tbody.innerHTML = matrix.map(row => {
        const p = row.probability;
        const cellHtmls = row.cells.map(cell => {
            const count = cell.count;
            const badgeCls = count > 0 ? 'cell-badge' : 'cell-badge empty-badge';
            const isSelected = state.matrixFilter && state.matrixFilter.type === 'cell' && state.matrixFilter.p === cell.probability && state.matrixFilter.i === cell.impact;
            const selCls = isSelected ? 'selected' : '';
            return `
                <td class="matrix-cell ${cell.color_class} ${selCls}" 
                    data-p="${cell.probability}" 
                    data-i="${cell.impact}"
                    onclick="handleMatrixCellClick(${cell.probability}, ${cell.impact})"
                    title="P: ${cell.probability}, Impact: ${cell.impact} (Score: ${cell.score}) — Severity: ${cell.severity}">
                    <div class="cell-content">
                        <div class="cell-header-row">
                            <span>#${cell.score}</span>
                            <span>${cell.severity}</span>
                        </div>
                        <div class="cell-body-row">
                            <span class="${badgeCls}">${count}</span>
                        </div>
                    </div>
                </td>
            `;
        }).join('');

        return `
            <tr>
                <th class="matrix-axis-th">${p}</th>
                ${cellHtmls}
            </tr>
        `;
    }).join('');
}

function handleMatrixCellClick(p, i) {
    if (state.matrixFilter && state.matrixFilter.type === 'cell' && state.matrixFilter.p === p && state.matrixFilter.i === i) {
        resetMatrixFilter();
        return;
    }
    state.matrixFilter = { type: 'cell', p: p, i: i };
    const label = document.getElementById('matrixActiveFilterLabel');
    if (label) label.textContent = `Cell [P: ${p}, I: ${i}] Active`;
    const btnReset = document.getElementById('btnResetMatrixFilter');
    if (btnReset) btnReset.style.display = 'inline-flex';

    if (state.risksData) {
        renderRiskMatrix(state.risksData.matrix_5x5);
        applyRiskFilters();
    }
}

function filterBySeverity(severity) {
    if (state.matrixFilter && state.matrixFilter.type === 'severity' && state.matrixFilter.severity === severity) {
        resetMatrixFilter();
        return;
    }
    state.matrixFilter = { type: 'severity', severity: severity };
    const label = document.getElementById('matrixActiveFilterLabel');
    if (label) label.textContent = `Severity: ${severity}`;
    const btnReset = document.getElementById('btnResetMatrixFilter');
    if (btnReset) btnReset.style.display = 'inline-flex';

    if (state.risksData) {
        renderRiskMatrix(state.risksData.matrix_5x5);
        applyRiskFilters();
    }
}

function resetMatrixFilter() {
    state.matrixFilter = null;
    const label = document.getElementById('matrixActiveFilterLabel');
    if (label) label.textContent = 'Filter: All Cells';
    const btnReset = document.getElementById('btnResetMatrixFilter');
    if (btnReset) btnReset.style.display = 'none';

    if (state.risksData) {
        renderRiskMatrix(state.risksData.matrix_5x5);
        applyRiskFilters();
    }
}

function filterRisksTable() {
    applyRiskFilters();
}

function applyRiskFilters() {
    if (!state.risksData) return;
    const searchVal = (document.getElementById('riskSearchInput')?.value || '').toLowerCase().trim();
    let filtered = state.risksData.risks || [];

    // Apply matrix / severity filter
    if (state.matrixFilter) {
        if (state.matrixFilter.type === 'cell') {
            filtered = filtered.filter(r => r.p_score === state.matrixFilter.p && r.impact_level === state.matrixFilter.i);
        } else if (state.matrixFilter.type === 'severity') {
            filtered = filtered.filter(r => (r.calc_severity || r.severity) === state.matrixFilter.severity);
        }
    }

    // Apply search text
    if (searchVal) {
        filtered = filtered.filter(r => 
            (r.risk_code && r.risk_code.toLowerCase().includes(searchVal)) ||
            (r.description && r.description.toLowerCase().includes(searchVal)) ||
            (r.owner && r.owner.toLowerCase().includes(searchVal)) ||
            (r.project_name && r.project_name.toLowerCase().includes(searchVal)) ||
            (r.subsidiary_code && r.subsidiary_code.toLowerCase().includes(searchVal))
        );
    }

    renderRisksTable(filtered);
}

function renderRisksTable(risks) {
    const tbody = document.getElementById('risksTableBody');
    if (!tbody) return;

    if (!risks || risks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="empty-state" style="padding:2rem;"><i class="fa-solid fa-shield-halved" style="font-size:1.5rem; color:var(--text-muted); margin-bottom:0.5rem; display:block;"></i><p>No project risks match current criteria.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = risks.map(r => {
        const sev = r.calc_severity || r.severity;
        const sevBadge = sev === 'Critical' ? 'badge-red' : (sev === 'High' ? 'badge-amber' : (sev === 'Medium' ? 'badge-amber' : 'badge-green'));
        const statusBadge = r.status === 'Open' ? 'badge-amber' : (r.status === 'Mitigated' ? 'badge-blue' : 'badge-green');
        const pLabel = r.probability === 5 ? '5 (Very High)' : (r.probability === 4 ? '4 (High)' : (r.probability === 3 ? '3 (Medium)' : (r.probability === 2 ? '2 (Low)' : '1 (Very Low)')));

        let actionBtn = '';
        if (r.status === 'Open') {
            actionBtn = `
                <div style="display:flex; gap:0.25rem; align-items:center;">
                    <button class="btn btn-sm btn-outline" onclick="updateRiskStatus(${r.id}, 'Mitigated')" title="Mitigate"><i class="fa-solid fa-shield"></i> Mitigate</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--crimson-red); border-color:#FECACA;" onclick="deleteRisk(${r.id})" title="Delete Risk"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        } else if (r.status === 'Mitigated') {
            actionBtn = `
                <div style="display:flex; gap:0.25rem; align-items:center;">
                    <button class="btn btn-sm btn-outline" onclick="updateRiskStatus(${r.id}, 'Closed')" title="Close"><i class="fa-solid fa-lock"></i> Close</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--crimson-red); border-color:#FECACA;" onclick="deleteRisk(${r.id})" title="Delete Risk"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        } else {
            actionBtn = `
                <div style="display:flex; gap:0.25rem; align-items:center;">
                    <button class="btn btn-sm btn-outline" onclick="updateRiskStatus(${r.id}, 'Open')" title="Re-open"><i class="fa-solid fa-rotate-left"></i> Re-open</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--crimson-red); border-color:#FECACA;" onclick="deleteRisk(${r.id})" title="Delete Risk"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        }

        return `
            <tr>
                <td><strong>${r.risk_code}</strong></td>
                <td><strong>${r.project_code}</strong></td>
                <td><span class="badge badge-clean">${r.subsidiary_code}</span></td>
                <td>${r.description}</td>
                <td><span class="badge badge-clean">${pLabel}</span></td>
                <td>${formatCurrency(r.impact_cost)}</td>
                <td><strong class="${r.exposure_cost > 30000 ? 'text-red' : (r.exposure_cost > 15000 ? 'text-amber' : 'text-green')}">${formatCurrency(r.exposure_cost)}</strong></td>
                <td><span class="badge ${sevBadge}">${sev}</span></td>
                <td>${r.owner}</td>
                <td><span class="badge ${statusBadge}">${r.status}</span></td>
                <td>${actionBtn}</td>
            </tr>
        `;
    }).join('');
}

function renderChangeRequestsTable(crs) {
    const tbody = document.getElementById('changeRequestsTableBody');
    if (!tbody) return;

    if (!crs || crs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state" style="padding:2rem;"><i class="fa-solid fa-inbox" style="font-size:1.5rem; color:var(--text-muted); margin-bottom:0.5rem; display:block;"></i><p>No change requests submitted.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = crs.map(cr => {
        const stBadge = cr.status === 'Approved' ? 'badge-green' : (cr.status === 'Pending' ? 'badge-amber' : 'badge-red');
        const costClass = cr.cost_impact > 0 ? 'text-red' : 'text-green';
        const costStr = (cr.cost_impact > 0 ? '+ ' : '') + formatCurrency(cr.cost_impact);
        const schedStr = cr.schedule_impact_days > 0 ? `+${cr.schedule_impact_days} days` : (cr.schedule_impact_days < 0 ? `${cr.schedule_impact_days} days` : '0 days');

        let actions = '';
        if (cr.status === 'Pending') {
            actions = `
                <div class="cr-action-group" style="display:flex; gap:0.25rem; align-items:center;">
                    <button class="btn-action-approve" onclick="updateChangeRequestStatus(${cr.id}, 'Approved')" title="Approve"><i class="fa-solid fa-check"></i> Approve</button>
                    <button class="btn-action-reject" onclick="updateChangeRequestStatus(${cr.id}, 'Rejected')" title="Reject"><i class="fa-solid fa-xmark"></i> Reject</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--crimson-red); border-color:#FECACA; padding:0.2rem 0.4rem;" onclick="deleteChangeRequest(${cr.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        } else {
            actions = `
                <div style="display:flex; gap:0.25rem; align-items:center;">
                    <span class="badge badge-clean"><i class="fa-solid fa-check-double"></i> Resolved</span>
                    <button class="btn btn-sm btn-outline" style="color:var(--crimson-red); border-color:#FECACA; padding:0.2rem 0.4rem;" onclick="deleteChangeRequest(${cr.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        }

        const approvalInfo = cr.approved_by ? `<span style="font-size:0.75rem; color:var(--text-muted);">${cr.approved_by}<br>${cr.approval_date || ''}</span>` : '<span style="font-size:0.75rem; color:var(--text-muted);">&mdash;</span>';

        return `
            <tr>
                <td><strong>${cr.cr_code}</strong></td>
                <td><strong>${cr.project_code}</strong></td>
                <td><span class="badge badge-clean">${cr.subsidiary_code}</span></td>
                <td>${cr.description}</td>
                <td><strong class="${costClass}">${costStr}</strong></td>
                <td><span class="badge badge-clean">${schedStr}</span></td>
                <td>${cr.requested_by}</td>
                <td><span class="badge ${stBadge}">${cr.status}</span></td>
                <td>${approvalInfo}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

async function updateChangeRequestStatus(crId, newStatus) {
    try {
        const res = await fetch(`/api/change-requests/${crId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, approved_by: 'Holding PMO' })
        });
        if (res.ok) {
            showToast(`Change request ${newStatus.toLowerCase()} successfully.`, 'success');
            await loadRisksDashboard();
            await loadPortfolioDashboard();
            await loadFinancialsDashboard();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to update change request.', 'error');
        }
    } catch (e) {
        showToast('Error communicating with server.', 'error');
    }
}

async function updateRiskStatus(riskId, newStatus) {
    try {
        const res = await fetch(`/api/risks/${riskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            showToast(`Risk marked as ${newStatus}.`, 'success');
            await loadRisksDashboard();
            await loadPortfolioDashboard();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to update risk.', 'error');
        }
    } catch (e) {
        showToast('Error communicating with server.', 'error');
    }
}

// =========================================================================
// FORM 4 GOVERNANCE SUITE MODALS: ADD RISK & ADD CHANGE REQUEST
// =========================================================================

async function openAddRiskModal() {
    const form = document.getElementById('formAddRisk');
    if (form) form.reset();

    const sel = document.getElementById('risk_project_id');
    const res = await fetch('/api/projects');
    const projs = await res.json();

    if (projs.length === 0) {
        sel.innerHTML = `<option value="">-- No Active Projects Registered --</option>`;
    } else {
        sel.innerHTML = projs.map(p => `<option value="${p.id}">${p.project_code} — ${p.name} (${p.subsidiary_code || ''})</option>`).join('');
    }

    // Suggest next code as clean placeholder (not pre-filled value)
    const riskCount = (state.risksData && state.risksData.risks) ? state.risksData.risks.length + 1 : 1;
    const codeInput = document.getElementById('risk_code');
    if (codeInput) {
        codeInput.value = '';
        codeInput.placeholder = `e.g. RSK-${String(riskCount).padStart(3, '0')}`;
    }
    document.getElementById('risk_owner').value = '';
    document.getElementById('risk_desc').value = '';
    document.getElementById('risk_prob').value = '3';
    document.getElementById('risk_impact').value = '';

    calculateRiskExposurePreview();
    document.getElementById('modalAddRisk').classList.add('active');
}

function closeAddRiskModal() {
    document.getElementById('modalAddRisk').classList.remove('active');
}

function calculateRiskExposurePreview() {
    const p = parseInt(document.getElementById('risk_prob').value) || 1;
    const rawImpact = document.getElementById('risk_impact').value;
    const elSev = document.getElementById('riskPrevSeverity');
    const elExp = document.getElementById('riskPrevExposure');

    if (rawImpact === '' || rawImpact === null || isNaN(parseFloat(rawImpact))) {
        if (elSev) {
            elSev.textContent = '-';
            elSev.style.color = 'var(--navy-blue)';
        }
        if (elExp) {
            elExp.textContent = '$0.00';
        }
        return;
    }

    const impact = parseFloat(rawImpact) || 0;

    let impactLevel = 1;
    if (impact <= 15000) impactLevel = 1;
    else if (impact <= 30000) impactLevel = 2;
    else if (impact <= 50000) impactLevel = 3;
    else if (impact <= 80000) impactLevel = 4;
    else impactLevel = 5;

    const score = p * impactLevel;
    let sev = 'Low';
    let sevColor = '#10B981';
    if (score >= 17) { sev = 'Critical'; sevColor = '#EF4444'; }
    else if (score >= 13) { sev = 'High'; sevColor = '#F97316'; }
    else if (score >= 7) { sev = 'Medium'; sevColor = '#F59E0B'; }

    const emv = (p / 5.0) * impact;

    if (elSev) {
        elSev.textContent = `Score: ${score} (${sev})`;
        elSev.style.color = sevColor;
    }
    if (elExp) {
        elExp.textContent = formatCurrency(emv);
    }
}

async function saveNewRisk(event) {
    event.preventDefault();
    const p = parseInt(document.getElementById('risk_prob').value) || 1;
    const impact = parseFloat(document.getElementById('risk_impact').value) || 0;

    let impactLevel = 1;
    if (impact <= 15000) impactLevel = 1;
    else if (impact <= 30000) impactLevel = 2;
    else if (impact <= 50000) impactLevel = 3;
    else if (impact <= 80000) impactLevel = 4;
    else impactLevel = 5;

    const score = p * impactLevel;
    let sev = 'Medium';
    if (score >= 17) sev = 'Critical';
    else if (score >= 13) sev = 'High';
    else if (score >= 7) sev = 'Medium';
    else sev = 'Low';

    const payload = {
        project_id: parseInt(document.getElementById('risk_project_id').value),
        risk_code: document.getElementById('risk_code').value.trim(),
        description: document.getElementById('risk_desc').value.trim(),
        probability: p,
        impact_cost: impact,
        severity: sev,
        owner: document.getElementById('risk_owner').value.trim() || 'Project Manager'
    };

    try {
        const res = await fetch('/api/risks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to save risk');
        }

        showToast(`Risk ${payload.risk_code} successfully logged to register!`, 'success');
        closeAddRiskModal();
        await loadRisksDashboard();
        await loadPortfolioDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteRisk(riskId) {
    if (!confirm('Are you sure you want to remove this risk from the register?')) return;
    try {
        const res = await fetch(`/api/risks/${riskId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Risk deleted successfully.', 'success');
            await loadRisksDashboard();
            await loadPortfolioDashboard();
        } else {
            showToast('Failed to delete risk.', 'error');
        }
    } catch (e) {
        showToast('Error communicating with server.', 'error');
    }
}

async function openAddCRModal() {
    const form = document.getElementById('formAddCR');
    if (form) form.reset();

    const sel = document.getElementById('cr_project_id');
    const res = await fetch('/api/projects');
    const projs = await res.json();

    if (projs.length === 0) {
        sel.innerHTML = `<option value="">-- No Active Projects Registered --</option>`;
    } else {
        sel.innerHTML = projs.map(p => `<option value="${p.id}">${p.project_code} — ${p.name} (${p.subsidiary_code || ''})</option>`).join('');
    }

    const crCount = (state.risksData && state.risksData.change_requests) ? state.risksData.change_requests.length + 1 : 1;
    const crCodeInput = document.getElementById('cr_code');
    if (crCodeInput) {
        crCodeInput.value = '';
        crCodeInput.placeholder = `e.g. CR-${String(crCount).padStart(3, '0')}`;
    }
    document.getElementById('cr_requested_by').value = '';
    document.getElementById('cr_desc').value = '';
    document.getElementById('cr_cost_impact').value = '';
    document.getElementById('cr_schedule_impact').value = '';
    document.getElementById('cr_status').value = 'Pending';

    document.getElementById('modalAddCR').classList.add('active');
}

function closeAddCRModal() {
    document.getElementById('modalAddCR').classList.remove('active');
}

async function saveNewChangeRequest(event) {
    event.preventDefault();
    const payload = {
        project_id: parseInt(document.getElementById('cr_project_id').value),
        cr_code: document.getElementById('cr_code').value.trim(),
        description: document.getElementById('cr_desc').value.trim(),
        cost_impact: parseFloat(document.getElementById('cr_cost_impact').value) || 0,
        schedule_impact_days: parseInt(document.getElementById('cr_schedule_impact').value) || 0,
        requested_by: document.getElementById('cr_requested_by').value.trim() || 'Client',
        status: document.getElementById('cr_status').value
    };

    try {
        const res = await fetch('/api/change-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to submit change request');
        }

        showToast(`Change Request ${payload.cr_code} submitted successfully!`, 'success');
        closeAddCRModal();
        await loadRisksDashboard();
        await loadPortfolioDashboard();
        await loadFinancialsDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteChangeRequest(crId) {
    if (!confirm('Are you sure you want to delete this change request?')) return;
    try {
        const res = await fetch(`/api/change-requests/${crId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Change request deleted successfully.', 'success');
            await loadRisksDashboard();
            await loadPortfolioDashboard();
            await loadFinancialsDashboard();
        } else {
            showToast('Failed to delete change request.', 'error');
        }
    } catch (e) {
        showToast('Error communicating with server.', 'error');
    }
}


// =========================================================================
// TAB 5: TASKS KANBAN & AFFILIATE RESOURCE CAPACITY LOADER
// =========================================================================
async function loadTasksDashboard() {
    try {
        // Populate project selector based on active global filters
        const projSel = document.getElementById('tasksProjectSelector');
        const projRes = await fetch(`/api/projects?${buildFilterQuery()}`);
        const projs = await projRes.json();
        if (projSel) {
            const currentProjId = projSel.value || '0';
            projSel.innerHTML = '<option value="0">All Matching Projects</option>' +
                projs.map(p => `<option value="${p.id}">${p.project_code} — ${p.name}</option>`).join('');
            projSel.value = projs.some(p => String(p.id) === String(currentProjId)) ? currentProjId : '0';
            projSel.onchange = () => loadTasksDashboard();
        }

        const selectedProjId = projSel ? (parseInt(projSel.value) || 0) : 0;

        const url = `/api/dashboard/tasks?${buildFilterQuery({ project_id: selectedProjId })}`;

        const res = await fetch(url);
        const data = await res.json();

        // Update Top Stat Cards (Kanban counts)
        const elTotal = document.getElementById('taskTotalCount');
        if (elTotal) elTotal.textContent = data.total_items || 0;
        const elCompSub = document.getElementById('taskCompletedSubtitle');
        if (elCompSub) elCompSub.textContent = `${data.completed_count || 0} completed (100% EV credit)`;
        const elInProg = document.getElementById('taskInProgressCount');
        if (elInProg) elInProg.textContent = data.in_progress_count || 0;
        const elBlocked = document.getElementById('taskBlockedCount');
        if (elBlocked) elBlocked.textContent = data.blocked_count || 0;

        ['Backlog', 'In Progress', 'In Review', 'Blocked', 'Completed'].forEach(col => {
            const listEl = document.getElementById(`kanban-${col}`);
            const countEl = document.getElementById(`count-${col}`);
            const items = data.kanban[col] || [];

            countEl.textContent = items.length;
            if (items.length === 0) {
                listEl.innerHTML = `<div style="color:#94A3B8; font-size:0.75rem; text-align:center; padding:1.5rem 0;">No items</div>`;
            } else {
                listEl.innerHTML = items.map(item => `
                    <div class="kanban-card" onclick="advanceTaskStatus(${item.id}, '${item.status}')" title="Click to advance deliverable stage">
                        <div class="kanban-card-title">${item.item_name}</div>
                        <div class="kanban-card-meta">
                            <span><i class="fa-solid fa-code-branch text-blue"></i> <strong>${item.project_code}</strong></span>
                            <span class="badge badge-clean" style="font-size:0.65rem;">${item.weight_pct}% (${formatCurrency(item.planned_ev_dollars || 0)})</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.68rem; color:#64748B; margin-top:0.35rem;">
                            <span><i class="fa-regular fa-calendar"></i> Due: ${item.planned_finish || '—'}</span>
                            <span style="color:var(--accent-blue); font-weight:600;">Advance &rarr;</span>
                        </div>
                    </div>
                `).join('');
            }
        });

        // Load Affiliate Engineering Capacity & Resource Utilization (KPI #24)
        const demandUrl = `/api/dashboard/demand?${buildFilterQuery()}`;
        const demandRes = await fetch(demandUrl);
        const demandData = await demandRes.json();

        const elFte = document.getElementById('taskTotalFTE');
        if (elFte) elFte.textContent = `${demandData.summary.total_active_fte} FTE`;
        const elUtilSub = document.getElementById('taskUtilizationSubtitle');
        if (elUtilSub) elUtilSub.textContent = `${demandData.summary.group_avg_utilization_pct}% of ${demandData.summary.total_headcount} Group Headcount`;

        const demandBadge = document.getElementById('demandSummaryBadge');
        if (demandBadge) demandBadge.textContent = `${demandData.departments.length} Affiliates | ${demandData.summary.total_active_fte} Committed FTEs`;

        const capBody = document.getElementById('demandCapacityTableBody');
        if (capBody) {
            capBody.innerHTML = demandData.departments.map(d => {
                const stBadge = d.status === 'OPTIMAL' ? 'badge-green' :
                                (d.status === 'NEAR_CAPACITY' ? 'badge-amber' :
                                (d.status === 'OVER_ALLOCATED' ? 'badge-red' : 'badge-clean'));
                const barColor = d.utilization_pct > 95 ? '#EF4444' : (d.utilization_pct >= 75 ? '#10B981' : '#0284C7');
                return `
                    <tr>
                        <td><strong>${d.code}</strong> — ${d.name}</td>
                        <td><span class="badge badge-clean">${d.sector}</span></td>
                        <td><strong>${d.active_projects_count}</strong> matching</td>
                        <td>${d.headcount} FTE</td>
                        <td><strong>${d.allocated_fte} FTE</strong></td>
                        <td>${d.available_fte} FTE</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <div style="background:#E2E8F0; border-radius:4px; height:6px; width:80px; overflow:hidden;">
                                    <div style="background:${barColor}; height:100%; width:${Math.min(100, d.utilization_pct)}%;"></div>
                                </div>
                                <strong style="font-size:0.75rem;">${d.utilization_pct}%</strong>
                            </div>
                        </td>
                        <td><span class="badge ${stBadge}">${d.status.replace('_', ' ')}</span></td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading tasks dashboard:', err);
    }
}

async function advanceTaskStatus(itemId, currentStatus) {
    const nextMap = {
        'Backlog': 'In Progress',
        'In Progress': 'In Review',
        'In Review': 'Completed',
        'Blocked': 'In Progress',
        'Completed': 'Backlog'
    };
    const nextStatus = nextMap[currentStatus] || 'In Progress';
    try {
        await fetch(`/api/wbs/${itemId}?status=${encodeURIComponent(nextStatus)}`, { method: 'PATCH' });
        showToast(`WBS Deliverable moved to ${nextStatus} & Earned Value updated`, 'success');
        await loadTasksDashboard();
    } catch (err) {
        showToast('Failed to update task', 'error');
    }
}

// =========================================================================
// TAB 2: FINANCIALS & COMMERCIAL PROFITABILITY LOADER
// =========================================================================
async function loadFinancialsDashboard() {
    try {
        const url = `/api/dashboard/financials?${buildFilterQuery()}`;

        const res = await fetch(url);
        const data = await res.json();
        const s = data.summary;

        document.getElementById('finTotalContract').textContent = formatCurrency(s.total_contract_value);
        const revSub = document.getElementById('finRevisedBACSubtitle');
        if (revSub) {
            revSub.textContent = `Revised BAC: ${formatCurrency(s.total_bac)} (Incl. +${formatCurrency(s.total_approved_cr_cost || 0)} CRs)`;
        }

        const fcstMarginEl = document.getElementById('finForecastMargin');
        if (fcstMarginEl) {
            fcstMarginEl.textContent = `${formatCurrency(s.forecast_margin || 0)} (${(s.forecast_margin_pct || 0).toFixed(1)}%)`;
            fcstMarginEl.className = `stat-value ${(s.forecast_margin || 0) >= 0 ? 'text-green' : 'text-red'}`;
        }
        const planMarginSub = document.getElementById('finPlannedMarginSubtitle');
        if (planMarginSub) {
            planMarginSub.textContent = `Planned Baseline Margin: ${formatCurrency(s.planned_margin || 0)} (${(s.planned_margin_pct || 0).toFixed(1)}%)`;
        }

        document.getElementById('finTotalEV').textContent = formatCurrency(s.total_ev);
        document.getElementById('finTotalAC').textContent = `Actual Spend (AC): ${formatCurrency(s.total_ac)} | CPI: ${(s.cpi || 1.0).toFixed(2)}`;
        document.getElementById('finNetVAC').textContent = formatCurrency(s.net_vac);
        const vacSub = document.getElementById('finVACSubtitle');
        if (vacSub) {
            vacSub.textContent = `Forecast EAC: ${formatCurrency(s.total_eac || 0)} | ETC: ${formatCurrency(s.total_etc || 0)}`;
        }

        const countBadge = document.getElementById('finProjectCountBadge');
        if (countBadge) countBadge.textContent = `${data.projects.length} Active Projects`;

        // Render Charts
        renderContractModelChart(s);
        renderFinancialsComparisonChart(data.projects);

        // Render Full Enterprise Commercial & EVM Ledger Table (All Contract Models)
        const tbody = document.getElementById('finFixedPriceTableBody');
        if (data.projects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="14" class="empty-state"><i class="fa-solid fa-file-invoice-dollar text-blue"></i><p>No active projects registered. Click <strong>+ Register Project</strong> or <strong>Load Sample Data</strong>.</p></td></tr>`;
        } else {
            tbody.innerHTML = data.projects.map(p => {
                const k = p.kpis;
                const crCost = k.approved_cr_cost || 0;
                const fcstMargin = k.forecast_margin !== undefined ? k.forecast_margin : (p.contract_value - k.eac);
                const fcstMarginPct = k.forecast_margin_pct !== undefined ? k.forecast_margin_pct : (p.contract_value > 0 ? ((fcstMargin / p.contract_value) * 100) : 0);
                const marginClass = fcstMargin > 0 ? 'text-green' : (fcstMargin === 0 ? 'text-amber' : 'text-red');
                const commBadge = (fcstMargin >= 0 && k.cpi >= 0.95) ? 'badge-green' : (fcstMargin >= 0 || k.cpi >= 0.90 ? 'badge-amber' : 'badge-red');
                const commLabel = (fcstMargin >= 0 && k.cpi >= 0.95) ? 'PROFITABLE' : (fcstMargin >= 0 ? 'MARGIN SQUEEZE' : 'AT LOSS');

                return `
                    <tr>
                        <td>
                            <a href="javascript:void(0)" onclick="openProjectDetail(${p.id})" style="color:var(--text-primary); text-decoration:none; font-weight:700;">
                                <i class="fa-solid fa-folder-open text-blue"></i> ${p.project_code}
                            </a><br/>
                            <span style="font-size:0.7rem; color:#64748B;">${p.name}</span>
                        </td>
                        <td>
                            <span class="badge badge-clean">${p.subsidiary_code}</span><br/>
                            <span style="font-size:0.68rem; color:#64748B;">${p.project_type}</span>
                        </td>
                        <td><strong>${formatCurrency(p.contract_value)}</strong></td>
                        <td>${formatCurrency(k.original_bac !== undefined ? k.original_bac : p.bac)}</td>
                        <td><span class="${crCost > 0 ? 'text-purple' : 'text-muted'}"><strong>${crCost > 0 ? '+' : ''}${formatCurrency(crCost)}</strong></span></td>
                        <td><strong>${formatCurrency(k.revised_bac !== undefined ? k.revised_bac : p.bac)}</strong></td>
                        <td>${formatCurrency(k.ac)}</td>
                        <td>${formatCurrency(k.ev)}</td>
                        <td><strong class="${k.cpi >= 0.95 ? 'text-green' : (k.cpi >= 0.9 ? 'text-amber' : 'text-red')}">${k.cpi.toFixed(2)}</strong></td>
                        <td><strong class="${k.eac > k.bac ? 'text-red' : 'text-blue'}">${formatCurrency(k.eac)}</strong></td>
                        <td>${formatCurrency(k.etc)}</td>
                        <td><strong class="${k.vac >= 0 ? 'text-green' : 'text-red'}">${k.vac >= 0 ? '+' : ''}${formatCurrency(k.vac)}</strong></td>
                        <td><strong class="${marginClass}">${formatCurrency(fcstMargin)} (${Number(fcstMarginPct).toFixed(1)}%)</strong></td>
                        <td><span class="badge ${commBadge}">${commLabel}</span></td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading financials dashboard:', err);
    }
}

function renderContractModelChart(summary) {
    const ctx = document.getElementById('contractModelChart');
    if (!ctx) return;

    if (state.charts.contractModel) {
        state.charts.contractModel.destroy();
    }

    const fpCount = summary.fixed_price_count || 0;
    const tmCount = summary.tm_count || 0;
    const otherCount = summary.other_count || 0;
    const hasData = (fpCount + tmCount + otherCount) > 0;

    state.charts.contractModel = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: hasData ? ['Fixed-Price Contracts', 'Time & Materials (T&M)', 'Internal / Other'] : ['No Registered Projects'],
            datasets: [{
                data: hasData ? [fpCount, tmCount, otherCount] : [1],
                backgroundColor: hasData ? ['#0284C7', '#10B981', '#7C3AED'] : ['#E2E8F0']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderFinancialsComparisonChart(projects) {
    const ctx = document.getElementById('financialsComparisonChart');
    if (!ctx) return;

    if (state.charts.financialsComparison) {
        state.charts.financialsComparison.destroy();
    }

    const hasData = projects && projects.length > 0;
    const labels = hasData ? projects.map(p => p.project_code) : ['No Projects'];
    const contracts = hasData ? projects.map(p => p.contract_value) : [0];
    const revisedBacs = hasData ? projects.map(p => p.kpis.revised_bac || p.bac) : [0];
    const eacs = hasData ? projects.map(p => p.kpis.eac) : [0];

    state.charts.financialsComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Contract Value ($)', data: contracts, backgroundColor: '#10B981' },
                { label: 'Revised BAC ($)', data: revisedBacs, backgroundColor: '#0284C7' },
                { label: 'Forecast EAC ($)', data: eacs, backgroundColor: '#F59E0B' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => '$' + (v / 1000) + 'k' }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }
            }
        }
    });
}

// =========================================================================
// TAB 3: S-CURVE & CUT-OFF CONTROLLER DASHBOARD LOADER
// =========================================================================
async function loadSCurveDashboard() {
    try {
        // Populate S-Curve project selector based on active global filters
        const selector = document.getElementById('scurveProjectSelector');
        const projRes = await fetch(`/api/projects?${buildFilterQuery()}`);
        const projs = await projRes.json();
        
        const currentVal = selector.value;
        selector.innerHTML = '<option value="0">Consolidated ITG Portfolio S-Curve</option>';
        projs.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.project_code} — ${p.name}`;
            selector.appendChild(opt);
        });
        selector.value = projs.some(p => String(p.id) === String(currentVal)) ? currentVal : '0';

        selector.onchange = () => loadSCurveData(parseInt(selector.value) || 0);
        await loadSCurveData(parseInt(selector.value) || 0);

    } catch (err) {
        console.error('Error loading S-Curve dashboard:', err);
    }
}

async function loadSCurveData(projectId) {
    try {
        const url = `/api/dashboard/scurve?${buildFilterQuery({ project_id: projectId })}`;

        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('scurveChartTitle').innerHTML = `<i class="fa-solid fa-chart-line"></i> Cumulative S-Curve: ${data.project_name}`;

        // Update Top 4 S-Curve Controller Stat Cards from latest snapshot
        const snaps = data.snapshots || [];
        const latest = snaps.length > 0 ? snaps[snaps.length - 1] : null;
        const elPV = document.getElementById('scurveStatPV');
        const elEV = document.getElementById('scurveStatEV');
        const elAC = document.getElementById('scurveStatAC');
        const elVar = document.getElementById('scurveStatVariances');
        const elIndSub = document.getElementById('scurveStatIndicesSub');
        const elPVSub = document.getElementById('scurveStatPVSub');

        if (latest) {
            if (elPV) elPV.textContent = formatCurrency(latest.pv);
            if (elPVSub) elPVSub.textContent = `As of Cut-Off: ${latest.cut_off_date}`;
            if (elEV) elEV.textContent = formatCurrency(latest.ev);
            if (elAC) elAC.textContent = formatCurrency(latest.ac);
            if (elVar) elVar.textContent = `${latest.cv >= 0 ? '+' : ''}${formatCurrency(latest.cv)} / ${latest.sv >= 0 ? '+' : ''}${formatCurrency(latest.sv)}`;
            if (elIndSub) elIndSub.textContent = `CPI: ${Number(latest.cpi).toFixed(2)} | SPI: ${Number(latest.spi).toFixed(2)}`;
        } else {
            if (elPV) elPV.textContent = '$0.00';
            if (elPVSub) elPVSub.textContent = 'No cut-off snapshots recorded';
            if (elEV) elEV.textContent = '$0.00';
            if (elAC) elAC.textContent = '$0.00';
            if (elVar) elVar.textContent = '$0.00 / $0.00';
            if (elIndSub) elIndSub.textContent = 'CPI: 1.00 | SPI: 1.00';
        }

        // Always update the Historical Cut-Off Snapshots Ledger Table (including when 0 snapshots exist)
        renderScurveHistoryTable(snaps, data.project_name);

        const emptyState = document.getElementById('scurveEmptyState');
        const chartContainer = document.getElementById('scurveChartContainer');

        if (!data.labels || data.labels.length === 0) {
            if (emptyState && chartContainer) {
                emptyState.style.display = 'block';
                chartContainer.style.display = 'none';
            }
            if (state.charts.scurve) {
                state.charts.scurve.destroy();
                state.charts.scurve = null;
            }
            return;
        }

        if (emptyState && chartContainer) {
            emptyState.style.display = 'none';
            chartContainer.style.display = 'block';
        }

        const ctx = document.getElementById('scurveChart');
        if (!ctx) return;

        if (state.charts.scurve) {
            state.charts.scurve.destroy();
        }

        const labels = data.labels;
        const pv = data.pv_series;
        const ev = data.ev_series;
        const ac = data.ac_series;

        state.charts.scurve = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Planned Value (PV Baseline)',
                        data: pv,
                        borderColor: '#0284C7',
                        backgroundColor: 'rgba(2, 132, 199, 0.05)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Earned Value (EV Delivered)',
                        data: ev,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Actual Cost (AC Spent)',
                        data: ac,
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => '$' + (value / 1000) + 'k'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}`
                        }
                    }
                }
            }
        });

    } catch (err) {
        console.error('Error loading S-Curve data:', err);
    }
}

function renderScurveHistoryTable(snapshots, projectName) {
    const tbody = document.getElementById('scurveHistoryTableBody');
    const badgeCount = document.getElementById('scurveSnapshotCount');
    const titleEl = document.getElementById('scurveTableTitle');

    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Historical Periodic Cut-Off Snapshots Ledger: <span style="color:var(--text-primary); font-weight:700;">${projectName}</span>`;
    }

    if (badgeCount) {
        badgeCount.textContent = `${snapshots.length} Snapshot${snapshots.length === 1 ? '' : 's'}`;
    }

    if (!tbody) return;

    if (!snapshots || snapshots.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="empty-state" style="padding: 2.5rem 1rem;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:1.8rem; color:var(--text-muted); margin-bottom:0.5rem; display:block;"></i>
                    <p style="color:var(--text-muted); font-size:0.85rem;">No historical periodic cut-off snapshots recorded for this project scope.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = snapshots.map(s => {
        const cpi = parseFloat(s.cpi) || 1.0;
        const spi = parseFloat(s.spi) || 1.0;
        const cpiBadge = cpi >= 0.95 ? 'badge-green' : (cpi >= 0.90 ? 'badge-amber' : 'badge-red');
        const spiBadge = spi >= 0.95 ? 'badge-green' : (spi >= 0.90 ? 'badge-amber' : 'badge-red');
        const cvClass = s.cv >= 0 ? 'text-green' : 'text-red';
        const svClass = s.sv >= 0 ? 'text-green' : 'text-red';
        const progressVal = s.overall_progress_pct !== undefined ? `${Number(s.overall_progress_pct).toFixed(1)}%` : '—';
        const comments = s.pm_comments ? s.pm_comments : '<span style="color:var(--text-muted); font-style:italic;">No PM comment recorded</span>';

        return `
            <tr>
                <td><strong>${s.cut_off_date}</strong></td>
                <td>${formatCurrency(s.pv)}</td>
                <td><strong class="text-green">${formatCurrency(s.ev)}</strong></td>
                <td><strong class="text-amber">${formatCurrency(s.ac)}</strong></td>
                <td><span class="${cvClass}"><strong>${s.cv >= 0 ? '+' : ''}${formatCurrency(s.cv)}</strong></span></td>
                <td><span class="${svClass}"><strong>${s.sv >= 0 ? '+' : ''}${formatCurrency(s.sv)}</strong></span></td>
                <td><span class="badge ${cpiBadge}">${cpi.toFixed(2)}</span></td>
                <td><span class="badge ${spiBadge}">${spi.toFixed(2)}</span></td>
                <td>${s.actual_effort_hours || 0} hrs</td>
                <td>${s.defects_count !== undefined ? s.defects_count : '—'}</td>
                <td><span class="badge badge-clean">${progressVal}</span></td>
                <td style="max-width: 280px; font-size: 0.78rem; line-height: 1.4;">${comments}</td>
            </tr>
        `;
    }).join('');
}

// =========================================================================
// TAB 4: TIMELINE, GANTT PROGRESS & MILESTONES LOADER
// =========================================================================
async function loadTimelineDashboard() {
    try {
        const url = `/api/dashboard/timeline?${buildFilterQuery()}`;

        const res = await fetch(url);
        const data = await res.json();
        const sum = data.summary || {};

        const elTot = document.getElementById('timeTotalItems');
        if (elTot) elTot.textContent = sum.total_items || 0;
        const elComp = document.getElementById('timeCompletedSub');
        if (elComp) elComp.textContent = `${sum.completed_items || 0} completed deliverables`;
        const elAch = document.getElementById('timeAchievementPct');
        if (elAch) elAch.textContent = `${(sum.achievement_pct || 0).toFixed(1)}%`;
        const elDel = document.getElementById('timeDelayedCount');
        if (elDel) elDel.textContent = sum.delayed_projects_count || 0;
        const elMax = document.getElementById('timeMaxSlippage');
        if (elMax) elMax.textContent = `${sum.max_delay_days || 0} days`;

        const countBadge = document.getElementById('timelineCountBadge');
        if (countBadge) countBadge.textContent = `${data.critical_milestones.length} WBS Items`;

        const banner = document.getElementById('slippageBanner');
        if (data.slippages.length > 0) {
            banner.style.display = 'flex';
            document.getElementById('slippageTitle').textContent = `Milestone Slippage Red-Flag Alert (${data.slippages.length} Delayed Projects >30 Days)`;
            document.getElementById('slippageDesc').textContent = data.slippages.map(s => `${s.project_code} is delayed by ${s.delay_days} days (Forecast: ${s.forecast_completion_date})`).join(' | ');
        } else {
            banner.style.display = 'none';
        }

        const tbody = document.getElementById('timelineMilestonesBody');
        if (data.critical_milestones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-calendar-days text-blue"></i><p>No WBS milestones or deliverables registered.</p></td></tr>`;
        } else {
            const stagePctMap = { 'Completed': 100, 'In Review': 80, 'In Progress': 50, 'Blocked': 25, 'Backlog': 0 };
            const stageColorMap = { 'Completed': '#10B981', 'In Review': '#F59E0B', 'In Progress': '#0284C7', 'Blocked': '#EF4444', 'Backlog': '#94A3B8' };

            tbody.innerHTML = data.critical_milestones.map(m => {
                const pct = stagePctMap[m.status] !== undefined ? stagePctMap[m.status] : 0;
                const barColor = stageColorMap[m.status] || '#0284C7';
                const evVal = ((m.weight_pct || 0) / 100.0) * (m.project_bac || 0);
                const isCrit = m.is_critical_path === 1 || m.item_type === 'Milestone';

                return `
                    <tr>
                        <td>
                            <strong>${m.project_code || ''}</strong> — ${m.project_name}<br/>
                            <span class="badge badge-clean" style="font-size:0.65rem;">${m.subsidiary_code || ''}</span>
                        </td>
                        <td><strong>${m.item_name}</strong></td>
                        <td><span class="badge badge-clean">${m.item_type || 'Milestone'}</span></td>
                        <td>
                            <strong>${m.weight_pct}%</strong><br/>
                            <span style="font-size:0.7rem; color:#64748B;">EV: ${formatCurrency(evVal)}</span>
                        </td>
                        <td>
                            <span style="font-size:0.75rem; font-family:'JetBrains Mono', monospace;">${m.planned_start || '—'} &rarr; ${m.planned_finish || '—'}</span>
                        </td>
                        <td style="min-width:150px;">
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <div style="flex:1; background:#E2E8F0; border-radius:4px; height:8px; overflow:hidden;">
                                    <div style="background:${barColor}; height:100%; width:${pct}%; transition:width 0.3s ease;"></div>
                                </div>
                                <strong style="font-size:0.72rem; min-width:32px;">${pct}%</strong>
                            </div>
                        </td>
                        <td><span class="badge ${m.status === 'Completed' ? 'badge-green' : (m.status === 'Blocked' ? 'badge-red' : 'badge-blue')}">${m.status}</span></td>
                        <td>
                            ${isCrit
                                ? '<span class="badge badge-amber"><i class="fa-solid fa-lock"></i> Critical Path</span>'
                                : '<span class="badge badge-clean">Standard WBS</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading timeline dashboard:', err);
    }
}

// =========================================================================
// MODALS CONTROLLER & FORMS
// =========================================================================
function initModals() {
    // Project modal
    const pModal = document.getElementById('modalProject');
    document.getElementById('btnOpenProjectModal').onclick = () => {
        resetProjectModalForm();
        pModal.classList.add('active');
    };
    document.getElementById('btnCloseProjectModal').onclick = () => pModal.classList.remove('active');
    document.getElementById('btnCancelProject').onclick = () => pModal.classList.remove('active');

    // Cut-off modal
    const cModal = document.getElementById('modalCutoff');
    document.getElementById('btnOpenCutoffModal').onclick = async () => {
        await populateCutoffProjectSelect();
        cModal.classList.add('active');
    };
    document.getElementById('btnCloseCutoffModal').onclick = () => cModal.classList.remove('active');
    document.getElementById('btnCancelCutoff').onclick = () => cModal.classList.remove('active');

    // Detail modal
    const dModal = document.getElementById('modalProjectDetail');
    document.getElementById('btnCloseDetailModal').onclick = () => dModal.classList.remove('active');

    // Add WBS row
    document.getElementById('btnAddWbsRow').onclick = () => addWbsInputRow();

    // Register project form submit
    document.getElementById('formRegisterProject').onsubmit = async (e) => {
        e.preventDefault();
        await handleRegisterProjectSubmit();
    };

    // Cut-off form submit
    document.getElementById('formCutoff').onsubmit = async (e) => {
        e.preventDefault();
        await handleCutoffSubmit();
    };

    // Live calculation on Cut-off inputs
    ['c_pv', 'c_ev', 'c_ac'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateLiveCutoffPreview);
    });

    // Start with 1 clean empty WBS row (Zero-Data Principle)
    resetProjectModalForm();
}

function resetProjectModalForm() {
    document.getElementById('formRegisterProject').reset();
    const tbody = document.getElementById('wbsRowsBody');
    tbody.innerHTML = '';
    addWbsInputRow();
}

function addWbsInputRow(name = '', type = 'Milestone', weight = '', start = '', finish = '') {
    const tbody = document.getElementById('wbsRowsBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control wbs-name" value="${name}" placeholder="Milestone / Deliverable Name" required></td>
        <td>
            <select class="form-control wbs-type">
                <option value="Milestone" ${type === 'Milestone' ? 'selected' : ''}>Milestone</option>
                <option value="Deliverable" ${type === 'Deliverable' ? 'selected' : ''}>Deliverable</option>
                <option value="Work Package" ${type === 'Work Package' ? 'selected' : ''}>Work Package</option>
            </select>
        </td>
        <td><input type="number" class="form-control wbs-weight" value="${weight}" placeholder="%" min="1" max="100" required></td>
        <td><input type="date" class="form-control wbs-start" value="${start}"></td>
        <td><input type="date" class="form-control wbs-finish" value="${finish}" required></td>
        <td style="text-align:center;"><button type="button" class="btn btn-sm btn-outline text-red" onclick="this.closest('tr').remove()" title="Remove Row">&times;</button></td>
    `;
    tbody.appendChild(tr);
}

async function handleRegisterProjectSubmit() {
    const wbsRows = document.querySelectorAll('#wbsRowsBody tr');
    const wbsItems = [];
    wbsRows.forEach(r => {
        wbsItems.push({
            item_name: r.querySelector('.wbs-name').value,
            item_type: r.querySelector('.wbs-type').value,
            weight_pct: parseFloat(r.querySelector('.wbs-weight').value) || 0,
            planned_start: r.querySelector('.wbs-start').value,
            planned_finish: r.querySelector('.wbs-finish').value,
            is_critical_path: r.querySelector('.wbs-type').value === 'Milestone' ? 1 : 0
        });
    });

    const payload = {
        project: {
            subsidiary_id: parseInt(document.getElementById('p_subsidiary').value),
            project_code: document.getElementById('p_code').value,
            name: document.getElementById('p_name').value,
            client: document.getElementById('p_client').value,
            pm: document.getElementById('p_pm').value,
            sponsor: document.getElementById('p_sponsor').value,
            project_type: document.getElementById('p_type').value,
            status: document.getElementById('p_status').value,
            baseline_start_date: document.getElementById('p_start').value,
            baseline_end_date: document.getElementById('p_end').value,
            bac: parseFloat(document.getElementById('p_bac').value),
            contract_value: parseFloat(document.getElementById('p_contract').value),
            contingency_reserve: parseFloat(document.getElementById('p_contingency').value) || 0,
            planned_effort_hours: (parseFloat(document.getElementById('p_fte').value) || 1) * 160.0 * 6,
            planned_fte: parseFloat(document.getElementById('p_fte').value) || 1.0
        },
        wbs_items: wbsItems
    };

    try {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());

        showToast('Project registered and baseline locked successfully!', 'success');
        document.getElementById('modalProject').classList.remove('active');
        document.getElementById('formRegisterProject').reset();
        await refreshActiveTab();
    } catch (err) {
        showToast(`Registration failed: ${err.message}`, 'error');
    }
}

async function populateCutoffProjectSelect() {
    const form = document.getElementById('formCutoff');
    if (form) form.reset();

    // Reset live preview box to clean state
    document.getElementById('prevCPI').textContent = '-';
    document.getElementById('prevSPI').textContent = '-';
    document.getElementById('prevCV').textContent = '-';
    document.getElementById('prevSV').textContent = '-';
    const ragBadge = document.getElementById('prevRAG');
    if (ragBadge) {
        ragBadge.className = 'badge';
        ragBadge.textContent = '-';
    }

    const progInput = document.getElementById('c_progress_pct');
    if (progInput) {
        delete progInput.dataset.manual;
        progInput.oninput = () => { progInput.dataset.manual = 'true'; };
    }

    const sel = document.getElementById('c_project_id');
    const res = await fetch('/api/projects');
    const projs = await res.json();
    state.cutoffProjects = projs;

    const availInput = document.getElementById('c_available_hours');
    const effortInput = document.getElementById('c_effort');

    if (projs.length === 0) {
        sel.innerHTML = `<option value="">-- No Active Projects Registered --</option>`;
        document.getElementById('c_date').value = '';
        document.getElementById('c_forecast_date').value = '';
        if (availInput) availInput.placeholder = 'e.g. 160';
        if (effortInput) effortInput.placeholder = 'e.g. 160';
        return;
    }

    sel.innerHTML = projs.map(p => `<option value="${p.id}">${p.project_code} — ${p.name} (Revised BAC: ${formatCurrency(p.kpis.revised_bac || p.bac)})</option>`).join('');
    document.getElementById('c_date').value = new Date().toISOString().split('T')[0];

    const syncProjectDefaults = (proj) => {
        if (!proj) return;
        const revEnd = (proj.kpis && proj.kpis.revised_baseline_end_date) || proj.baseline_end_date;
        if (revEnd) {
            document.getElementById('c_forecast_date').value = revEnd;
        }
        const fteHours = Math.round((proj.planned_fte || 1) * 160);
        if (availInput) availInput.placeholder = `e.g. ${fteHours} (${proj.planned_fte || 1} FTE × 160h)`;
        if (effortInput) effortInput.placeholder = `e.g. ${fteHours}`;
    };

    syncProjectDefaults(projs[0]);

    sel.onchange = () => {
        const selected = projs.find(p => p.id === parseInt(sel.value));
        syncProjectDefaults(selected);
        updateLiveCutoffPreview();
    };
}

function autoFillEvFromWbs() {
    const sel = document.getElementById('c_project_id');
    const projs = state.cutoffProjects || [];
    const selected = projs.find(p => p.id === parseInt(sel.value));
    if (!selected || !selected.kpis) {
        showToast('Please select an active project first.', 'error');
        return;
    }

    const revBac = selected.kpis.revised_bac || selected.bac || 0;
    const wbsEv = selected.kpis.wbs_earned_value || 0;
    const wbsPct = selected.kpis.wbs_progress_pct || 0;

    // 1. Smart Time-Phased PV Calculation from Cut-Off Date & Baseline Dates
    let smartPv = selected.kpis.smart_pv_estimate || selected.kpis.pv || wbsEv;
    const cutoffDateVal = document.getElementById('c_date').value;
    const startStr = selected.baseline_start_date;
    const endStr = selected.kpis.revised_baseline_end_date || selected.baseline_end_date;

    if (cutoffDateVal && startStr && endStr && revBac > 0) {
        const dCut = new Date(cutoffDateVal);
        const dStart = new Date(startStr);
        const dEnd = new Date(endStr);
        const totalMs = Math.max(86400000, dEnd - dStart);
        const elapsedMs = Math.max(0, Math.min(totalMs, dCut - dStart));
        const ratio = elapsedMs / totalMs;
        smartPv = Math.round(revBac * ratio);
    }

    document.getElementById('c_pv').value = smartPv;
    document.getElementById('c_ev').value = wbsEv;

    const progInput = document.getElementById('c_progress_pct');
    if (progInput) {
        progInput.value = wbsPct;
        progInput.dataset.manual = 'true';
    }

    // 2. Smart SPI-Projected Forecast Finish Date Calculation
    const forecastInput = document.getElementById('c_forecast_date');
    if (forecastInput && startStr && endStr) {
        const spiEst = smartPv > 0 ? Math.max(0.25, wbsEv / smartPv) : 1.0;
        const dStart = new Date(startStr);
        const dEnd = new Date(endStr);
        const origDays = Math.max(1, Math.round((dEnd - dStart) / 86400000));
        const projDays = Math.round(origDays / spiEst);
        const dProjEnd = new Date(dStart.getTime() + projDays * 86400000);
        forecastInput.value = dProjEnd.toISOString().split('T')[0];
    }

    updateLiveCutoffPreview();
    showToast(`Smart Auto-Computed PV (${formatCurrency(smartPv)}), WBS EV (${formatCurrency(wbsEv)}), Progress (${wbsPct}%) & Forecast Finish Date!`, 'success');
}

function updateLiveCutoffPreview() {
    const pv = parseFloat(document.getElementById('c_pv').value) || 0;
    const ev = parseFloat(document.getElementById('c_ev').value) || 0;
    const ac = parseFloat(document.getElementById('c_ac').value) || 0;

    const cpi = ac > 0 ? (ev / ac).toFixed(2) : '1.00';
    const spi = pv > 0 ? (ev / pv).toFixed(2) : '1.00';
    const cv = (ev - ac).toLocaleString();
    const sv = (ev - pv).toLocaleString();

    document.getElementById('prevCPI').textContent = cpi;
    document.getElementById('prevSPI').textContent = spi;
    document.getElementById('prevCV').textContent = `$${cv}`;
    document.getElementById('prevSV').textContent = `$${sv}`;

    const ragBadge = document.getElementById('prevRAG');
    if (parseFloat(cpi) >= 0.95 && parseFloat(spi) >= 0.95) {
        ragBadge.className = 'badge badge-green';
        ragBadge.textContent = 'HEALTHY (GREEN)';
    } else if (parseFloat(cpi) >= 0.90 && parseFloat(spi) >= 0.90) {
        ragBadge.className = 'badge badge-amber';
        ragBadge.textContent = 'AT RISK (AMBER)';
    } else {
        ragBadge.className = 'badge badge-red';
        ragBadge.textContent = 'CRITICAL (RED)';
    }

    // Auto-calculate physical progress % if user hasn't manually overridden
    const sel = document.getElementById('c_project_id');
    const projs = state.cutoffProjects || [];
    const selected = projs.find(p => p.id === parseInt(sel.value));
    const progInput = document.getElementById('c_progress_pct');
    if (selected && selected.bac > 0 && ev > 0 && progInput && !progInput.dataset.manual) {
        progInput.value = Math.min(100, Math.round((ev / selected.bac) * 100 * 10) / 10);
    }
}

async function handleCutoffSubmit() {
    const payload = {
        project_id: parseInt(document.getElementById('c_project_id').value),
        cut_off_date: document.getElementById('c_date').value,
        pv: parseFloat(document.getElementById('c_pv').value),
        ev: parseFloat(document.getElementById('c_ev').value),
        ac: parseFloat(document.getElementById('c_ac').value),
        overall_progress_pct: parseFloat(document.getElementById('c_progress_pct').value) || 0.0,
        actual_effort_hours: parseFloat(document.getElementById('c_effort').value) || 0,
        available_hours: parseFloat(document.getElementById('c_available_hours').value) || 160,
        rework_effort_hours: parseFloat(document.getElementById('c_rework').value) || 0,
        deliverables_submitted: parseInt(document.getElementById('c_deliverables_submitted').value) || 0,
        deliverables_accepted: parseInt(document.getElementById('c_deliverables_accepted').value) || 0,
        defects_count: parseInt(document.getElementById('c_defects').value) || 0,
        forecast_completion_date: document.getElementById('c_forecast_date').value || null,
        pm_comments: document.getElementById('c_comments').value
    };

    try {
        const res = await fetch('/api/cutoffs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());

        showToast('Monthly cut-off snapshot saved & KPIs recalculated!', 'success');
        document.getElementById('modalCutoff').classList.remove('active');
        await refreshActiveTab();
    } catch (err) {
        showToast(`Submission failed: ${err.message}`, 'error');
    }
}

// =========================================================================
// PROJECT DETAIL & 25-KPI AUDIT MODAL
// =========================================================================
async function openProjectDetail(projectId) {
    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        const k = p.kpis;

        let velBadge = `<span class="badge badge-blue" style="margin-left:0.5rem;"><i class="fa-solid fa-calendar-check"></i> ON TRACK (${k.schedule_label || 'On Schedule'})</span>`;
        if (k.schedule_bucket === 'ADVANCED') {
            velBadge = `<span class="badge badge-green" style="margin-left:0.5rem;"><i class="fa-solid fa-rocket"></i> ADVANCED (${k.schedule_label || 'Ahead'})</span>`;
        } else if (k.schedule_bucket === 'DELAYED') {
            const cls = k.delay_days > 30 ? 'badge-red' : 'badge-amber';
            velBadge = `<span class="badge ${cls}" style="margin-left:0.5rem;"><i class="fa-solid fa-clock-rotate-left"></i> DELAYED (${k.schedule_label || 'Delayed'})</span>`;
        }

        document.getElementById('detailProjectTitle').innerHTML = `
            <i class="fa-solid fa-folder-open"></i> ${p.project_code} — ${p.name}
            <span class="badge ${getRagBadgeClass(k.rag_status)}" style="margin-left:0.75rem;">${k.rag_status}</span>
            ${velBadge}
        `;

        const body = document.getElementById('detailModalBody');
        body.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(5, 1fr); margin-bottom:1rem;">
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Revised BAC</div>
                    <div style="font-size:1.1rem; font-weight:800;">${formatCurrency(k.revised_bac || p.bac)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Actual Cost (AC)</div>
                    <div style="font-size:1.1rem; font-weight:800; color:#D97706;">${formatCurrency(k.ac)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Earned Value (EV)</div>
                    <div style="font-size:1.1rem; font-weight:800; color:#059669;">${formatCurrency(k.ev)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Estimate at Completion (EAC)</div>
                    <div style="font-size:1.1rem; font-weight:800; color:${k.eac > (k.revised_bac || p.bac) ? '#DC2626' : '#2563EB'};">${formatCurrency(k.eac)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Schedule Status</div>
                    <div style="font-size:0.95rem; font-weight:800; color:${k.schedule_bucket === 'ADVANCED' ? '#059669' : (k.schedule_bucket === 'DELAYED' ? '#DC2626' : '#0284C7')};">${k.schedule_bucket}: ${k.schedule_label}</div>
                </div>
            </div>

            <div class="section-title-row">
                <h4><i class="fa-solid fa-calculator"></i> 25 KPI Mathematical Audit Ledger</h4>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>KPI Metric</th>
                            <th>Formula</th>
                            <th>Calculated Value</th>
                            <th>RAG Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Category 1: Schedule & Progress (KPIs 1 - 7) -->
                        <tr style="background:var(--bg-card); font-weight:700;"><td colspan="5" style="color:var(--text-primary); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; padding:0.6rem 0.75rem;"><i class="fa-solid fa-clock text-blue"></i> Schedule & Progress Performance (KPIs 1 – 7)</td></tr>
                        <tr><td>1</td><td>Overall Progress %</td><td>(Comp. Work / Total Work) * 100</td><td><strong>${k.overall_progress_pct}%</strong></td><td><span class="badge badge-clean">TRACKED</span></td></tr>
                        <tr><td>2</td><td>Progress Variance %</td><td>Actual Progress % - Planned Progress %</td><td><strong>${k.progress_variance_pct}%</strong></td><td><span class="badge ${k.progress_variance_pct >= 0 ? 'badge-green' : (k.progress_variance_pct >= -10 ? 'badge-amber' : 'badge-red')}">${k.progress_variance_pct >= 0 ? 'ON TRACK' : 'BEHIND'}</span></td></tr>
                        <tr><td>3</td><td>Schedule Variance (SV)</td><td>EV - PV</td><td><strong>${formatCurrency(k.sv)}</strong></td><td><span class="badge ${k.sv >= 0 ? 'badge-green' : 'badge-red'}">${k.sv >= 0 ? 'AHEAD' : 'BEHIND'}</span></td></tr>
                        <tr><td>4</td><td>Schedule Variance % (SV %)</td><td>((EV - PV) / PV) * 100</td><td><strong>${k.sv_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_sv_pct || (k.sv_pct >= -5 ? 'GREEN' : (k.sv_pct >= -10 ? 'AMBER' : 'RED')))}">${k.rag_sv_pct || (k.sv_pct >= -5 ? 'GREEN' : (k.sv_pct >= -10 ? 'AMBER' : 'RED'))}</span></td></tr>
                        <tr><td>5</td><td>SPI (Schedule Performance Index)</td><td>EV / PV</td><td><strong>${k.spi.toFixed(2)}</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_spi)}">${k.rag_spi}</span></td></tr>
                        <tr><td>6</td><td>Milestone Achievement %</td><td>(Achieved Milestones / Due Milestones) * 100</td><td><strong>${k.milestone_achievement_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_milestone || (k.milestone_achievement_pct >= 95 ? 'GREEN' : (k.milestone_achievement_pct >= 85 ? 'AMBER' : 'RED')))}">${k.rag_milestone || (k.milestone_achievement_pct >= 95 ? 'GREEN' : (k.milestone_achievement_pct >= 85 ? 'AMBER' : 'RED'))}</span></td></tr>
                        <tr><td>7</td><td>Schedule Delay (Days)</td><td>Forecast Finish Date - Baseline Finish Date</td><td><strong>${k.delay_days} days</strong></td><td><span class="badge ${k.delay_days <= 0 ? 'badge-green' : (k.delay_days <= 30 ? 'badge-amber' : 'badge-red')}">${k.delay_days <= 0 ? 'ON TIME' : (k.delay_days <= 30 ? 'MODERATE DELAY' : 'CRITICAL DELAY')}</span></td></tr>

                        <!-- Category 2: Cost & Financial Performance (KPIs 8 - 15) -->
                        <tr style="background:var(--bg-card); font-weight:700;"><td colspan="5" style="color:var(--text-primary); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; padding:0.6rem 0.75rem;"><i class="fa-solid fa-coins text-amber"></i> Cost & Budget Performance (KPIs 8 – 15)</td></tr>
                        <tr><td>8</td><td>Cost Variance (CV)</td><td>EV - AC</td><td><strong>${formatCurrency(k.cv)}</strong></td><td><span class="badge ${k.cv >= 0 ? 'badge-green' : 'badge-red'}">${k.cv >= 0 ? 'UNDER BUDGET' : 'OVER BUDGET'}</span></td></tr>
                        <tr><td>9</td><td>Cost Variance % (CV %)</td><td>((EV - AC) / EV) * 100</td><td><strong>${k.cv_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_cv_pct || (k.cv_pct >= -5 ? 'GREEN' : (k.cv_pct >= -10 ? 'AMBER' : 'RED')))}">${k.rag_cv_pct || (k.cv_pct >= -5 ? 'GREEN' : (k.cv_pct >= -10 ? 'AMBER' : 'RED'))}</span></td></tr>
                        <tr><td>10</td><td>CPI (Cost Performance Index)</td><td>EV / AC</td><td><strong>${k.cpi.toFixed(2)}</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_cpi)}">${k.rag_cpi}</span></td></tr>
                        <tr><td>11</td><td>Budget Consumed %</td><td>(AC / BAC) * 100</td><td><strong>${p.bac > 0 ? ((k.ac / p.bac) * 100).toFixed(1) : '0.0'}%</strong></td><td><span class="badge ${(k.ac / (p.bac || 1) * 100) <= k.overall_progress_pct ? 'badge-green' : ((k.ac / (p.bac || 1) * 100) <= k.overall_progress_pct + 15 ? 'badge-amber' : 'badge-red')}">${(k.ac / (p.bac || 1) * 100) <= k.overall_progress_pct ? 'IN PACE' : 'OVER PACED'}</span></td></tr>
                        <tr><td>12</td><td>Estimate at Completion (EAC)</td><td>BAC / CPI</td><td><strong>${formatCurrency(k.eac)}</strong></td><td><span class="badge ${k.eac <= p.bac ? 'badge-green' : 'badge-red'}">${k.eac <= p.bac ? 'WITHIN BUDGET' : 'OVERRUN'}</span></td></tr>
                        <tr><td>13</td><td>Estimate to Complete (ETC)</td><td>EAC - AC</td><td><strong>${formatCurrency(k.etc)}</strong></td><td><span class="badge badge-clean">ESTIMATED</span></td></tr>
                        <tr><td>14</td><td>Variance at Completion (VAC)</td><td>BAC - EAC</td><td><strong>${formatCurrency(k.vac)}</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_vac)}">${k.rag_vac}</span></td></tr>
                        <tr><td>15</td><td>Forecast Accuracy %</td><td>(1 - |EAC - (AC + ETC)| / EAC) * 100</td><td><strong>${k.eac_accuracy_pct}%</strong></td><td><span class="badge ${k.eac_accuracy_pct >= 90 ? 'badge-green' : 'badge-amber'}">${k.eac_accuracy_pct >= 90 ? 'RELIABLE' : 'DRIFT'}</span></td></tr>

                        <!-- Category 3: Scope Deliverables & Quality Gates (KPIs 16 - 21) -->
                        <tr style="background:var(--bg-card); font-weight:700;"><td colspan="5" style="color:var(--text-primary); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; padding:0.6rem 0.75rem;"><i class="fa-solid fa-clipboard-check text-purple"></i> Scope Deliverables & Quality Gates (KPIs 16 – 21)</td></tr>
                        <tr><td>16</td><td>Deliverable Complete %</td><td>(Completed Deliverables / Total Deliverables) * 100</td><td><strong>${k.deliverable_complete_pct}%</strong></td><td><span class="badge badge-clean">TRACKED</span></td></tr>
                        <tr><td>17</td><td>Change Request Rate %</td><td>(Approved CRs / Baseline Items) * 100</td><td><strong>${k.change_request_rate_pct}%</strong></td><td><span class="badge ${k.change_request_rate_pct <= 15 ? 'badge-green' : (k.change_request_rate_pct <= 30 ? 'badge-amber' : 'badge-red')}">${k.change_request_rate_pct <= 15 ? 'STABLE SCOPE' : 'SCOPE CREEP'}</span></td></tr>
                        <tr><td>18</td><td>Change Budget Impact %</td><td>(Total Approved CR Cost / BAC) * 100</td><td><strong>${k.cr_budget_impact_pct}%</strong></td><td><span class="badge ${k.cr_budget_impact_pct <= 5 ? 'badge-green' : (k.cr_budget_impact_pct <= 10 ? 'badge-amber' : 'badge-red')}">${k.cr_budget_impact_pct <= 5 ? 'MINIMAL' : 'SIGNIFICANT'}</span></td></tr>
                        <tr><td>19</td><td>First-Time Acceptance %</td><td>(Accepted Deliverables / Submitted) * 100</td><td><strong>${k.first_time_accept_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_quality)}">${k.rag_quality}</span></td></tr>
                        <tr><td>20</td><td>Defect Rate</td><td>Defects Count / Submitted Deliverables</td><td><strong>${k.defect_rate}</strong></td><td><span class="badge ${k.defect_rate <= 0.2 ? 'badge-green' : (k.defect_rate <= 0.5 ? 'badge-amber' : 'badge-red')}">${k.defect_rate <= 0.2 ? 'CONTROLLED' : 'HIGH DEFECTS'}</span></td></tr>
                        <tr><td>21</td><td>Rework %</td><td>(Rework Effort Hours / Actual Hours) * 100</td><td><strong>${k.rework_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_rework)}">${k.rag_rework}</span></td></tr>

                        <!-- Category 4: Risk, Capacity & Workforce Utilization (KPIs 22 - 25) -->
                        <tr style="background:var(--bg-card); font-weight:700;"><td colspan="5" style="color:var(--text-primary); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; padding:0.6rem 0.75rem;"><i class="fa-solid fa-users-gear text-emerald"></i> Risk, Capacity & Workforce Utilization (KPIs 22 – 25)</td></tr>
                        <tr><td>22</td><td>Risk Exposure ($)</td><td>&sum; (Probability &times; Impact Cost)</td><td><strong>${formatCurrency(k.risk_exposure_dollars)}</strong></td><td><span class="badge ${k.risk_exposure_dollars <= (p.contingency_reserve || 10000) ? 'badge-green' : 'badge-red'}">${k.risk_exposure_dollars <= (p.contingency_reserve || 10000) ? 'RESERVE ADEQUATE' : 'RESERVE DEFICIT'}</span></td></tr>
                        <tr><td>23</td><td>Issue Closure Rate %</td><td>(Closed Issues / Total Issues) * 100</td><td><strong>${k.issue_closure_rate_pct}%</strong></td><td><span class="badge ${k.issue_closure_rate_pct >= 80 ? 'badge-green' : 'badge-amber'}">${k.issue_closure_rate_pct >= 80 ? 'RESOLVED' : 'BACKLOG'}</span></td></tr>
                        <tr><td>24</td><td>Resource Utilization %</td><td>(Productive Effort / Available Hours) * 100</td><td><strong>${k.resource_utilization_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_utilization)}">${k.rag_utilization}</span></td></tr>
                        <tr><td>25</td><td>Effort Variance %</td><td>((Actual Effort - Planned Effort) / Planned) * 100</td><td><strong>${k.effort_variance_pct}%</strong></td><td><span class="badge ${(k.effort_variance_pct || 0) <= 0 ? 'badge-green' : ((k.effort_variance_pct || 0) <= 15 ? 'badge-amber' : 'badge-red')}">${(k.effort_variance_pct || 0) <= 0 ? 'EFFICIENT' : 'EFFORT OVERRUN'}</span></td></tr>
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('modalProjectDetail').classList.add('active');
    } catch (err) {
        showToast('Error opening project details', 'error');
    }
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================
function formatCurrency(num) {
    if (num === undefined || num === null) return '$0.00';
    return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRagBadgeClass(rag) {
    if (!rag) return 'badge-clean';
    const r = rag.toUpperCase();
    if (r === 'GREEN') return 'badge-green';
    if (r === 'AMBER') return 'badge-amber';
    return 'badge-red';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

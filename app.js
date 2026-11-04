/**
 * ITG HOLDING ENTERPRISE DECISION SYSTEM — DASHBOARD CLIENT ENGINE
 * Handles tab navigation, dynamic multi-tier filtering, API data fetching,
 * interactive Chart.js visualizations, Kanban workflow, and modal forms.
 */

// Global Application State
const state = {
    currentTab: 'portfolio',
    subsidiaryId: 0,
    ragStatus: 'All',
    lifecycleStatus: 'All',
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
// FILTERS CONTROLLER (TIER 1 PERSISTENT FILTERS)
// =========================================================================
function initFilters() {
    const subSelect = document.getElementById('subsidiaryFilter');
    subSelect.addEventListener('change', (e) => {
        state.subsidiaryId = parseInt(e.target.value) || 0;
        refreshActiveTab();
    });

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
        if (!confirm('Reset application to clean Zero-Data state? All projects will be wiped.')) return;
        try {
            const res = await fetch('/api/demo/reset', { method: 'POST' });
            const data = await res.json();
            showToast(data.message, 'success');
            await refreshActiveTab();
        } catch (err) {
            showToast('Failed to reset system', 'error');
        }
    });
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
// TAB 1: PORTFOLIO OVERVIEW LOADER
// =========================================================================
async function loadPortfolioDashboard() {
    try {
        let url = `/api/dashboard/portfolio?`;
        if (state.subsidiaryId > 0) url += `subsidiary_id=${state.subsidiaryId}&`;
        if (state.ragStatus !== 'All') url += `rag_status=${state.ragStatus}&`;

        const res = await fetch(url);
        const data = await res.json();

        // Update Stat Cards
        const rollup = data.rollup;
        document.getElementById('kpiTotalProjects').textContent = rollup.total_projects;
        document.getElementById('kpiGroupBAC').textContent = formatCurrency(rollup.group_bac);
        document.getElementById('kpiBurnRate').textContent = `${rollup.group_budget_consumed_pct}%`;
        document.getElementById('kpiActualCost').textContent = `${formatCurrency(rollup.group_ac)} actual spent`;
        document.getElementById('kpiIndices').textContent = `${rollup.group_cpi.toFixed(2)} / ${rollup.group_spi.toFixed(2)}`;
        document.getElementById('kpiOverrunExposure').textContent = `Exposure: ${formatCurrency(rollup.group_overrun_exposure)}`;
        document.getElementById('kpiPipelineCount').textContent = `${rollup.health_distribution.healthy} Healthy, ${rollup.health_distribution.at_risk} At Risk, ${rollup.health_distribution.critical} Critical`;

        // Render Projects Table
        const tbody = document.getElementById('projectsTableBody');
        tbody.innerHTML = '';

        if (data.projects.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="empty-state">
                        <i class="fa-solid fa-folder-open text-blue"></i>
                        <p>No projects registered for selected filter. Click <strong>+ Register Project</strong> or <strong>Load Sample Data</strong>.</p>
                    </td>
                </tr>`;
        } else {
            data.projects.forEach(p => {
                const tr = document.createElement('tr');
                const k = p.kpis;
                tr.innerHTML = `
                    <td><span class="badge ${getRagBadgeClass(k.rag_status)}">${k.rag_status}</span></td>
                    <td>
                        <strong>${p.project_code}</strong><br/>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${p.name}</span>
                    </td>
                    <td><span class="badge badge-clean">${p.subsidiary_code}</span></td>
                    <td>${p.pm}</td>
                    <td>${p.project_type}</td>
                    <td>${formatCurrency(p.bac)}</td>
                    <td>${formatCurrency(k.ac)}</td>
                    <td>
                        <div style="font-weight:700;">${k.overall_progress_pct}%</div>
                        <div style="background:#E2E8F0; border-radius:4px; height:5px; width:60px;">
                            <div style="background:#0284C7; height:5px; border-radius:4px; width:${Math.min(100, k.overall_progress_pct)}%;"></div>
                        </div>
                    </td>
                    <td><strong class="${k.cpi >= 0.95 ? 'text-green' : (k.cpi >= 0.9 ? 'text-amber' : 'text-red')}">${k.cpi.toFixed(2)}</strong></td>
                    <td><strong class="${k.spi >= 0.95 ? 'text-green' : (k.spi >= 0.9 ? 'text-amber' : 'text-red')}">${k.spi.toFixed(2)}</strong></td>
                    <td>${k.forecast_completion_date || p.baseline_end_date}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="openProjectDetail(${p.id})"><i class="fa-solid fa-eye"></i> Audit</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Render Subsidiary Health Chart
        renderSubsidiaryHealthChart(data.subsidiary_breakdown);

        // Render Executive Alerts
        renderExecutiveAlerts(data.projects);

    } catch (err) {
        console.error('Error loading portfolio dashboard:', err);
    }
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
    const alerts = [];

    projects.forEach(p => {
        const k = p.kpis;
        if (k.delay_days > 30) {
            alerts.push({
                type: 'delay',
                code: p.project_code,
                name: p.name,
                msg: `Critical Milestone Slippage: ${k.delay_days} days overdue past baseline!`
            });
        }
        if (k.cpi < 0.90) {
            alerts.push({
                type: 'cost',
                code: p.project_code,
                name: p.name,
                msg: `Severe Cost Overrun: CPI is ${k.cpi.toFixed(2)} (EAC exceeds budget by ${formatCurrency(Math.abs(k.vac))})`
            });
        }
    });

    badge.textContent = `${alerts.length} Alerts`;
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-check" style="color:var(--rag-green)"></i>
                <p>All active projects are operating within acceptable EVM tolerance thresholds.</p>
            </div>`;
    } else {
        container.innerHTML = alerts.map(a => `
            <div class="alert-banner" style="margin-bottom:0.5rem; padding:0.5rem 0.75rem;">
                <div class="alert-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="alert-content">
                    <h4 style="font-size:0.78rem;">${a.code} — ${a.name}</h4>
                    <p style="font-size:0.72rem;">${a.msg}</p>
                </div>
            </div>
        `).join('');
    }
}

// =========================================================================
// TAB 2: RISKS & GOVERNANCE REGISTER LOADER
// =========================================================================
async function loadRisksDashboard() {
    try {
        let url = `/api/dashboard/risks?`;
        if (state.subsidiaryId > 0) url += `subsidiary_id=${state.subsidiaryId}`;

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
            actionBtn = `<button class="btn btn-sm btn-outline" onclick="updateRiskStatus(${r.id}, 'Mitigated')"><i class="fa-solid fa-shield"></i> Mitigate</button>`;
        } else if (r.status === 'Mitigated') {
            actionBtn = `<button class="btn btn-sm btn-outline" onclick="updateRiskStatus(${r.id}, 'Closed')"><i class="fa-solid fa-lock"></i> Close</button>`;
        } else {
            actionBtn = `<button class="btn btn-sm btn-outline" onclick="updateRiskStatus(${r.id}, 'Open')"><i class="fa-solid fa-rotate-left"></i> Re-open</button>`;
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
                <div class="cr-action-group">
                    <button class="btn-action-approve" onclick="updateChangeRequestStatus(${cr.id}, 'Approved')" title="Approve this change request"><i class="fa-solid fa-check"></i> Approve</button>
                    <button class="btn-action-reject" onclick="updateChangeRequestStatus(${cr.id}, 'Rejected')" title="Reject this change request"><i class="fa-solid fa-xmark"></i> Reject</button>
                </div>
            `;
        } else {
            actions = `<span class="badge badge-clean"><i class="fa-solid fa-check-double"></i> Resolved</span>`;
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
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to update risk.', 'error');
        }
    } catch (e) {
        showToast('Error communicating with server.', 'error');
    }
}


// =========================================================================
// TAB 3: TASKS KANBAN LOADER
// =========================================================================
async function loadTasksDashboard() {
    try {
        let url = `/api/dashboard/tasks?`;
        if (state.subsidiaryId > 0) url += `subsidiary_id=${state.subsidiaryId}`;

        const res = await fetch(url);
        const data = await res.json();

        ['Backlog', 'In Progress', 'In Review', 'Blocked', 'Completed'].forEach(col => {
            const listEl = document.getElementById(`kanban-${col}`);
            const countEl = document.getElementById(`count-${col}`);
            const items = data.kanban[col] || [];

            countEl.textContent = items.length;
            if (items.length === 0) {
                listEl.innerHTML = `<div style="color:#94A3B8; font-size:0.75rem; text-align:center; padding:1.5rem 0;">No items</div>`;
            } else {
                listEl.innerHTML = items.map(item => `
                    <div class="kanban-card" onclick="advanceTaskStatus(${item.id}, '${item.status}')">
                        <div class="kanban-card-title">${item.item_name}</div>
                        <div class="kanban-card-meta">
                            <span><i class="fa-solid fa-code-branch"></i> ${item.project_code}</span>
                            <span>${item.weight_pct}% Weight</span>
                        </div>
                        <div style="font-size:0.68rem; color:#64748B; margin-top:0.25rem;">Due: ${item.planned_finish}</div>
                    </div>
                `).join('');
            }
        });
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
        showToast(`Task moved to ${nextStatus}`, 'success');
        await loadTasksDashboard();
    } catch (err) {
        showToast('Failed to update task', 'error');
    }
}

// =========================================================================
// TAB 4: FINANCIALS DASHBOARD LOADER
// =========================================================================
async function loadFinancialsDashboard() {
    try {
        let url = `/api/dashboard/financials?`;
        if (state.subsidiaryId > 0) url += `subsidiary_id=${state.subsidiaryId}`;

        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('finTotalContract').textContent = formatCurrency(data.summary.total_contract_value);
        document.getElementById('finTotalEV').textContent = formatCurrency(data.summary.total_ev);
        document.getElementById('finTotalAC').textContent = formatCurrency(data.summary.total_ac);
        document.getElementById('finNetVAC').textContent = formatCurrency(data.summary.net_vac);

        // Render Contract Model Chart
        renderContractModelChart(data.summary);

        // Render Fixed Price Table
        const tbody = document.getElementById('finFixedPriceTableBody');
        const fpProjects = data.projects.filter(p => p.project_type === 'Fixed-Price');
        if (fpProjects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><p>No Fixed-Price contracts registered.</p></td></tr>`;
        } else {
            tbody.innerHTML = fpProjects.map(p => `
                <tr>
                    <td><strong>${p.project_code}</strong><br/><span style="font-size:0.7rem; color:#64748B;">${p.name}</span></td>
                    <td>${formatCurrency(p.contract_value)}</td>
                    <td>${formatCurrency(p.bac)}</td>
                    <td>${formatCurrency(p.kpis.ac)}</td>
                    <td>${formatCurrency(p.kpis.ev)}</td>
                    <td><strong class="${p.kpis.cpi >= 0.95 ? 'text-green' : (p.kpis.cpi >= 0.9 ? 'text-amber' : 'text-red')}">${p.kpis.cpi.toFixed(2)}</strong></td>
                    <td><span class="badge ${getRagBadgeClass(p.kpis.rag_cpi)}">${p.kpis.rag_cpi === 'GREEN' ? 'PROFITABLE' : (p.kpis.rag_cpi === 'AMBER' ? 'MARGIN SQUEEZE' : 'AT LOSS')}</span></td>
                </tr>
            `).join('');
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
    const hasData = (fpCount + tmCount) > 0;

    state.charts.contractModel = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: hasData ? ['Fixed-Price Engagements', 'Time & Materials Engagements'] : ['No Registered Projects'],
            datasets: [{
                data: hasData ? [fpCount, tmCount] : [1],
                backgroundColor: hasData ? ['#0284C7', '#10B981'] : ['#E2E8F0']
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

// =========================================================================
// TAB 5: S-CURVE DASHBOARD LOADER
// =========================================================================
async function loadSCurveDashboard() {
    try {
        // Populate S-Curve project selector
        const selector = document.getElementById('scurveProjectSelector');
        const projRes = await fetch('/api/projects');
        const projs = await projRes.json();
        
        const currentVal = selector.value;
        selector.innerHTML = '<option value="0">Consolidated ITG Portfolio S-Curve</option>';
        projs.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.project_code} — ${p.name}`;
            selector.appendChild(opt);
        });
        selector.value = currentVal;

        selector.onchange = () => loadSCurveData(parseInt(selector.value) || 0);
        await loadSCurveData(parseInt(selector.value) || 0);

    } catch (err) {
        console.error('Error loading S-Curve dashboard:', err);
    }
}

async function loadSCurveData(projectId) {
    try {
        let url = `/api/dashboard/scurve?`;
        if (projectId > 0) url += `project_id=${projectId}&`;
        if (state.subsidiaryId > 0) url += `subsidiary_id=${state.subsidiaryId}`;

        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('scurveChartTitle').innerHTML = `<i class="fa-solid fa-chart-line"></i> Cumulative S-Curve: ${data.project_name}`;

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

// =========================================================================
// TAB 6: TIMELINE & GANTT LOADER
// =========================================================================
async function loadTimelineDashboard() {
    try {
        let url = `/api/dashboard/timeline?`;
        if (state.subsidiaryId > 0) url += `subsidiary_id=${state.subsidiaryId}`;

        const res = await fetch(url);
        const data = await res.json();

        const banner = document.getElementById('slippageBanner');
        if (data.slippages.length > 0) {
            banner.style.display = 'flex';
            document.getElementById('slippageTitle').textContent = `Milestone Slippage Red-Flag Alert (${data.slippages.length} Delayed Projects)`;
            document.getElementById('slippageDesc').textContent = data.slippages.map(s => `${s.project_code} is delayed by ${s.delay_days} days (Forecast: ${s.forecast_completion_date})`).join(' | ');
        } else {
            banner.style.display = 'none';
        }

        const tbody = document.getElementById('timelineMilestonesBody');
        if (data.critical_milestones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><p>No critical path milestones registered.</p></td></tr>`;
        } else {
            tbody.innerHTML = data.critical_milestones.map(m => `
                <tr>
                    <td><strong>${m.project_name}</strong></td>
                    <td>${m.item_name}</td>
                    <td>${m.weight_pct}%</td>
                    <td>${m.planned_start}</td>
                    <td>${m.planned_finish}</td>
                    <td><span class="badge ${m.status === 'Completed' ? 'badge-green' : (m.status === 'Blocked' ? 'badge-red' : 'badge-blue')}">${m.status}</span></td>
                    <td><span class="badge badge-amber"><i class="fa-solid fa-lock"></i> Critical Path</span></td>
                </tr>
            `).join('');
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
    const sel = document.getElementById('c_project_id');
    const res = await fetch('/api/projects');
    const projs = await res.json();
    state.cutoffProjects = projs;
    sel.innerHTML = projs.map(p => `<option value="${p.id}">${p.project_code} — ${p.name} (BAC: ${formatCurrency(p.bac)})</option>`).join('');
    document.getElementById('c_date').value = new Date().toISOString().split('T')[0];

    if (projs.length > 0 && projs[0].baseline_end_date) {
        document.getElementById('c_forecast_date').value = projs[0].baseline_end_date;
    }

    sel.onchange = () => {
        const selected = projs.find(p => p.id === parseInt(sel.value));
        if (selected && selected.baseline_end_date) {
            document.getElementById('c_forecast_date').value = selected.baseline_end_date;
        }
        updateLiveCutoffPreview();
    };

    const progInput = document.getElementById('c_progress_pct');
    if (progInput) {
        progInput.oninput = () => { progInput.dataset.manual = 'true'; };
    }
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

        document.getElementById('detailProjectTitle').innerHTML = `
            <i class="fa-solid fa-folder-open"></i> ${p.project_code} — ${p.name}
            <span class="badge ${getRagBadgeClass(k.rag_status)}" style="margin-left:0.75rem;">${k.rag_status}</span>
        `;

        const body = document.getElementById('detailModalBody');
        body.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(4, 1fr); margin-bottom:1rem;">
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">BAC</div>
                    <div style="font-size:1.15rem; font-weight:800;">${formatCurrency(p.bac)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Actual Cost (AC)</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#D97706;">${formatCurrency(k.ac)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Earned Value (EV)</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#059669;">${formatCurrency(k.ev)}</div>
                </div>
                <div class="stat-card" style="padding:0.75rem;">
                    <div class="stat-label">Estimate at Completion (EAC)</div>
                    <div style="font-size:1.15rem; font-weight:800; color:${k.eac > p.bac ? '#DC2626' : '#2563EB'};">${formatCurrency(k.eac)}</div>
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
                        <tr><td>1</td><td>Overall Progress %</td><td>(Comp. Work / Total Work) * 100</td><td><strong>${k.overall_progress_pct}%</strong></td><td><span class="badge badge-clean">TRACKED</span></td></tr>
                        <tr><td>2</td><td>Progress Variance %</td><td>Actual % - Planned %</td><td><strong>${k.progress_variance_pct}%</strong></td><td><span class="badge ${k.progress_variance_pct >= 0 ? 'badge-green' : 'badge-red'}">${k.progress_variance_pct >= 0 ? 'ON TRACK' : 'SLIPPED'}</span></td></tr>
                        <tr><td>3</td><td>Schedule Variance (SV)</td><td>EV - PV</td><td><strong>${formatCurrency(k.sv)}</strong></td><td><span class="badge ${k.sv >= 0 ? 'badge-green' : 'badge-amber'}">${k.sv >= 0 ? 'AHEAD' : 'BEHIND'}</span></td></tr>
                        <tr><td>5</td><td>SPI (Schedule Index)</td><td>EV / PV</td><td><strong>${k.spi.toFixed(2)}</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_spi)}">${k.rag_spi}</span></td></tr>
                        <tr><td>8</td><td>Cost Variance (CV)</td><td>EV - AC</td><td><strong>${formatCurrency(k.cv)}</strong></td><td><span class="badge ${k.cv >= 0 ? 'badge-green' : 'badge-red'}">${k.cv >= 0 ? 'UNDER BUDGET' : 'OVER BUDGET'}</span></td></tr>
                        <tr><td>10</td><td>CPI (Cost Index)</td><td>EV / AC</td><td><strong>${k.cpi.toFixed(2)}</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_cpi)}">${k.rag_cpi}</span></td></tr>
                        <tr><td>12</td><td>Estimate at Completion (EAC)</td><td>BAC / CPI</td><td><strong>${formatCurrency(k.eac)}</strong></td><td><span class="badge ${k.eac <= p.bac ? 'badge-green' : 'badge-red'}">${k.eac <= p.bac ? 'WITHIN BUDGET' : 'OVERRUN'}</span></td></tr>
                        <tr><td>14</td><td>Variance at Completion (VAC)</td><td>BAC - EAC</td><td><strong>${formatCurrency(k.vac)}</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_vac)}">${k.rag_vac}</span></td></tr>
                        <tr><td>21</td><td>Rework %</td><td>(Rework Hrs / Actual Hrs) * 100</td><td><strong>${k.rework_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_rework)}">${k.rag_rework}</span></td></tr>
                        <tr><td>24</td><td>Resource Utilization %</td><td>(Productive / Available) * 100</td><td><strong>${k.resource_utilization_pct}%</strong></td><td><span class="badge ${getRagBadgeClass(k.rag_utilization)}">${k.rag_utilization}</span></td></tr>
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

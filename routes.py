import sqlite3
import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any

from app.db.database import get_db_connection
from app.core.kpi_engine import compute_project_kpis, compute_group_portfolio_rollup
from app.api.schemas import (
    ProjectCreate, ProjectWithWBSCreate, WBSItemCreate,
    PeriodicSnapshotCreate, RiskCreate, ChangeRequestCreate,
    RiskStatusUpdate, ChangeRequestStatusUpdate
)

router = APIRouter(prefix="/api")

# =========================================================================
# SUBSIDIARIES ENDPOINTS
# =========================================================================
@router.get("/subsidiaries")
def get_subsidiaries():
    conn = get_db_connection()
    subs = conn.execute("SELECT * FROM subsidiaries ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(s) for s in subs]

# =========================================================================
# PROJECTS ENDPOINTS (CRUD & FILTERING)
# =========================================================================
@router.get("/projects")
def get_projects(
    subsidiary_id: Optional[int] = None,
    status: Optional[str] = None,
    rag_status: Optional[str] = None,
    project_type: Optional[str] = None,
    cut_off_date: Optional[str] = None
):
    conn = get_db_connection()
    query = """
    SELECT p.*, s.name as subsidiary_name, s.code as subsidiary_code
    FROM projects p
    JOIN subsidiaries s ON p.subsidiary_id = s.id
    WHERE 1=1
    """
    params = []

    if subsidiary_id is not None and subsidiary_id > 0:
        query += " AND p.subsidiary_id = ?"
        params.append(subsidiary_id)

    if status and status != "All":
        query += " AND p.status = ?"
        params.append(status)

    if project_type and project_type != "All":
        query += " AND p.project_type = ?"
        params.append(project_type)

    query += " ORDER BY p.id DESC"
    raw_projects = conn.execute(query, params).fetchall()

    enriched_projects = []
    for rp in raw_projects:
        p_dict = dict(rp)
        pid = p_dict["id"]

        # Fetch latest snapshot up to cut_off_date if specified
        if cut_off_date:
            snap = conn.execute(
                "SELECT * FROM periodic_status_snapshots WHERE project_id = ? AND cut_off_date <= ? ORDER BY cut_off_date DESC LIMIT 1",
                (pid, cut_off_date)
            ).fetchone()
        else:
            snap = conn.execute(
                "SELECT * FROM periodic_status_snapshots WHERE project_id = ? ORDER BY cut_off_date DESC LIMIT 1",
                (pid,)
            ).fetchone()

        wbs = conn.execute("SELECT * FROM project_wbs_items WHERE project_id = ?", (pid,)).fetchall()
        risks = conn.execute("SELECT * FROM project_risks WHERE project_id = ?", (pid,)).fetchall()
        crs = conn.execute("SELECT * FROM project_change_requests WHERE project_id = ?", (pid,)).fetchall()

        kpis = compute_project_kpis(
            p_dict,
            latest_snapshot=dict(snap) if snap else None,
            wbs_items=[dict(w) for w in wbs],
            risks=[dict(r) for r in risks],
            change_requests=[dict(c) for c in crs]
        )

        p_dict["kpis"] = kpis
        p_dict["latest_snapshot"] = dict(snap) if snap else None
        p_dict["wbs_count"] = len(wbs)

        # Apply RAG status filter if requested
        if rag_status and rag_status != "All":
            if kpis["rag_status"].upper() != rag_status.upper():
                continue

        enriched_projects.append(p_dict)

    conn.close()
    return enriched_projects

@router.get("/projects/{project_id}")
def get_project_detail(project_id: int):
    conn = get_db_connection()
    p = conn.execute(
        """SELECT p.*, s.name as subsidiary_name, s.code as subsidiary_code, s.managing_director as subsidiary_md
           FROM projects p JOIN subsidiaries s ON p.subsidiary_id = s.id WHERE p.id = ?""",
        (project_id,)
    ).fetchone()

    if not p:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")

    p_dict = dict(p)
    wbs = conn.execute("SELECT * FROM project_wbs_items WHERE project_id = ? ORDER BY id ASC", (project_id,)).fetchall()
    snapshots = conn.execute("SELECT * FROM periodic_status_snapshots WHERE project_id = ? ORDER BY cut_off_date ASC", (project_id,)).fetchall()
    risks = conn.execute("SELECT * FROM project_risks WHERE project_id = ? ORDER BY id DESC", (project_id,)).fetchall()
    crs = conn.execute("SELECT * FROM project_change_requests WHERE project_id = ? ORDER BY id DESC", (project_id,)).fetchall()

    latest_snap = dict(snapshots[-1]) if snapshots else None

    kpis = compute_project_kpis(
        p_dict,
        latest_snapshot=latest_snap,
        wbs_items=[dict(w) for w in wbs],
        risks=[dict(r) for r in risks],
        change_requests=[dict(c) for c in crs]
    )

    p_dict["kpis"] = kpis
    p_dict["wbs_items"] = [dict(w) for w in wbs]
    p_dict["snapshots"] = [dict(s) for s in snapshots]
    p_dict["risks"] = [dict(r) for r in risks]
    p_dict["change_requests"] = [dict(c) for c in crs]

    conn.close()
    return p_dict

@router.post("/projects")
def create_project(payload: ProjectWithWBSCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    p = payload.project

    try:
        cursor.execute(
            """INSERT INTO projects (
                subsidiary_id, project_code, name, client, pm, sponsor, project_type, status, priority,
                baseline_start_date, baseline_end_date, bac, contract_value, contingency_reserve,
                planned_effort_hours, planned_fte, is_locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (
                p.subsidiary_id, p.project_code, p.name, p.client, p.pm, p.sponsor,
                p.project_type, p.status, p.priority, p.baseline_start_date, p.baseline_end_date,
                p.bac, p.contract_value, p.contingency_reserve, p.planned_effort_hours, p.planned_fte
            )
        )
        project_id = cursor.lastrowid

        if payload.wbs_items and len(payload.wbs_items) > 0:
            for item in payload.wbs_items:
                cursor.execute(
                    """INSERT INTO project_wbs_items (
                        project_id, item_name, item_type, weight_pct, planned_start, planned_finish, allocated_budget, status, is_critical_path
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        project_id, item.item_name, item.item_type, item.weight_pct,
                        item.planned_start, item.planned_finish, item.allocated_budget,
                        item.status, item.is_critical_path
                    )
                )

        # Create initial Day 0 baseline snapshot
        today_str = datetime.date.today().isoformat()
        cursor.execute(
            """INSERT INTO periodic_status_snapshots (
                project_id, cut_off_date, pv, ev, ac, forecast_completion_date,
                actual_effort_hours, rework_effort_hours, available_hours,
                deliverables_submitted, deliverables_accepted, defects_count, overall_progress_pct, pm_comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id, today_str, 0.0, 0.0, 0.0, p.baseline_end_date,
                0.0, 0.0, (p.planned_fte or 1.0) * 160.0, 0, 0, 0, 0.0, "Initial project baseline registered."
            )
        )

        conn.commit()
        conn.close()
        return {"status": "success", "project_id": project_id, "message": "Project registered successfully"}
    except sqlite3.IntegrityError as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Database integrity error: {str(e)}")

# =========================================================================
# PERIODIC CUT-OFF REPORT (FORM 3)
# =========================================================================
@router.post("/cutoffs")
def submit_periodic_cutoff(payload: PeriodicSnapshotCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """INSERT INTO periodic_status_snapshots (
                project_id, cut_off_date, pv, ev, ac, forecast_completion_date,
                actual_effort_hours, rework_effort_hours, available_hours,
                deliverables_submitted, deliverables_accepted, defects_count,
                overall_progress_pct, pm_comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, cut_off_date) DO UPDATE SET
                pv=excluded.pv, ev=excluded.ev, ac=excluded.ac,
                forecast_completion_date=excluded.forecast_completion_date,
                actual_effort_hours=excluded.actual_effort_hours,
                rework_effort_hours=excluded.rework_effort_hours,
                available_hours=excluded.available_hours,
                deliverables_submitted=excluded.deliverables_submitted,
                deliverables_accepted=excluded.deliverables_accepted,
                defects_count=excluded.defects_count,
                overall_progress_pct=excluded.overall_progress_pct,
                pm_comments=excluded.pm_comments
            """,
            (
                payload.project_id, payload.cut_off_date, payload.pv, payload.ev, payload.ac,
                payload.forecast_completion_date, payload.actual_effort_hours, payload.rework_effort_hours,
                payload.available_hours, payload.deliverables_submitted, payload.deliverables_accepted,
                payload.defects_count, payload.overall_progress_pct, payload.pm_comments
            )
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Monthly cut-off snapshot saved & KPIs updated."}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

# =========================================================================
# WBS ITEM STATUS UPDATE (FOR KANBAN & DELIVERY)
# =========================================================================
@router.patch("/wbs/{item_id}")
def update_wbs_status(item_id: int, status: str, is_completed: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_completed is None:
        is_completed = 1 if status == "Completed" else 0

    finish_date = datetime.date.today().isoformat() if is_completed == 1 else None

    cursor.execute(
        "UPDATE project_wbs_items SET status = ?, is_completed = ?, actual_finish_date = ? WHERE id = ?",
        (status, is_completed, finish_date, item_id)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "item_id": item_id, "new_status": status}

# =========================================================================
# REGISTERS (RISKS & CHANGE REQUESTS)
# =========================================================================
@router.post("/risks")
def add_risk(payload: RiskCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    exposure = (payload.probability / 5.0) * payload.impact_cost
    cursor.execute(
        """INSERT INTO project_risks (project_id, risk_code, description, probability, impact_cost, exposure_cost, severity, owner, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open')""",
        (payload.project_id, payload.risk_code, payload.description, payload.probability, payload.impact_cost, exposure, payload.severity, payload.owner)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Risk added to register"}

@router.post("/change-requests")
def add_change_request(payload: ChangeRequestCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO project_change_requests (project_id, cr_code, description, cost_impact, schedule_impact_days, status, requested_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (payload.project_id, payload.cr_code, payload.description, payload.cost_impact, payload.schedule_impact_days, payload.status, payload.requested_by)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Change request submitted"}

@router.patch("/risks/{risk_id}")
def update_risk_status(risk_id: int, payload: RiskStatusUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE project_risks SET status = ? WHERE id = ?", (payload.status, risk_id))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Risk not found")
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Risk status updated to {payload.status}"}

@router.patch("/change-requests/{cr_id}")
def update_change_request_status(cr_id: int, payload: ChangeRequestStatusUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    approval_date = datetime.date.today().isoformat() if payload.status in ("Approved", "Rejected") else None
    cursor.execute(
        """UPDATE project_change_requests 
           SET status = ?, approved_by = ?, approval_date = ? 
           WHERE id = ?""",
        (payload.status, payload.approved_by, approval_date, cr_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Change request not found")
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Change request status updated to {payload.status}"}


# =========================================================================
# DASHBOARD AGGREGATE ENDPOINTS (THE 6 SCREENS)
# =========================================================================
@router.get("/dashboard/portfolio")
def get_portfolio_dashboard(subsidiary_id: Optional[int] = None, rag_status: Optional[str] = None):
    projects = get_projects(subsidiary_id=subsidiary_id, rag_status=rag_status)
    rollup = compute_group_portfolio_rollup(projects)

    # Subsidiary breakdown
    conn = get_db_connection()
    subs = conn.execute("SELECT id, code, name FROM subsidiaries ORDER BY id ASC").fetchall()
    conn.close()

    sub_breakdown = []
    for s in subs:
        sub_id = s["id"]
        sub_projs = [p for p in projects if p["subsidiary_id"] == sub_id]
        sub_rollup = compute_group_portfolio_rollup(sub_projs)
        sub_breakdown.append({
            "subsidiary_id": sub_id,
            "code": s["code"],
            "name": s["name"],
            "project_count": len(sub_projs),
            "bac": sub_rollup["group_bac"],
            "ac": sub_rollup["group_ac"],
            "cpi": sub_rollup["group_cpi"],
            "spi": sub_rollup["group_spi"],
            "rag_counts": sub_rollup["rag_counts"]
        })

    return {
        "rollup": rollup,
        "subsidiary_breakdown": sub_breakdown,
        "projects": projects
    }

@router.get("/dashboard/demand")
def get_demand_dashboard(subsidiary_id: Optional[int] = None):
    conn = get_db_connection()
    projects = get_projects(subsidiary_id=subsidiary_id)

    total_fte_allocated = sum(p.get("planned_fte", 1.0) for p in projects if p["status"] == "Active")
    pipeline_projects = [p for p in projects if p["status"] in ("Not Started", "Pipeline")]
    pipeline_fte_required = sum(p.get("planned_fte", 1.0) for p in pipeline_projects)

    # Fetch all 18 ITG affiliates (or filtered by subsidiary_id)
    if subsidiary_id and subsidiary_id > 0:
        sub_rows = conn.execute("SELECT * FROM subsidiaries WHERE id = ? ORDER BY sector, name", (subsidiary_id,)).fetchall()
    else:
        sub_rows = conn.execute("SELECT * FROM subsidiaries ORDER BY sector, name").fetchall()

    departments = []
    total_group_headcount = 0
    total_group_committed = 0.0

    for s in sub_rows:
        s_id = s["id"]
        headcount = s["headcount"] or 25
        total_group_headcount += headcount

        # Committed FTE is sum of planned_fte for active projects under this affiliate
        affiliate_active_projs = [p for p in projects if p["subsidiary_id"] == s_id and p["status"] == "Active"]
        committed_fte = sum(p.get("planned_fte", 1.0) for p in affiliate_active_projs)
        total_group_committed += committed_fte

        utilization_pct = round((committed_fte / headcount) * 100, 1) if headcount > 0 else 0.0
        
        if utilization_pct == 0:
            status = "AVAILABLE"
        elif utilization_pct > 100:
            status = "OVER_ALLOCATED"
        elif utilization_pct > 88:
            status = "NEAR_CAPACITY"
        elif utilization_pct >= 60:
            status = "OPTIMAL"
        else:
            status = "AVAILABLE"

        departments.append({
            "subsidiary_id": s_id,
            "code": s["code"],
            "name": s["name"],
            "sector": s["sector"],
            "headcount": headcount,
            "allocated_fte": round(committed_fte, 1),
            "available_fte": round(headcount - committed_fte, 1),
            "utilization_pct": utilization_pct,
            "status": status,
            "active_projects_count": len(affiliate_active_projs)
        })

    group_avg_utilization = round((total_group_committed / total_group_headcount) * 100, 1) if total_group_headcount > 0 and total_group_committed > 0 else 0.0

    conn.close()
    return {
        "summary": {
            "total_active_fte": round(total_fte_allocated, 1),
            "pipeline_projects_count": len(pipeline_projects),
            "pipeline_fte_demand": round(pipeline_fte_required, 1),
            "group_avg_utilization_pct": group_avg_utilization,
            "total_headcount": total_group_headcount
        },
        "departments": departments,
        "pipeline_projects": pipeline_projects,
        "active_projects": [p for p in projects if p["status"] == "Active"]
    }

def get_impact_level(impact_cost: float) -> int:
    if impact_cost <= 15000:
        return 1
    elif impact_cost <= 30000:
        return 2
    elif impact_cost <= 50000:
        return 3
    elif impact_cost <= 80000:
        return 4
    else:
        return 5

@router.get("/dashboard/risks")
def get_risks_dashboard(subsidiary_id: Optional[int] = None, project_id: Optional[int] = None):
    conn = get_db_connection()
    
    # 1. Fetch filtered risks
    query_risks = """
    SELECT r.*, p.name as project_name, p.project_code, s.code as subsidiary_code, s.name as subsidiary_name
    FROM project_risks r
    JOIN projects p ON r.project_id = p.id
    JOIN subsidiaries s ON p.subsidiary_id = s.id
    WHERE 1=1
    """
    params_risks = []
    if subsidiary_id and subsidiary_id > 0:
        query_risks += " AND p.subsidiary_id = ?"
        params_risks.append(subsidiary_id)
    if project_id and project_id > 0:
        query_risks += " AND p.id = ?"
        params_risks.append(project_id)
        
    query_risks += " ORDER BY r.exposure_cost DESC, r.id DESC"
    risks_rows = conn.execute(query_risks, params_risks).fetchall()
    
    # 2. Fetch filtered change requests
    query_crs = """
    SELECT cr.*, p.name as project_name, p.project_code, s.code as subsidiary_code, s.name as subsidiary_name
    FROM project_change_requests cr
    JOIN projects p ON cr.project_id = p.id
    JOIN subsidiaries s ON p.subsidiary_id = s.id
    WHERE 1=1
    """
    params_crs = []
    if subsidiary_id and subsidiary_id > 0:
        query_crs += " AND p.subsidiary_id = ?"
        params_crs.append(subsidiary_id)
    if project_id and project_id > 0:
        query_crs += " AND p.id = ?"
        params_crs.append(project_id)
        
    query_crs += " ORDER BY cr.id DESC"
    crs_rows = conn.execute(query_crs, params_crs).fetchall()

    # 3. Fetch contingency reserve across relevant projects
    query_cont = "SELECT COALESCE(SUM(contingency_reserve), 0) as total_contingency FROM projects WHERE 1=1"
    params_cont = []
    if subsidiary_id and subsidiary_id > 0:
        query_cont += " AND subsidiary_id = ?"
        params_cont.append(subsidiary_id)
    if project_id and project_id > 0:
        query_cont += " AND id = ?"
        params_cont.append(project_id)
    cont_row = conn.execute(query_cont, params_cont).fetchone()
    total_contingency = float(cont_row["total_contingency"]) if cont_row else 0.0

    conn.close()


    risks = []
    total_exposure = 0.0
    open_risks_count = 0
    critical_high_count = 0
    
    # Build 5x5 matrix: rows 5 down to 1, cols 1 to 5
    matrix_cells = {}
    for p in range(5, 0, -1):
        for i in range(1, 6):
            matrix_cells[(p, i)] = []

    for row in risks_rows:
        r = dict(row)
        p_val = max(1, min(5, int(r.get("probability", 1))))
        cost = float(r.get("impact_cost", 0.0))
        i_val = get_impact_level(cost)
        r["impact_level"] = i_val
        r["p_score"] = p_val
        score = p_val * i_val
        r["matrix_score"] = score
        
        # Calculate derived severity
        if score >= 17:
            calc_severity = "Critical"
        elif score >= 13:
            calc_severity = "High"
        elif score >= 7:
            calc_severity = "Medium"
        else:
            calc_severity = "Low"
        r["calc_severity"] = calc_severity
        
        if r.get("status") == "Open":
            open_risks_count += 1
            total_exposure += float(r.get("exposure_cost", 0.0))
            if r.get("severity") in ("Critical", "High") or calc_severity in ("Critical", "High"):
                critical_high_count += 1
            matrix_cells[(p_val, i_val)].append(r)
            
        risks.append(r)

    matrix_5x5 = []
    for p in range(5, 0, -1):
        row_cells = []
        for i in range(1, 6):
            cell_risks = matrix_cells[(p, i)]
            score = p * i
            if score >= 17:
                sev = "Critical"
                color_cls = "matrix-red"
            elif score >= 13:
                sev = "High"
                color_cls = "matrix-orange"
            elif score >= 7:
                sev = "Medium"
                color_cls = "matrix-amber"
            else:
                sev = "Low"
                color_cls = "matrix-green"
                
            row_cells.append({
                "probability": p,
                "impact": i,
                "score": score,
                "severity": sev,
                "color_class": color_cls,
                "count": len(cell_risks),
                "risks": [
                    {"id": x["id"], "code": x["risk_code"], "desc": x["description"], "exposure": x["exposure_cost"]}
                    for x in cell_risks
                ]
            })
        matrix_5x5.append({
            "probability": p,
            "cells": row_cells
        })

    change_requests = [dict(cr) for cr in crs_rows]
    pending_crs = [cr for cr in change_requests if cr.get("status") == "Pending"]
    pending_cost = sum(float(cr.get("cost_impact", 0.0)) for cr in pending_crs)

    return {
        "summary": {
            "total_open_risks": open_risks_count,
            "critical_high_count": critical_high_count,
            "total_exposure_cost": round(total_exposure, 2),
            "total_contingency_reserve": round(total_contingency, 2),
            "pending_crs_count": len(pending_crs),
            "pending_crs_cost_impact": round(pending_cost, 2)
        },
        "matrix_5x5": matrix_5x5,
        "risks": risks,
        "change_requests": change_requests
    }

@router.get("/dashboard/tasks")
def get_tasks_dashboard(subsidiary_id: Optional[int] = None, project_id: Optional[int] = None):
    conn = get_db_connection()
    query = """
    SELECT w.*, p.name as project_name, p.project_code, s.code as subsidiary_code
    FROM project_wbs_items w
    JOIN projects p ON w.project_id = p.id
    JOIN subsidiaries s ON p.subsidiary_id = s.id
    WHERE 1=1
    """
    params = []
    if subsidiary_id and subsidiary_id > 0:
        query += " AND p.subsidiary_id = ?"
        params.append(subsidiary_id)
    if project_id and project_id > 0:
        query += " AND p.id = ?"
        params.append(project_id)

    query += " ORDER BY w.id ASC"
    items = conn.execute(query, params).fetchall()

    kanban = {
        "Backlog": [],
        "In Progress": [],
        "In Review": [],
        "Blocked": [],
        "Completed": []
    }

    for item in items:
        i_dict = dict(item)
        st = i_dict.get("status") or "Backlog"
        if st not in kanban:
            st = "In Progress"
        kanban[st].append(i_dict)

    conn.close()
    return {
        "kanban": kanban,
        "total_items": len(items),
        "blocked_count": len(kanban["Blocked"]),
        "completed_count": len(kanban["Completed"])
    }

@router.get("/dashboard/financials")
def get_financials_dashboard(subsidiary_id: Optional[int] = None):
    projects = get_projects(subsidiary_id=subsidiary_id)

    total_contract_value = sum(p.get("contract_value", 0) for p in projects)
    total_bac = sum(p.get("bac", 0) for p in projects)
    total_ac = sum(p["kpis"]["ac"] for p in projects)
    total_ev = sum(p["kpis"]["ev"] for p in projects)

    group_cpi = round((total_ev / total_ac) if total_ac > 0 else 1.0, 2)
    group_vac = round(sum(p["kpis"]["vac"] for p in projects), 2)

    # Fixed Price vs T&M breakdown
    fixed_price = [p for p in projects if p.get("project_type") in ("Fixed Price", "Fixed-Price")]
    tm_projects = [p for p in projects if p.get("project_type") in ("T&M", "Time & Materials")]

    fp_cpi = round((sum(p["kpis"]["ev"] for p in fixed_price) / sum(p["kpis"]["ac"] for p in fixed_price)) if fixed_price and sum(p["kpis"]["ac"] for p in fixed_price) > 0 else 1.0, 2)
    tm_cpi = round((sum(p["kpis"]["ev"] for p in tm_projects) / sum(p["kpis"]["ac"] for p in tm_projects)) if tm_projects and sum(p["kpis"]["ac"] for p in tm_projects) > 0 else 1.0, 2)

    return {
        "summary": {
            "total_contract_value": round(total_contract_value, 2),
            "total_bac": round(total_bac, 2),
            "total_ac": round(total_ac, 2),
            "total_ev": round(total_ev, 2),
            "cpi": group_cpi,
            "net_vac": group_vac,
            "fixed_price_count": len(fixed_price),
            "fixed_price_cpi": fp_cpi,
            "tm_count": len(tm_projects),
            "tm_cpi": tm_cpi
        },
        "projects": projects
    }

@router.get("/dashboard/scurve")
def get_scurve_dashboard(project_id: Optional[int] = None, subsidiary_id: Optional[int] = None):
    conn = get_db_connection()

    if project_id and project_id > 0:
        p = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not p:
            conn.close()
            raise HTTPException(status_code=404, detail="Project not found")

        snaps = conn.execute(
            "SELECT * FROM periodic_status_snapshots WHERE project_id = ? ORDER BY cut_off_date ASC",
            (project_id,)
        ).fetchall()

        labels = [s["cut_off_date"] for s in snaps]
        pv_series = [s["pv"] for s in snaps]
        ev_series = [s["ev"] for s in snaps]
        ac_series = [s["ac"] for s in snaps]

        conn.close()
        return {
            "project_name": p["name"],
            "bac": p["bac"],
            "labels": labels,
            "pv_series": pv_series,
            "ev_series": ev_series,
            "ac_series": ac_series
        }
    else:
        # Group-wide S-Curve aggregation across distinct cut-off dates
        query = """
        SELECT cut_off_date, SUM(pv) as sum_pv, SUM(ev) as sum_ev, SUM(ac) as sum_ac
        FROM periodic_status_snapshots
        """
        params = []
        if subsidiary_id and subsidiary_id > 0:
            query += " JOIN projects ON periodic_status_snapshots.project_id = projects.id WHERE projects.subsidiary_id = ?"
            params.append(subsidiary_id)

        query += " GROUP BY cut_off_date ORDER BY cut_off_date ASC"
        rows = conn.execute(query, params).fetchall()

        labels = [r["cut_off_date"] for r in rows]
        pv_series = [round(r["sum_pv"], 2) for r in rows]
        ev_series = [round(r["sum_ev"], 2) for r in rows]
        ac_series = [round(r["sum_ac"], 2) for r in rows]

        conn.close()
        return {
            "project_name": "Consolidated ITG Portfolio",
            "labels": labels,
            "pv_series": pv_series,
            "ev_series": ev_series,
            "ac_series": ac_series
        }

@router.get("/dashboard/timeline")
def get_timeline_dashboard(subsidiary_id: Optional[int] = None):
    projects = get_projects(subsidiary_id=subsidiary_id)

    critical_milestones = []
    slippages = []

    conn = get_db_connection()
    for p in projects:
        wbs = conn.execute(
            "SELECT * FROM project_wbs_items WHERE project_id = ? ORDER BY planned_finish ASC",
            (p["id"],)
        ).fetchall()

        for w in wbs:
            w_dict = dict(w)
            w_dict["project_name"] = p["name"]
            w_dict["subsidiary_code"] = p["subsidiary_code"]
            if w_dict.get("is_critical_path") == 1:
                critical_milestones.append(w_dict)

        if p["kpis"]["delay_days"] > 30:
            slippages.append({
                "project_code": p["project_code"],
                "project_name": p["name"],
                "subsidiary_name": p["subsidiary_name"],
                "delay_days": p["kpis"]["delay_days"],
                "baseline_end_date": p["baseline_end_date"],
                "forecast_completion_date": p["kpis"]["forecast_completion_date"]
            })

    conn.close()
    return {
        "projects": projects,
        "critical_milestones": critical_milestones,
        "slippages": slippages
    }

# =========================================================================
# DEMO DATA ENGINE (SEED SAMPLE & RESET TO ZERO DATA)
# =========================================================================
@router.post("/demo/seed")
def seed_sample_portfolio():
    """
    Populates realistic multi-subsidiary sample data to demonstrate all 6 dashboard views,
    EVM S-curves, and RAG alerts across ITG Holding.
    """
    from app.db.seed_data import seed_itg_sample_portfolio
    seed_itg_sample_portfolio()
    return {"status": "success", "message": "Sample multi-subsidiary portfolio loaded successfully!"}

@router.post("/demo/reset")
def reset_to_zero_data():
    """
    Wipes all projects, snapshots, and WBS items, restoring the clean-slate Zero-Data state.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM project_change_requests;")
    cursor.execute("DELETE FROM project_risks;")
    cursor.execute("DELETE FROM periodic_status_snapshots;")
    cursor.execute("DELETE FROM project_wbs_items;")
    cursor.execute("DELETE FROM projects;")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "System reset to 100% clean-slate Zero-Data state."}

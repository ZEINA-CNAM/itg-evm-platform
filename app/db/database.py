import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "itg_projects.db")

# Official ITG Holding Affiliates organized by the 4 corporate business clusters
ITG_AFFILIATES = [
    # 1. Enterprise & Services (5 Affiliates)
    {"code": "ABSEGA", "name": "ABSEGA", "sector": "Enterprise & Services", "md": "Managing Director - ABSEGA", "headcount": 20},
    {"code": "CIRRUS", "name": "Cirrus", "sector": "Enterprise & Services", "md": "Managing Director - Cirrus", "headcount": 30},
    {"code": "CRYSTAL", "name": "Crystal Networks", "sector": "Enterprise & Services", "md": "Managing Director - Crystal", "headcount": 25},
    {"code": "MIDWARE", "name": "Midware Data Systems", "sector": "Enterprise & Services", "md": "Managing Director - Midware", "headcount": 40},
    {"code": "TSI", "name": "TeleSupport International (TSI)", "sector": "Enterprise & Services", "md": "Managing Director - TSI", "headcount": 25},

    # 2. Software & Solutions (6 Affiliates)
    {"code": "AMIST", "name": "AMIST", "sector": "Software & Solutions", "md": "Managing Director - AMIST", "headcount": 20},
    {"code": "ITB", "name": "ITB", "sector": "Software & Solutions", "md": "Managing Director - ITB", "headcount": 35},
    {"code": "IMS", "name": "IMS", "sector": "Software & Solutions", "md": "Managing Director - IMS", "headcount": 25},
    {"code": "MDSL", "name": "MDSL", "sector": "Software & Solutions", "md": "Managing Director - MDSL", "headcount": 45},
    {"code": "PRIME", "name": "Primeware", "sector": "Software & Solutions", "md": "Managing Director - Primeware", "headcount": 25},
    {"code": "KLAREO", "name": "Klareo", "sector": "Software & Solutions", "md": "Managing Director - Klareo", "headcount": 15},

    # 3. Distribution & Retail (3 Affiliates)
    {"code": "460STORE", "name": "460estore", "sector": "Distribution & Retail", "md": "Managing Director - 460estore", "headcount": 15},
    {"code": "XTREME", "name": "Xtreme Logistics", "sector": "Distribution & Retail", "md": "Managing Director - Xtreme", "headcount": 20},
    {"code": "PCDEAL", "name": "PCdealNet", "sector": "Distribution & Retail", "md": "Managing Director - PCdealNet", "headcount": 30},

    # 4. Site & Power (4 Affiliates)
    {"code": "BRITGE", "name": "Britge", "sector": "Site & Power", "md": "Managing Director - Britge", "headcount": 20},
    {"code": "ECOSYS", "name": "Ecosys", "sector": "Site & Power", "md": "Managing Director - Ecosys", "headcount": 30},
    {"code": "MES", "name": "Mideast Energy Solutions (MES)", "sector": "Site & Power", "md": "Managing Director - MES", "headcount": 25},
    {"code": "MPS", "name": "Mideast Power Systems (MPS)", "sector": "Site & Power", "md": "Managing Director - MPS", "headcount": 50}
]

# Backward compatibility alias
ITG_SUBSIDIARIES = ITG_AFFILIATES

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(force_reseed_zero_data: bool = False):
    """
    Initializes the SQLite relational database according to the approved architecture.
    Zero-Data Principle: Seeds the 18 real ITG Holding affiliates across 4 clusters with zero hardcoded projects.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    if force_reseed_zero_data:
        cursor.execute("DROP TABLE IF EXISTS project_change_requests;")
        cursor.execute("DROP TABLE IF EXISTS project_risks;")
        cursor.execute("DROP TABLE IF EXISTS periodic_status_snapshots;")
        cursor.execute("DROP TABLE IF EXISTS project_wbs_items;")
        cursor.execute("DROP TABLE IF EXISTS projects;")
        cursor.execute("DROP TABLE IF EXISTS subsidiaries;")

    # 1. Subsidiaries / Affiliates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subsidiaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        managing_director TEXT NOT NULL,
        headcount INTEGER DEFAULT 25,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Projects master table (Form 1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subsidiary_id INTEGER NOT NULL,
        project_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        client TEXT NOT NULL,
        pm TEXT NOT NULL,
        sponsor TEXT NOT NULL,
        project_type TEXT NOT NULL, -- 'Fixed-Price', 'Time & Materials', 'Internal R&D', 'Non-Billable'
        status TEXT NOT NULL,       -- 'Pipeline', 'Active', 'On Hold', 'Completed', 'Cancelled'
        priority TEXT DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
        baseline_start_date TEXT NOT NULL,
        baseline_end_date TEXT NOT NULL,
        bac REAL NOT NULL,          -- Budget at Completion ($)
        contract_value REAL NOT NULL, -- Total Contract Value ($)
        contingency_reserve REAL DEFAULT 0,
        planned_effort_hours REAL NOT NULL,
        planned_fte REAL DEFAULT 1.0,
        is_locked INTEGER DEFAULT 0, -- 1 once baseline is locked
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subsidiary_id) REFERENCES subsidiaries(id) ON DELETE CASCADE
    );
    """)

    # 3. WBS & Milestones table (Form 2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_wbs_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL, -- 'Milestone', 'Deliverable', 'Work Package'
        weight_pct REAL NOT NULL, -- Percent weight (Sum across project = 100)
        planned_start TEXT NOT NULL,
        planned_finish TEXT NOT NULL,
        allocated_budget REAL DEFAULT 0,
        status TEXT DEFAULT 'Not Started', -- 'Not Started', 'In Progress', 'In Review', 'Completed', 'Blocked'
        is_completed INTEGER DEFAULT 0,
        actual_finish_date TEXT,
        is_critical_path INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # 4. Periodic Status Snapshots table (Form 3 - Monthly Cut-Offs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS periodic_status_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        cut_off_date TEXT NOT NULL, -- YYYY-MM-DD
        pv REAL NOT NULL,           -- Cumulative Planned Value ($)
        ev REAL NOT NULL,           -- Cumulative Earned Value ($)
        ac REAL NOT NULL,           -- Cumulative Actual Cost ($)
        forecast_completion_date TEXT,
        actual_effort_hours REAL DEFAULT 0,
        rework_effort_hours REAL DEFAULT 0,
        available_hours REAL DEFAULT 0,
        deliverables_submitted INTEGER DEFAULT 0,
        deliverables_accepted INTEGER DEFAULT 0,
        defects_count INTEGER DEFAULT 0,
        overall_progress_pct REAL DEFAULT 0,
        pm_comments TEXT,
        is_approved INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, cut_off_date)
    );
    """)

    # 5. Project Risks table (Form 4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_risks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        risk_code TEXT NOT NULL,
        description TEXT NOT NULL,
        probability INTEGER NOT NULL, -- 1 to 5
        impact_cost REAL NOT NULL,   -- Impact in $
        exposure_cost REAL NOT NULL, -- (probability/5.0) * impact_cost
        severity TEXT NOT NULL,      -- 'Low', 'Medium', 'High', 'Critical'
        owner TEXT NOT NULL,
        status TEXT DEFAULT 'Open',  -- 'Open', 'Mitigated', 'Closed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # 6. Scope Change Requests table (Form 4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_change_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        cr_code TEXT NOT NULL,
        description TEXT NOT NULL,
        cost_impact REAL DEFAULT 0,
        schedule_impact_days INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
        requested_by TEXT NOT NULL,
        approved_by TEXT,
        approval_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """)

    # Composite indexes for sub-second querying
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_projects_sub ON projects(subsidiary_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_cutoff ON periodic_status_snapshots(cut_off_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_wbs_proj ON project_wbs_items(project_id);")

    # Populate / Sync the 18 Real ITG Affiliates
    for aff in ITG_AFFILIATES:
        cursor.execute("SELECT id FROM subsidiaries WHERE code = ?", (aff["code"],))
        existing = cursor.fetchone()
        if existing:
            cursor.execute(
                "UPDATE subsidiaries SET name = ?, sector = ?, managing_director = ?, headcount = ? WHERE code = ?",
                (aff["name"], aff["sector"], aff["md"], aff["headcount"], aff["code"])
            )
        else:
            cursor.execute(
                "INSERT INTO subsidiaries (code, name, sector, managing_director, headcount) VALUES (?, ?, ?, ?, ?)",
                (aff["code"], aff["name"], aff["sector"], aff["md"], aff["headcount"])
            )

    # Remove any old placeholder subsidiaries that are not in the official 18 list
    valid_codes = [a["code"] for a in ITG_AFFILIATES]
    placeholders = ",".join(["?"] * len(valid_codes))
    cursor.execute(f"DELETE FROM subsidiaries WHERE code NOT IN ({placeholders})", valid_codes)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully with 18 real ITG affiliates across 4 clusters.")

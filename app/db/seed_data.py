import datetime
from app.db.database import get_db_connection

def seed_itg_sample_portfolio():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing project records and reset auto-increment sequences
    cursor.execute("DELETE FROM project_change_requests;")
    cursor.execute("DELETE FROM project_risks;")
    cursor.execute("DELETE FROM periodic_status_snapshots;")
    cursor.execute("DELETE FROM project_wbs_items;")
    cursor.execute("DELETE FROM projects;")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('projects', 'project_wbs_items', 'periodic_status_snapshots', 'project_risks', 'project_change_requests');")

    # Fetch real affiliate IDs
    subs = {row["code"]: row["id"] for row in conn.execute("SELECT code, id FROM subsidiaries").fetchall()}

    sample_projects = [
        {
            "subsidiary_code": "MDSL",
            "code": "MDSL-ERP-01",
            "name": "Core Banking Omni-Channel & ERP Modernization",
            "client": "National Bank of Kuwait",
            "pm": "Nadine Kabbara",
            "sponsor": "Managing Director - MDSL",
            "type": "Fixed Price",
            "status": "Active",
            "priority": "High",
            "start": "2026-01-15",
            "end": "2026-11-30",
            "bac": 480000.0,
            "contract_value": 620000.0,
            "contingency": 45000.0,
            "effort": 3800.0,
            "fte": 6.5,
            "wbs": [
                ("Architecture Design & Security Review", "Milestone", 20.0, "2026-01-15", "2026-03-31", 90000.0, "Completed", 1, 1),
                ("Core Backend Integration & Microservices", "Work Package", 35.0, "2026-04-01", "2026-07-31", 168000.0, "In Progress", 0, 1),
                ("Mobile & Web Responsive Frontend", "Deliverable", 25.0, "2026-06-01", "2026-09-30", 120000.0, "In Progress", 0, 0),
                ("User Acceptance Testing & Performance Gate", "Milestone", 15.0, "2026-10-01", "2026-11-15", 72000.0, "Not Started", 0, 1),
                ("Production Cut-Over & Go-Live", "Milestone", 5.0, "2026-11-16", "2026-11-30", 30000.0, "Not Started", 0, 1)
            ],
            "snapshots": [
                ("2026-01-31", 40000.0, 38000.0, 36000.0, "2026-11-30", 300.0, 10.0, 560.0, 2, 2, 0, 8.0, "Initial ramp-up on schedule."),
                ("2026-02-28", 85000.0, 84000.0, 81000.0, "2026-11-30", 650.0, 25.0, 560.0, 5, 5, 1, 17.5, "Architecture deliverable accepted."),
                ("2026-03-31", 140000.0, 142000.0, 135000.0, "2026-11-30", 1100.0, 40.0, 560.0, 8, 8, 2, 29.5, "Design sign-off achieved. CPI = 1.05.")
            ],
            "risks": [
                ("RSK-01", "Core banking API version deprecation by switch provider", 2, 35000.0, "Medium", "Nadine K.", "Open"),
                ("RSK-02", "Third-party payment gateway latency breach in high volume", 3, 20000.0, "Medium", "Lead Architect", "Open"),
                ("RSK-07", "Legacy mainframe data formatting schema mismatch", 4, 75000.0, "High", "Data Lead", "Open"),
                ("RSK-08", "Client security audit team availability delay", 1, 10000.0, "Low", "Nadine K.", "Mitigated")
            ],
            "change_requests": [
                ("CR-01", "Integrate Multi-Factor Biometric Authentication (FIDO2)", 28500.0, 15, "Pending", "National Bank of Kuwait", None, None),
                ("CR-02", "Accelerate ISO 20022 messaging validation pipeline", 14000.0, 5, "Approved", "Nadine Kabbara", "Holding PMO", "2026-03-20")
            ]
        },
        {
            "subsidiary_code": "CIRRUS",
            "code": "CIRRUS-CLD-02",
            "name": "Hybrid Multi-Cloud Migration & Security Mesh",
            "client": "Regional Health Authority",
            "pm": "Karim Chamoun",
            "sponsor": "Managing Director - Cirrus",
            "type": "Fixed Price",
            "status": "Active",
            "priority": "High",
            "start": "2026-01-01",
            "end": "2026-08-31",
            "bac": 350000.0,
            "contract_value": 450000.0,
            "contingency": 25000.0,
            "effort": 2400.0,
            "fte": 4.0,
            "wbs": [
                ("Cloud Landing Zone & IAM Framework", "Milestone", 25.0, "2026-01-01", "2026-02-28", 87500.0, "Completed", 1, 1),
                ("Database Migration & Data Sanitization", "Deliverable", 30.0, "2026-03-01", "2026-05-15", 105000.0, "Blocked", 0, 1),
                ("Workload Containerization & Kubernetes", "Work Package", 25.0, "2026-04-01", "2026-07-15", 87500.0, "In Progress", 0, 0),
                ("Security Hardening & DR Verification", "Milestone", 20.0, "2026-07-16", "2026-08-31", 70000.0, "Not Started", 0, 1)
            ],
            "snapshots": [
                ("2026-01-31", 45000.0, 43000.0, 48000.0, "2026-08-31", 320.0, 20.0, 400.0, 3, 3, 1, 12.0, "Landing zone setup."),
                ("2026-02-28", 95000.0, 88000.0, 102000.0, "2026-09-15", 700.0, 50.0, 400.0, 6, 5, 4, 25.0, "DB compliance hurdle."),
                ("2026-03-31", 160000.0, 130000.0, 175000.0, "2026-10-15", 1150.0, 130.0, 400.0, 9, 7, 8, 37.0, "Data migration blocked by client firewall. Delay > 30d, CPI = 0.74.")
            ],
            "risks": [
                ("RSK-03", "Hospital patient records schema incompatible with target cloud RDS", 5, 85000.0, "Critical", "Karim C.", "Open"),
                ("RSK-04", "Ministry of Health cross-border data residency compliance hold", 4, 55000.0, "High", "Security Officer", "Open"),
                ("RSK-09", "Cloud bandwidth egress cost spike during bulk sync", 3, 25000.0, "Medium", "DevOps Lead", "Open")
            ],
            "change_requests": [
                ("CR-03", "Provision dedicated on-premise edge caching appliance for zero egress", 42000.0, 21, "Pending", "Regional Health Authority", None, None),
                ("CR-04", "Fast-track DR site failover drills before regulatory deadline", 9500.0, -10, "Approved", "Karim Chamoun", "Holding PMO", "2026-03-15")
            ]
        },
        {
            "subsidiary_code": "MPS",
            "code": "MPS-PWR-03",
            "name": "Data Center UPS & Power Grid Automation",
            "client": "Telecom Group International",
            "pm": "Marc Haddad",
            "sponsor": "Managing Director - MPS",
            "type": "Fixed Price",
            "status": "Active",
            "priority": "High",
            "start": "2026-02-01",
            "end": "2026-12-15",
            "bac": 750000.0,
            "contract_value": 980000.0,
            "contingency": 70000.0,
            "effort": 5200.0,
            "fte": 7.5,
            "wbs": [
                ("Site Survey & Load Capacity Analysis", "Milestone", 15.0, "2026-02-01", "2026-03-15", 112500.0, "Completed", 1, 1),
                ("Modular UPS & Generator Rack Installation", "Deliverable", 25.0, "2026-03-16", "2026-05-31", 187500.0, "In Progress", 0, 1),
                ("SCADA Power Telemetry & BMS Integration", "Work Package", 35.0, "2026-06-01", "2026-09-30", 262500.0, "Not Started", 0, 1),
                ("Load Testing, Commissioning & Live Handover", "Milestone", 25.0, "2026-10-01", "2026-12-15", 187500.0, "Not Started", 0, 1)
            ],
            "snapshots": [
                ("2026-02-28", 50000.0, 48000.0, 49000.0, "2026-12-15", 350.0, 15.0, 720.0, 2, 2, 0, 6.4, "Site surveys underway."),
                ("2026-03-31", 120000.0, 115000.0, 122000.0, "2026-12-22", 820.0, 40.0, 720.0, 5, 5, 2, 15.3, "Hardware arrived; aligned with CR-06 revised baseline.")
            ],
            "risks": [
                ("RSK-05", "Custom 500kVA transformer shipping & customs clearance delay", 4, 45000.0, "High", "Marc H.", "Open"),
                ("RSK-10", "Substation floor load capacity reinforcement requirement", 3, 65000.0, "High", "Structural Engineer", "Open"),
                ("RSK-11", "SCADA protocol compatibility with legacy chiller controllers", 2, 12000.0, "Low", "Automation PM", "Mitigated")
            ],
            "change_requests": [
                ("CR-05", "Upgrade modular battery strings from Lead-Acid to Lithium-Ion (LiFePO4)", 68000.0, 14, "Pending", "Telecom Group International", None, None),
                ("CR-06", "Add redundant secondary fire suppression sensors in battery vault", 18000.0, 7, "Approved", "Marc Haddad", "Holding PMO", "2026-03-10")
            ]
        },
        {
            "subsidiary_code": "ITB",
            "code": "ITB-GOV-04",
            "name": "Digital Tax & E-Government Workflow Portal",
            "client": "Ministry of Public Finance",
            "pm": "Rima Salameh",
            "sponsor": "Managing Director - ITB",
            "type": "T&M",
            "status": "Active",
            "priority": "Medium",
            "start": "2026-01-10",
            "end": "2026-07-31",
            "bac": 220000.0,
            "contract_value": 290000.0,
            "contingency": 20000.0,
            "effort": 1600.0,
            "fte": 3.0,
            "wbs": [
                ("Digital Citizen Identity & IAM Policy", "Milestone", 30.0, "2026-01-10", "2026-03-10", 66000.0, "Completed", 1, 1),
                ("Electronic Filing & Payment Gateway", "Deliverable", 40.0, "2026-03-11", "2026-05-31", 88000.0, "In Progress", 0, 1),
                ("Audit Trail & Compliance Verification", "Deliverable", 30.0, "2026-06-01", "2026-07-31", 66000.0, "Not Started", 0, 0)
            ],
            "snapshots": [
                ("2026-01-31", 30000.0, 31000.0, 29000.0, "2026-07-31", 220.0, 5.0, 240.0, 3, 3, 0, 14.0, "IAM assessment complete."),
                ("2026-02-28", 68000.0, 70000.0, 66000.0, "2026-07-25", 500.0, 10.0, 240.0, 6, 6, 1, 31.8, "Policy sign-off achieved."),
                ("2026-03-31", 110000.0, 114000.0, 105000.0, "2026-07-19", 780.0, 20.0, 240.0, 9, 9, 1, 51.8, "Excellent progress, 12 days ahead of schedule (CPI = 1.09, SPI = 1.04).")
            ],
            "risks": [
                ("RSK-06", "Government civil status database API throughput throttling", 3, 18000.0, "Medium", "Rima S.", "Open"),
                ("RSK-12", "Digital certificate authority licensing cost revision", 1, 8000.0, "Low", "Legal Counsel", "Closed"),
                ("RSK-13", "Public portal load spike during annual tax filing deadline week", 5, 40000.0, "High", "System Admin", "Open")
            ],
            "change_requests": [
                ("CR-07", "Implement auto-scaling micro-service cluster on national cloud hub", 22000.0, 10, "Pending", "Ministry of Public Finance", None, None)
            ]
        },
        {
            "subsidiary_code": "PCDEAL",
            "code": "PCDEAL-B2B-05",
            "name": "B2B Partner Distribution & Inventory Portal",
            "client": "Regional IT Reseller Network",
            "pm": "Jad Khoury",
            "sponsor": "Managing Director - PCdealNet",
            "type": "Fixed Price",
            "status": "Not Started",
            "priority": "Medium",
            "start": "2026-05-01",
            "end": "2026-11-30",
            "bac": 290000.0,
            "contract_value": 380000.0,
            "contingency": 25000.0,
            "effort": 2100.0,
            "fte": 3.0,
            "wbs": [
                ("ERP Stock Integration & EDI Feeds", "Deliverable", 30.0, "2026-05-01", "2026-06-30", 87000.0, "Not Started", 0, 1),
                ("Automated Credit & Order Checkout", "Deliverable", 40.0, "2026-07-01", "2026-09-30", 116000.0, "Not Started", 0, 1),
                ("Warehouse Dispatch API & Logistics Hook", "Milestone", 30.0, "2026-10-01", "2026-11-30", 87000.0, "Not Started", 0, 1)
            ],
            "snapshots": [],
            "risks": [
                ("RSK-14", "ERP stock sync API rate limits during peak quarterly promotions", 2, 14000.0, "Low", "Jad K.", "Open"),
                ("RSK-15", "Payment gateway interchange fee schedule hike", 2, 22000.0, "Medium", "Commercial Director", "Open")
            ],
            "change_requests": [
                ("CR-08", "Add multi-currency settlement (USD, AED, SAR, EUR) for regional resellers", 31000.0, 18, "Pending", "Jad Khoury", None, None)
            ]
        },
        {
            "subsidiary_code": "ABSEGA",
            "code": "ABSEGA-SEC-06",
            "name": "Enterprise SOC & Zero-Trust Network Access Rollout",
            "client": "Capital Investment Bank",
            "pm": "Tarek Mansour",
            "sponsor": "Managing Director - ABSEGA",
            "type": "Fixed Price",
            "status": "On Hold",
            "priority": "High",
            "start": "2026-01-20",
            "end": "2026-09-30",
            "bac": 310000.0,
            "contract_value": 410000.0,
            "contingency": 30000.0,
            "effort": 2200.0,
            "fte": 3.5,
            "wbs": [
                ("SIEM Log Ingestion & Threat Intelligence Setup", "Milestone", 35.0, "2026-01-20", "2026-03-15", 108500.0, "Completed", 1, 1),
                ("Zero-Trust Network Access (ZTNA) Agent Deployment", "Deliverable", 40.0, "2026-03-16", "2026-06-30", 124000.0, "Blocked", 0, 1),
                ("Automated SOAR Playbooks & Penetration Sign-Off", "Milestone", 25.0, "2026-07-01", "2026-09-30", 77500.0, "Backlog", 0, 1)
            ],
            "snapshots": [
                ("2026-01-31", 32000.0, 31000.0, 30000.0, "2026-09-30", 210.0, 5.0, 320.0, 2, 2, 0, 10.0, "SIEM deployment initiated."),
                ("2026-02-28", 78000.0, 72000.0, 76000.0, "2026-10-15", 510.0, 25.0, 320.0, 4, 4, 1, 23.2, "Client placed phase 2 on hold pending firewall appliance delivery.")
            ],
            "risks": [
                ("RSK-16", "Hardware HSM appliance customs freeze delaying ZTNA cutover", 4, 38000.0, "High", "Tarek M.", "Open")
            ],
            "change_requests": [
                ("CR-09", "Extend SOC log retention archive from 90 days to 365 days", 19500.0, 12, "Pending", "Capital Investment Bank", None, None)
            ]
        },
        {
            "subsidiary_code": "KLAREO",
            "code": "KLAREO-DMS-07",
            "name": "Last-Mile Delivery & Fleet Route Optimization Suite",
            "client": "Gulf Retail Distribution Group",
            "pm": "Maya Nassar",
            "sponsor": "Managing Director - Klareo",
            "type": "T&M",
            "status": "Closed",
            "priority": "Medium",
            "start": "2025-09-01",
            "end": "2026-02-28",
            "bac": 180000.0,
            "contract_value": 245000.0,
            "contingency": 15000.0,
            "effort": 1400.0,
            "fte": 2.5,
            "wbs": [
                ("Geospatial Routing Engine & Driver Mobile App", "Deliverable", 50.0, "2025-09-01", "2025-11-30", 90000.0, "Completed", 1, 1),
                ("Live Fleet Telemetry & Proof-of-Delivery API", "Deliverable", 30.0, "2025-12-01", "2026-01-31", 54000.0, "Completed", 1, 1),
                ("Final Handover & Post-Implementation Sign-Off", "Milestone", 20.0, "2026-02-01", "2026-02-28", 36000.0, "Completed", 1, 1)
            ],
            "snapshots": [
                ("2026-01-31", 150000.0, 152000.0, 146000.0, "2026-02-28", 1180.0, 20.0, 300.0, 8, 8, 1, 84.4, "Telemetry phase completed ahead of schedule."),
                ("2026-02-28", 191000.0, 191000.0, 181000.0, "2026-03-05", 1360.0, 25.0, 300.0, 11, 11, 1, 100.0, "Project formally closed on revised baseline and signed off under budget (CPI = 1.06).")
            ],
            "risks": [
                ("RSK-17", "Mobile GPS battery drain on legacy Android handsets", 2, 12000.0, "Low", "Maya N.", "Closed")
            ],
            "change_requests": [
                ("CR-10", "Add cold-chain temperature sensor alert webhook", 11000.0, 5, "Approved", "Maya Nassar", "Holding PMO", "2026-01-18")
            ]
        }
    ]

    for p in sample_projects:
        sub_id = subs.get(p["subsidiary_code"])
        if not sub_id:
            continue

        cursor.execute(
            """INSERT INTO projects (
                subsidiary_id, project_code, name, client, pm, sponsor, project_type, status, priority,
                baseline_start_date, baseline_end_date, bac, contract_value, contingency_reserve,
                planned_effort_hours, planned_fte, is_locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (
                sub_id, p["code"], p["name"], p["client"], p["pm"], p["sponsor"],
                p["type"], p["status"], p["priority"], p["start"], p["end"],
                p["bac"], p["contract_value"], p["contingency"], p["effort"], p["fte"]
            )
        )
        proj_id = cursor.lastrowid

        for w in p.get("wbs", []):
            cursor.execute(
                """INSERT INTO project_wbs_items (
                    project_id, item_name, item_type, weight_pct, planned_start, planned_finish, allocated_budget, status, is_completed, is_critical_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (proj_id, w[0], w[1], w[2], w[3], w[4], w[5], w[6], w[7], w[8])
            )

        for s in p.get("snapshots", []):
            cursor.execute(
                """INSERT INTO periodic_status_snapshots (
                    project_id, cut_off_date, pv, ev, ac, forecast_completion_date,
                    actual_effort_hours, rework_effort_hours, available_hours,
                    deliverables_submitted, deliverables_accepted, defects_count, overall_progress_pct, pm_comments
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (proj_id, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], s[10], s[11], s[12])
            )

        for r in p.get("risks", []):
            exp = (r[2] / 5.0) * r[3]
            r_status = r[6] if len(r) > 6 else 'Open'
            cursor.execute(
                """INSERT INTO project_risks (
                    project_id, risk_code, description, probability, impact_cost, exposure_cost, severity, owner, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (proj_id, r[0], r[1], r[2], r[3], exp, r[4], r[5], r_status)
            )

        for cr in p.get("change_requests", []):
            cursor.execute(
                """INSERT INTO project_change_requests (
                    project_id, cr_code, description, cost_impact, schedule_impact_days, status, requested_by, approved_by, approval_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (proj_id, cr[0], cr[1], cr[2], cr[3], cr[4], cr[5], cr[6], cr[7])
            )

    conn.commit()
    conn.close()
    print("Seeded realistic multi-affiliate sample portfolio across ITG Holding.")

if __name__ == "__main__":
    seed_itg_sample_portfolio()

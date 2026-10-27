# ITG Holding — Enterprise Project Management & EVM Decision System

An enterprise-grade Project Management and Earned Value Management (EVM) Executive Decision Cockpit engineered specifically for **ITG Holding** and its **15 operating subsidiaries**.

---

## 🏛 Architectural Highlights

- **Zero-Data Foundation (Clean Slate)**: The application is deployed with zero hardcoded dummy data. It boots with ITG Holding's 15 operating subsidiaries pre-configured in the tenant registry.
- **6 Role-Tailored Dashboard Views**:
  1. **Portfolio Overview Dashboard** (CEO & Board Command Center)
  2. **Demand & Capacity Management Dashboard** (Subsidiary MD & PMO View)
  3. **Task-Centric Execution Dashboard** (5-Stage Interactive Kanban & Delivery View)
  4. **Financial Project Dashboard** (CEO & CFO Commercial Governance)
  5. **Budget vs. Actual Dashboard** (Deterministic EVM Cumulative S-Curve & Forecasting)
  6. **Project Timeline & Milestones Dashboard** (Gantt Deliverable Roadmap & Slippage Alert)
- **Deterministic 25 KPI Mathematical Engine**: Implements all 25 performance indicators, ANSI/EIA-748 Earned Value metrics ($PV, EV, AC, CPI, SPI, CV, SV, EAC, VAC$), and automated RAG threshold evaluation rules.
- **Multi-Tier Interactive Filtering**: Persistent global top-bar filters (Subsidiary slicer, Cut-off date, RAG status) + Contextual on-screen slicers.
- **Demonstration Suite**: Includes a 1-click **"Load Sample Data"** button to showcase realistic multi-subsidiary portfolios, and a **"Reset Clean"** button to revert to a pristine Zero-Data state.

---

## 🚀 How to Run the Application

### Option 1: Double-Click Launcher (Windows)
Double-click `run.bat` located in this folder. It will initialize the database, launch the web server on `http://127.0.0.1:8000`, and automatically open your default browser.

### Option 2: Command Line (PowerShell / Terminal)
```powershell
python run_app.py
```
Or with Uvicorn directly:
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 📁 Directory & Infrastructure Structure

```text
project management/
├── app/
│   ├── api/
│   │   ├── routes.py          # REST endpoints for projects, cutoffs, WBS, and dashboards
│   │   └── schemas.py         # Pydantic validation models
│   ├── core/
│   │   └── kpi_engine.py      # Deterministic 25-KPI mathematical calculation engine & RAG
│   ├── db/
│   │   ├── database.py        # SQLite connection, relational schema & 15-subsidiary seed
│   │   └── seed_data.py       # Realistic multi-subsidiary sample data generator for demos
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css      # Modern enterprise executive dashboard stylesheet
│   │   └── js/
│   │       └── app.js         # Reactive client engine, Chart.js integrations & modals
│   ├── templates/
│   │   └── index.html         # Single-page executive cockpit shell & modals
│   └── main.py                # FastAPI main application entry point
├── data/
│   └── itg_projects.db        # Relational database file (generated automatically)
├── run_app.py                 # Cross-platform application runner & auto-browser launcher
├── run.bat                    # One-click Windows batch launcher
├── requirements.txt           # Python package dependencies
└── README.md                  # Comprehensive platform documentation
```

---

## 🏢 Pre-Configured ITG Operating Subsidiaries (15)

1. `ITG-HOLD`: ITG Holding Corporate
2. `ITG-SOFT`: ITG Software Solutions
3. `ITG-CLOD`: ITG Cloud & Infrastructure
4. `ITG-TELC`: ITG Telecom Systems
5. `ITG-SECU`: ITG Cybersecurity & Defense
6. `ITG-HARD`: ITG Hardware & Devices
7. `ITG-INFR`: ITG Network Infrastructure
8. `ITG-SERV`: ITG Managed Services
9. `ITG-SOLU`: ITG Business Solutions
10. `ITG-DIGI`: ITG Digital Transformation
11. `ITG-SMRT`: ITG Smart Building & IoT
12. `ITG-SYST`: ITG Banking & Financial Systems
13. `ITG-NETW`: ITG Unified Communications
14. `ITG-CONS`: ITG Strategic Consultancy
15. `ITG-TECH`: ITG Advanced Technologies

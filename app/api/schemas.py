from pydantic import BaseModel, Field
from typing import Optional, List

class ProjectCreate(BaseModel):
    subsidiary_id: int
    project_code: str
    name: str
    client: str
    pm: str
    sponsor: str
    project_type: str = "Fixed-Price" # Fixed-Price, Time & Materials, Internal R&D, Non-Billable
    status: str = "Active"             # Pipeline, Active, On Hold, Completed
    priority: str = "Medium"          # High, Medium, Low
    baseline_start_date: str          # YYYY-MM-DD
    baseline_end_date: str            # YYYY-MM-DD
    bac: float                        # Budget at Completion ($)
    contract_value: float             # Commercial Value ($)
    contingency_reserve: Optional[float] = 0.0
    planned_effort_hours: float       # Effort Hours
    planned_fte: Optional[float] = 1.0

class WBSItemCreate(BaseModel):
    item_name: str
    item_type: str = "Deliverable"    # Milestone, Deliverable, Work Package
    weight_pct: float                 # 0 to 100
    planned_start: str
    planned_finish: str
    allocated_budget: Optional[float] = 0.0
    status: Optional[str] = "Not Started"
    is_critical_path: Optional[int] = 0

class ProjectWithWBSCreate(BaseModel):
    project: ProjectCreate
    wbs_items: Optional[List[WBSItemCreate]] = []

class PeriodicSnapshotCreate(BaseModel):
    project_id: int
    cut_off_date: str                 # YYYY-MM-DD
    pv: float                         # Cumulative Planned Value ($)
    ev: float                         # Cumulative Earned Value ($)
    ac: float                         # Cumulative Actual Cost ($)
    forecast_completion_date: Optional[str] = None
    actual_effort_hours: Optional[float] = 0.0
    rework_effort_hours: Optional[float] = 0.0
    available_hours: Optional[float] = 160.0
    deliverables_submitted: Optional[int] = 0
    deliverables_accepted: Optional[int] = 0
    defects_count: Optional[int] = 0
    overall_progress_pct: Optional[float] = 0.0
    pm_comments: Optional[str] = ""

class RiskCreate(BaseModel):
    project_id: int
    risk_code: str
    description: str
    probability: int                  # 1 to 5
    impact_cost: float                # $
    severity: str = "Medium"          # Low, Medium, High, Critical
    owner: str

class ChangeRequestCreate(BaseModel):
    project_id: int
    cr_code: str
    description: str
    cost_impact: float = 0.0
    schedule_impact_days: int = 0
    requested_by: str
    status: str = "Pending"

class RiskStatusUpdate(BaseModel):
    status: str # 'Open', 'Mitigated', 'Closed'

class ChangeRequestStatusUpdate(BaseModel):
    status: str # 'Pending', 'Approved', 'Rejected'
    approved_by: Optional[str] = "Holding PMO"


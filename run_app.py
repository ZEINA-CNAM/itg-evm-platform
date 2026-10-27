import os
import sys
import webbrowser
import threading
import time

def start_server():
    import uvicorn
    # Add project root to sys.path
    project_root = os.path.dirname(os.path.abspath(__file__))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    from app.db.database import init_db
    init_db()

    print("================================================================================")
    print(" ITG HOLDING — ENTERPRISE PROJECT MANAGEMENT & EVM DECISION SYSTEM")
    print("================================================================================")
    print(" Server running on: http://127.0.0.1:8000")
    print(" Multi-Tenant: Pre-configured for ITG Holding's 18 Operating Affiliates across 4 Clusters")
    print(" Architecture: Zero-Data Foundation (Clean-Slate Ready for Onboarding)")
    print(" Interactive 6-Screen Cockpit with Real-time 25 KPI Computation Engine")
    print(" Press Ctrl+C to terminate.")
    print("================================================================================")

    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://127.0.0.1:8000")

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    start_server()

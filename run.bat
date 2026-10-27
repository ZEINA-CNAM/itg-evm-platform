@echo off
title ITG Holding - Enterprise Project Management System
echo =====================================================================
echo  Starting ITG Holding Project Management & EVM Decision System...
echo =====================================================================
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python run_app.py
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        py run_app.py
    ) else (
        echo [ERROR] Python was not found in your system PATH.
        echo Please ensure Python 3.10+ is installed.
    )
)
pause

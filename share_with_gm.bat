@echo off
title ITG EVM Platform - Public Link for GM
echo ========================================================
echo   Starting Secure Live Web Tunnel for General Manager
echo ========================================================
echo.
echo Make sure the platform is running (run.bat).
echo Generating your live HTTPS link...
echo.
"%~dp0tools\cloudflared.exe" tunnel --url http://127.0.0.1:8000
pause

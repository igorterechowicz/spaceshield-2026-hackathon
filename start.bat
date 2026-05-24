@echo off
title Local Server
cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% == 0 (
    python server.py
    goto end
)

python3 --version >nul 2>&1
if %errorlevel% == 0 (
    python3 server.py
    goto end
)

echo Python is not installed or not in PATH.
echo Please install it from https://www.python.org/downloads/
pause
exit /b 1

:end

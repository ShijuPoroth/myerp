@echo off
cd /d "%~dp0"
echo Starting MWH Management System...
echo.
echo Checking for existing server instances...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Existing server instance closed.
) else (
    echo No existing server instance found.
)
echo.
echo Starting new server instance...
node server.js
pause

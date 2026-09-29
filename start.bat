@echo off
setlocal
title DataLyze Launcher
cd /d "%~dp0"

echo ============================================
echo   DataLyze - Starting all services
echo ============================================
echo.

REM ── 1. MongoDB ────────────────────────────────
echo [1/4] Starting MongoDB on port 27017...
where mongod >nul 2>nul
if %errorlevel%==0 (
  start "DataLyze - MongoDB" cmd /k "mongod"
) else (
  echo      WARNING: mongod not found in PATH.
  echo      Make sure MongoDB is installed or already running.
)
timeout /t 3 /nobreak >nul

REM ── 2. Backend (Express) ──────────────────────
echo [2/4] Starting Backend on port 5000...
start "DataLyze - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /nobreak >nul

REM ── 3. ML Service (FastAPI) ───────────────────
echo [3/4] Starting ML Service on port 8000...
if exist "%~dp0ml-service\venv\Scripts\activate.bat" (
  start "DataLyze - ML" cmd /k "cd /d "%~dp0ml-service" && call venv\Scripts\activate.bat && python main.py"
) else if exist "%~dp0ml-service\.venv\Scripts\activate.bat" (
  start "DataLyze - ML" cmd /k "cd /d "%~dp0ml-service" && call .venv\Scripts\activate.bat && python main.py"
) else (
  start "DataLyze - ML" cmd /k "cd /d "%~dp0ml-service" && python main.py"
)
timeout /t 3 /nobreak >nul

REM ── 4. Frontend (Vite) ────────────────────────
echo [4/4] Starting Frontend on port 3000...
start "DataLyze - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================
echo   All services launched in separate windows.
echo ============================================
echo   MongoDB  :  mongodb://localhost:27017
echo   Backend  :  http://localhost:5000
echo   ML API   :  http://localhost:8000
echo   Frontend :  http://localhost:3000
echo ============================================
echo.
echo Opening frontend in your browser...
timeout /t 5 /nobreak >nul
start "" http://localhost:3000

echo.
echo Close the individual windows to stop each service.
echo Press any key to close this launcher window...
pause >nul
endlocal
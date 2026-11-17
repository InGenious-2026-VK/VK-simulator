@echo off
REM ---------------------------------------------------------------------------
REM  FoodChainIQ - one-click dev launcher (Windows)
REM
REM  1. starts PostgreSQL with Docker Compose (if Docker Desktop is running),
REM  2. installs / updates backend + frontend dependencies when they changed,
REM  3. starts the backend  (http://localhost:8000) in its own window and
REM     waits until it is healthy,
REM  4. starts the frontend (http://localhost:5173) in its own window and
REM     opens it in the browser.
REM
REM  Close the two server windows (or press Ctrl+C in them) to stop the app.
REM  Without Docker, run your own PostgreSQL and set DATABASE_URL in
REM  backend\.env (see backend\.env.example).
REM ---------------------------------------------------------------------------

setlocal
cd /d "%~dp0"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"
set "APP_URL=http://localhost:%FRONTEND_PORT%"

echo.
echo === FoodChainIQ ===
echo.

REM --- prerequisites ----------------------------------------------------------
where python >nul 2>nul || (echo [error] Python 3.10+ is required - install it from python.org and tick "Add to PATH". & goto :error)
python -c "import sys; sys.exit(sys.version_info < (3, 10))" || (echo [error] Python 3.10 or newer is required. & goto :error)
where node >nul 2>nul || (echo [error] Node.js 20+ is required - install it from nodejs.org. & goto :error)
where npm >nul 2>nul || (echo [error] npm is required. & goto :error)

call :port_free %BACKEND_PORT% || (echo [error] Port %BACKEND_PORT% is already in use - is FoodChainIQ already running? & goto :error)
call :port_free %FRONTEND_PORT% || (echo [error] Port %FRONTEND_PORT% is already in use - is FoodChainIQ already running? & goto :error)

REM --- database ---------------------------------------------------------------
where docker >nul 2>nul
if errorlevel 1 (
    echo [db] Docker not found - using the PostgreSQL from backend\.env.
    goto :after_docker
)
docker info >nul 2>nul
if errorlevel 1 (
    echo [db] Docker is installed but not running - start Docker Desktop, or use your own PostgreSQL.
    goto :after_docker
)
echo [db] Starting PostgreSQL ^(docker compose up -d db^)...
docker compose up -d db >nul
if errorlevel 1 (
    echo [error] docker compose failed. See the messages above.
    goto :error
)
:after_docker

REM --- backend dependencies ---------------------------------------------------
if not exist "backend\.venv\Scripts\python.exe" (
    echo [setup] Creating Python virtual environment...
    python -m venv backend\.venv || goto :error
)
fc /b "backend\requirements.txt" "backend\.venv\requirements.installed" >nul 2>nul
if errorlevel 1 (
    echo [setup] Installing backend dependencies...
    backend\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
    backend\.venv\Scripts\python.exe -m pip install --quiet -r backend\requirements.txt || goto :error
    copy /y "backend\requirements.txt" "backend\.venv\requirements.installed" >nul
)

REM --- frontend dependencies --------------------------------------------------
fc /b "frontend\package-lock.json" "frontend\node_modules\.fciq-package-lock.json" >nul 2>nul
if errorlevel 1 (
    echo [setup] Installing frontend dependencies ^(npm install^)...
    pushd frontend
    call npm install --no-audit --no-fund || (popd & goto :error)
    popd
    copy /y "frontend\package-lock.json" "frontend\node_modules\.fciq-package-lock.json" >nul
)

REM --- wait for the database --------------------------------------------------
pushd backend
.venv\Scripts\python.exe -m app.check_db --timeout 60
if errorlevel 1 (popd & goto :error)
popd

REM --- backend ----------------------------------------------------------------
echo [run] Starting backend on http://localhost:%BACKEND_PORT% ...
start "FoodChainIQ - backend" /d "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --port %BACKEND_PORT%"
call :wait_for http://127.0.0.1:%BACKEND_PORT%/api/health 90
if errorlevel 1 (
    echo [error] The backend did not start - see the "FoodChainIQ - backend" window.
    goto :error
)
echo [run] Backend is up ^(API docs: http://localhost:%BACKEND_PORT%/docs^).

REM --- frontend ---------------------------------------------------------------
echo [run] Starting frontend on %APP_URL% ...
start "FoodChainIQ - frontend" /d "%~dp0frontend" cmd /k "npm run dev -- --port %FRONTEND_PORT% --strictPort"
call :wait_for http://127.0.0.1:%FRONTEND_PORT%/ 60
if errorlevel 1 (
    echo [error] The frontend did not start - see the "FoodChainIQ - frontend" window.
    goto :error
)

echo.
echo [ready] FoodChainIQ is running at %APP_URL%
echo         Close the two server windows ^(or press Ctrl+C in them^) to stop it.
echo.
if not "%NO_BROWSER%"=="1" start "" %APP_URL%
goto :eof

REM ---------------------------------------------------------------------------
REM  :wait_for <url> <seconds>  - poll until the URL answers (errorlevel 0) or time out (1)
:wait_for
powershell -NoProfile -Command "$u='%~1'; for($i=0; $i -lt %~2; $i++){ try { Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
exit /b %errorlevel%

REM  :port_free <port>  - errorlevel 0 when nothing is listening on the port
:port_free
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul
if errorlevel 1 (exit /b 0) else (exit /b 1)

:error
echo.
echo [error] FoodChainIQ could not be started. See the messages above.
pause
exit /b 1

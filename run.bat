@echo off
REM ---------------------------------------------------------------------------
REM  FoodChainIQ - one-click dev launcher (Windows)
REM
REM  Starts PostgreSQL (Docker, if available), the Python backend (port 8000)
REM  and the Vite dev server (port 5173), each in its own window, then opens
REM  the app in a browser. First run also creates the Python venv and installs
REM  dependencies. Without Docker, run your own PostgreSQL and set
REM  DATABASE_URL in backend\.env (see backend\.env.example).
REM ---------------------------------------------------------------------------

setlocal
cd /d "%~dp0"

echo.
echo === FoodChainIQ ===
echo.

REM --- database ---------------------------------------------------------------
where docker >nul 2>nul
if %errorlevel%==0 (
    echo [db] Starting PostgreSQL via docker compose...
    docker compose up -d db
) else (
    echo [db] Docker not found - make sure PostgreSQL is running ^(see backend\.env.example^).
)

REM --- backend setup ---------------------------------------------------------
if not exist "backend\.venv\Scripts\python.exe" (
    echo [setup] Creating Python virtual environment...
    python -m venv backend\.venv || goto :error
    echo [setup] Installing backend dependencies...
    backend\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
    backend\.venv\Scripts\python.exe -m pip install --quiet -r backend\requirements.txt || goto :error
)

REM --- frontend setup -------------------------------------------------------
if not exist "Implementation\node_modules" (
    echo [setup] Installing frontend dependencies ^(npm install^)...
    pushd frontend
    call npm install || (popd & goto :error)
    popd
)

REM --- launch ---------------------------------------------------------------
echo [run] Starting backend on http://localhost:8000 ...
start "FoodChainIQ - backend" /d "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [run] Starting web app on http://localhost:5173 ...
start "FoodChainIQ - frontend" /d "%~dp0frontend" cmd /k "npm run dev"

REM give the servers a moment, then open the browser
ping -n 5 127.0.0.1 >nul
start "" http://localhost:5173

echo.
echo Both servers are starting in their own windows.
echo Close those windows (or press Ctrl+C in them) to stop the app.
echo.
goto :eof

:error
echo.
echo [error] Setup failed. See the messages above.
pause
exit /b 1

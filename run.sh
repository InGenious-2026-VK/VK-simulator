#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  FoodChainIQ — one-command dev launcher (macOS / Linux)
#
#  1. starts PostgreSQL with Docker Compose (if Docker is available),
#  2. installs / updates backend + frontend dependencies when they changed,
#  3. starts the backend  (http://localhost:8000) and waits until it is healthy,
#  4. starts the frontend (http://localhost:5173) and opens it in the browser.
#
#  Ctrl+C stops both servers (the database container keeps running;
#  stop it with `docker compose stop db`).
#
#  Options (environment variables):
#    NO_BROWSER=1   don't open the browser
#    NO_DOCKER=1    don't touch Docker; use the PostgreSQL in backend/.env
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

BACKEND_PORT=8000
FRONTEND_PORT=5173
APP_URL="http://localhost:${FRONTEND_PORT}"

say()  { printf '\033[1;36m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { printf '\033[1;31m[error]\033[0m %s\n' "$1" >&2; exit 1; }

port_busy() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}

wait_for_url() { # url, seconds, pid-to-watch
  local url=$1 secs=$2 pid=$3 i
  for ((i = 0; i < secs; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then return 0; fi
    kill -0 "$pid" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

echo
echo "=== FoodChainIQ ==="
echo

# --- prerequisites ----------------------------------------------------------
PYTHON=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
    PYTHON=$cand; break
  fi
done
[ -n "$PYTHON" ] || fail "Python 3.10+ is required (python3 not found or too old)."
command -v node >/dev/null 2>&1 || fail "Node.js 20+ is required (node not found)."
command -v npm  >/dev/null 2>&1 || fail "npm is required (npm not found)."
command -v curl >/dev/null 2>&1 || fail "curl is required."

for p in $BACKEND_PORT $FRONTEND_PORT; do
  port_busy "$p" && fail "Port $p is already in use — is FoodChainIQ already running? Stop it first."
done

# --- database ---------------------------------------------------------------
if [ "${NO_DOCKER:-0}" != "1" ] && command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose); else COMPOSE=(docker-compose); fi
    say db "Starting PostgreSQL (docker compose up -d db)…"
    "${COMPOSE[@]}" up -d db >/dev/null
  else
    say db "Docker is installed but not running — using the PostgreSQL from backend/.env."
  fi
else
  say db "Using the PostgreSQL from backend/.env (or the default localhost:5432)."
fi

# --- backend dependencies ---------------------------------------------------
VENV="$ROOT/backend/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  say setup "Creating Python virtual environment…"
  "$PYTHON" -m venv "$VENV"
fi
if ! cmp -s backend/requirements.txt "$VENV/.requirements.installed"; then
  say setup "Installing backend dependencies…"
  "$VENV/bin/python" -m pip install --quiet --upgrade pip
  "$VENV/bin/python" -m pip install --quiet -r backend/requirements.txt
  cp backend/requirements.txt "$VENV/.requirements.installed"
fi

# --- frontend dependencies --------------------------------------------------
if ! cmp -s frontend/package-lock.json frontend/node_modules/.fciq-package-lock.json; then
  say setup "Installing frontend dependencies (npm install)…"
  (cd frontend && npm install --no-audit --no-fund)
  cp frontend/package-lock.json frontend/node_modules/.fciq-package-lock.json
fi

# --- wait for the database --------------------------------------------------
(cd backend && "$VENV/bin/python" -m app.check_db --timeout 60) || exit 1

# --- start servers ----------------------------------------------------------
PIDS=()
kill_tree() { # pid — stop a process and all its descendants
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}
cleanup() {
  trap - INT TERM EXIT
  echo
  say stop "Stopping servers…"
  for pid in "${PIDS[@]}"; do kill_tree "$pid"; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

say run "Starting backend on http://localhost:${BACKEND_PORT} …"
(cd backend && exec "$VENV/bin/python" -m uvicorn app.main:app --reload --port "$BACKEND_PORT") &
PIDS+=($!)
wait_for_url "http://127.0.0.1:${BACKEND_PORT}/api/health" 90 "${PIDS[0]}" \
  || fail "The backend did not start — see the messages above."
say run "Backend is up (API docs: http://localhost:${BACKEND_PORT}/docs)."

say run "Starting frontend on ${APP_URL} …"
(cd frontend && exec node node_modules/vite/bin/vite.js --port "$FRONTEND_PORT" --strictPort) &
PIDS+=($!)
wait_for_url "http://127.0.0.1:${FRONTEND_PORT}/" 60 "${PIDS[1]}" \
  || fail "The frontend did not start — see the messages above."

echo
say ready "FoodChainIQ is running at ${APP_URL}   (Ctrl+C to stop)"
echo
if [ "${NO_BROWSER:-0}" != "1" ]; then
  if command -v open >/dev/null 2>&1; then open "$APP_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$APP_URL" >/dev/null 2>&1 || true
  fi
fi

# Exit (and stop the other server) as soon as either one stops.
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 1; done
say stop "A server stopped — shutting down."

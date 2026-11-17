#!/usr/bin/env bash
# FoodChainIQ — dev launcher for macOS / Linux.
# Starts PostgreSQL (Docker, if available), the backend (port 8000) and the
# frontend (port 5173). Ctrl+C stops both servers.
set -euo pipefail
cd "$(dirname "$0")"

if command -v docker >/dev/null 2>&1; then
  echo "[db] Starting PostgreSQL via docker compose…"
  docker compose up -d --wait db
else
  echo "[db] Docker not found — make sure PostgreSQL is running (see backend/.env.example)."
fi

if [ ! -x backend/.venv/bin/python ]; then
  echo "[setup] Creating Python venv…"
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
fi
if [ ! -d frontend/node_modules ]; then
  echo "[setup] npm install…"
  (cd frontend && npm install)
fi

(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
cd frontend && npm run dev

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_UVICORN="$BACKEND_DIR/.venv/bin/uvicorn"
NEXT_BIN="$FRONTEND_DIR/node_modules/.bin/next"
BACKEND_PID=""
FRONTEND_PID=""

fail() {
  printf '\033[1;31m[start error]\033[0m %s\n' "$1" >&2
  exit 1
}

terminate_tree() {
  local parent_pid="$1"
  local child_pid

  if ! kill -0 "$parent_pid" 2>/dev/null; then
    return
  fi

  if command -v pgrep >/dev/null 2>&1; then
    while read -r child_pid; do
      [ -n "$child_pid" ] && terminate_tree "$child_pid"
    done < <(pgrep -P "$parent_pid" 2>/dev/null || true)
  fi

  kill -TERM "$parent_pid" 2>/dev/null || true
}

cleanup() {
  trap - INT TERM EXIT
  printf '\nStopping GradeFlow...\n'

  [ -n "$BACKEND_PID" ] && terminate_tree "$BACKEND_PID"
  [ -n "$FRONTEND_PID" ] && terminate_tree "$FRONTEND_PID"

  sleep 1

  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill -KILL "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill -KILL "$FRONTEND_PID" 2>/dev/null || true
  fi

  [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && wait "$FRONTEND_PID" 2>/dev/null || true
}

[ -x "$VENV_UVICORN" ] || fail "Backend dependencies are missing. Run ./setup.sh first."
[ -x "$NEXT_BIN" ] || fail "Frontend dependencies are missing. Run ./setup.sh first."
[ -f "$BACKEND_DIR/.env" ] || fail "backend/.env is missing. Run ./setup.sh first."
[ -f "$FRONTEND_DIR/.env.local" ] || [ -f "$FRONTEND_DIR/.env" ] || fail "frontend/.env.local or frontend/.env is missing. Run ./setup.sh first."

(
  cd "$BACKEND_DIR"
  "$BACKEND_DIR/.venv/bin/python" - <<'PY'
from app.core.config import get_settings

get_settings()
PY
) || fail "backend/.env is invalid. Check required values and make sure JWT_SECRET is at least 24 characters."

trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

printf '\033[1;34mStarting FastAPI at http://localhost:8000\033[0m\n'
(
  cd "$BACKEND_DIR"
  exec "$VENV_UVICORN" app.main:app --reload --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

printf '\033[1;34mStarting Next.js at http://localhost:3000\033[0m\n'
(
  cd "$FRONTEND_DIR"
  exec "$NEXT_BIN" dev --hostname 127.0.0.1
) &
FRONTEND_PID=$!

printf '\nGradeFlow is running. Press Ctrl+C to stop both services.\n\n'

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID" || true
    fail "The backend stopped unexpectedly."
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    wait "$FRONTEND_PID" || true
    fail "The frontend stopped unexpectedly."
  fi
  sleep 2
done

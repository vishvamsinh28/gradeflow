#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

info() {
  printf '\n\033[1;34m[setup]\033[0m %s\n' "$1"
}

fail() {
  printf '\n\033[1;31m[setup error]\033[0m %s\n' "$1" >&2
  exit 1
}

frontend_dependencies_installed() {
  cd "$FRONTEND_DIR"
  [ -x node_modules/.bin/next ] && npm ls --depth=0 >/dev/null 2>&1
}

install_frontend_dependencies() {
  cd "$FRONTEND_DIR"

  if frontend_dependencies_installed; then
    info "Frontend dependencies are already installed"
    return
  fi

  info "Installing frontend dependencies"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund --loglevel=info || fail "Frontend dependency install failed. Check your npm registry/network and run ./setup.sh again."
  else
    npm install --no-audit --no-fund --loglevel=info || fail "Frontend dependency install failed. Check your npm registry/network and run ./setup.sh again."
  fi
}

select_python() {
  local candidate uv_python_dir

  uv_python_dir="$HOME/.local/share/uv/python"
  if [ -d "$uv_python_dir" ]; then
    while IFS= read -r candidate; do
      if python_candidate_usable "$candidate"; then
        printf '%s\n' "$candidate"
        return
      fi
    done < <(find "$uv_python_dir" -path "*/bin/python3*" -type f 2>/dev/null | sort -r)
  fi

  for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && python_candidate_usable "$candidate"; then
      command -v "$candidate"
      return
    fi
  done
}

python_candidate_usable() {
  "$1" - <<'PY' >/dev/null 2>&1
import sys
if sys.version_info < (3, 11):
    raise SystemExit(1)
import ensurepip
from xml.parsers import expat
PY
}

venv_is_usable() {
  [ -x "$BACKEND_DIR/.venv/bin/python" ] && "$BACKEND_DIR/.venv/bin/python" -m pip --version >/dev/null 2>&1
}

PYTHON_BIN="$(select_python)"
[ -n "$PYTHON_BIN" ] || fail "Python 3.11+ is required. Install Python 3.11 or newer, then run setup again."
command -v node >/dev/null 2>&1 || fail "Node.js 20+ is required but node was not found."
command -v npm >/dev/null 2>&1 || fail "npm is required but was not found."

PYTHON_VERSION="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js 20 or newer is required. Found $(node --version)."
fi

info "Preparing backend virtual environment"
if [ -d "$BACKEND_DIR/.venv" ] && ! venv_is_usable; then
  info "Recreating incomplete backend virtual environment"
  rm -rf "$BACKEND_DIR/.venv"
fi

if [ ! -d "$BACKEND_DIR/.venv" ]; then
  "$PYTHON_BIN" -m venv "$BACKEND_DIR/.venv" || fail "Could not create backend virtual environment with Python $PYTHON_VERSION."
fi

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
  fail "The virtual environment was created incorrectly. Remove backend/.venv and run setup again."
fi

"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -e "$BACKEND_DIR[dev]"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  JWT_SECRET_VALUE="$("$VENV_PYTHON" -c 'import secrets; print(secrets.token_urlsafe(48))')"
  "$VENV_PYTHON" - "$BACKEND_DIR/.env" "$JWT_SECRET_VALUE" <<'ENVWRITE'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
secret = sys.argv[2]
lines = env_path.read_text().splitlines()
updated = [f"JWT_SECRET={secret}" if line.startswith("JWT_SECRET=") else line for line in lines]
env_path.write_text("\n".join(updated) + "\n")
ENVWRITE
  info "Created backend/.env with a generated JWT secret"
else
  info "Keeping existing backend/.env"
fi

install_frontend_dependencies

if [ -f "$FRONTEND_DIR/.env.local" ]; then
  info "Keeping existing frontend/.env.local"
elif [ -f "$FRONTEND_DIR/.env" ]; then
  info "Keeping existing frontend/.env"
else
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
  info "Created frontend/.env.local from frontend/.env.example"
fi

printf '\n\033[1;32mSetup complete.\033[0m\n'
printf '1. Add your Supabase, Gemini, JWT, and optional LangSmith values to backend/.env.\n'
printf '2. Run the database schema with: make db-setup\n'
printf '3. Start the app with: ./start.sh\n\n'

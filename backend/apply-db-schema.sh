#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
SCHEMA_FILE="$BACKEND_DIR/supabase/schema.sql"
MIGRATIONS_DIR="$BACKEND_DIR/supabase/migrations"

info() {
  printf '\n\033[1;34m[db]\033[0m %s\n' "$1"
}

fail() {
  printf '\n\033[1;31m[db error]\033[0m %s\n' "$1" >&2
  exit 1
}

env_value() {
  local key="$1"
  python3 - "$ENV_FILE" "$key" <<'PY'
import os
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
key = sys.argv[2]

if os.environ.get(key):
    print(os.environ[key])
    raise SystemExit(0)

if not env_path.exists():
    raise SystemExit(0)

for raw_line in env_path.read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    name, value = line.split("=", 1)
    if name.strip() == key:
        print(value.strip().strip('"').strip("'"))
        break
PY
}

command -v psql >/dev/null 2>&1 || fail "psql is required. Install PostgreSQL client tools, then retry."
[ -f "$SCHEMA_FILE" ] || fail "Could not find backend/supabase/schema.sql."

DB_URL_VALUE="$(env_value DB_URL)"
[ -n "$DB_URL_VALUE" ] || fail "Set DB_URL in backend/.env or the shell before running this script."

info "Applying backend/supabase/schema.sql"
psql "$DB_URL_VALUE" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"

if [ -d "$MIGRATIONS_DIR" ]; then
  for migration in "$MIGRATIONS_DIR"/*.sql; do
    [ -e "$migration" ] || continue
    info "Applying ${migration#$BACKEND_DIR/}"
    psql "$DB_URL_VALUE" -v ON_ERROR_STOP=1 -f "$migration"
  done
fi

printf '\n\033[1;32mDatabase schema applied.\033[0m\n'

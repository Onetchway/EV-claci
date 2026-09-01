#!/usr/bin/env bash
# One-shot local dev setup for the whole Alpha platform + a demo tenant
# ("Xpulse") on the shared backend/+frontend/ CRM, path-routed at /xpulse.
#
# Brings up 4 apps:
#   platform/backend   :5100  (super admin API)
#   platform/frontend  :3100  (super admin UI)
#   backend            :5050  (tenant CRM API, shared/path-tenant mode)
#   frontend           :3000  (tenant CRM UI, shared/path-tenant mode)
#
# Usage:
#   ./scripts/dev-setup.sh
#
# Override the Postgres role/password/host if your local setup needs it
# (e.g. Homebrew Postgres uses your OS username, not "postgres"):
#   PGUSER=$(whoami) PGPASSWORD= PGHOST=localhost ./scripts/dev-setup.sh
#
# Safe to re-run — every step is idempotent (createdb/schema use
# IF NOT EXISTS / ON CONFLICT, and npm install/seed are no-ops or
# upserts on a second run).
set -euo pipefail
cd "$(dirname "$0")/.."

PGUSER="${PGUSER:-postgres}"
# ":-" would treat PGPASSWORD='' (explicitly no password, e.g. Homebrew
# Postgres's default trust auth) the same as unset and default it to
# "postgres" anyway — "-" only substitutes when the variable is truly
# unset, so an intentional empty string is preserved.
PGPASSWORD_VAL="${PGPASSWORD-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PLATFORM_DB="${PLATFORM_DB:-alpha_platform}"
TENANT_DB="${TENANT_DB:-alpha_tenant_crm}"

SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@alpha.com}"
SUPER_ADMIN_NAME="${SUPER_ADMIN_NAME:-Alpha Admin}"
SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-Passw0rd!}"

TENANT_SLUG="${TENANT_SLUG:-xpulse}"
TENANT_NAME="${TENANT_NAME:-Xpulse}"
TENANT_ADMIN_EMAIL="${TENANT_ADMIN_EMAIL:-admin@xpulse.example}"
TENANT_ADMIN_NAME="${TENANT_ADMIN_NAME:-Xpulse Admin}"
TENANT_ADMIN_PASSWORD="${TENANT_ADMIN_PASSWORD:-Passw0rd!}"

FRANCHISE_NAME="${FRANCHISE_NAME:-Xpulse Downtown Franchise}"
FRANCHISE_PORTAL_EMAIL="${FRANCHISE_PORTAL_EMAIL:-franchise@xpulse.example}"
FRANCHISE_PORTAL_NAME="${FRANCHISE_PORTAL_NAME:-Downtown Franchise Partner}"
FRANCHISE_PORTAL_PASSWORD="${FRANCHISE_PORTAL_PASSWORD:-Passw0rd!}"

export PGPASSWORD="$PGPASSWORD_VAL"
PSQL="psql -h $PGHOST -p $PGPORT -U $PGUSER -v ON_ERROR_STOP=1"
DB_URL_BASE="postgresql://${PGUSER}:${PGPASSWORD_VAL}@${PGHOST}:${PGPORT}"

# Runs a curl (args after --) and extracts one field with the given node
# expression, retrying if the server isn't quite ready yet (a fresh
# nodemon start can still be mid-restart for the first request or two,
# which otherwise fails as an empty-body JSON parse error). Exits the
# whole script with a clear message if it never succeeds.
curl_json_field() {
  local expr="$1"; shift
  local body attempt
  for attempt in $(seq 1 15); do
    body=$(curl -s "$@") || body=""
    if [ -n "$body" ]; then
      if result=$(printf '%s' "$body" | node -pe "$expr" 2>/dev/null) && [ -n "$result" ] && [ "$result" != "undefined" ]; then
        printf '%s' "$result"
        return 0
      fi
    fi
    sleep 1
  done
  echo "Request never returned a usable response after 15 attempts: curl $*" >&2
  echo "Last response body: $body" >&2
  exit 1
}

# Kills anything already listening on a port before starting a server on
# it — a re-run of this script (or a server left running in another
# terminal) otherwise makes the new nodemon crash-loop on EADDRINUSE,
# which then shows up several steps later as a confusing "server never
# responded" error instead of the actual port conflict.
free_port() {
  local port="$1" pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "    :$port already in use (pid $pids) — stopping it first."
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

# Waits for a server to actually be listening (not just "eventually", so a
# crash-looping nodemon fails fast with its own log instead of the caller
# hitting a confusing empty-response error several steps later).
wait_for_port() {
  local port="$1" log="$2" i
  for i in $(seq 1 40); do
    if [ -n "$(lsof -ti tcp:"$port" 2>/dev/null || true)" ]; then return 0; fi
    sleep 0.5
  done
  echo "Server on :$port never started. Last 30 lines of $log:" >&2
  tail -30 "$log" >&2 || true
  exit 1
}

echo "==> Checking Postgres connectivity ($PGUSER@$PGHOST:$PGPORT)..."
if ! $PSQL -d postgres -tAc "select 1" >/dev/null; then
  echo "Could not connect to Postgres as '$PGUSER'. Set PGUSER/PGPASSWORD/PGHOST/PGPORT and retry." >&2
  echo "e.g. on Homebrew Postgres:  PGUSER=\$(whoami) PGPASSWORD= ./scripts/dev-setup.sh" >&2
  exit 1
fi

echo "==> Creating databases (skips if they already exist)..."
$PSQL -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PLATFORM_DB'" | grep -q 1 || $PSQL -d postgres -c "CREATE DATABASE $PLATFORM_DB"
$PSQL -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$TENANT_DB'" | grep -q 1 || $PSQL -d postgres -c "CREATE DATABASE $TENANT_DB"

echo "==> Loading platform schema..."
$PSQL -d "$PLATFORM_DB" -f platform/database/schema.sql >/dev/null
for f in platform/database/migrations/*.sql; do $PSQL -d "$PLATFORM_DB" -f "$f" >/dev/null; done

echo "==> Loading tenant CRM schema..."
$PSQL -d "$TENANT_DB" -f database/schema.sql >/dev/null
$PSQL -d "$TENANT_DB" -f database/nakjm_schema.sql >/dev/null
$PSQL -d "$TENANT_DB" -f database/nakjm_documents_schema.sql >/dev/null
for f in database/migrations/*.sql; do $PSQL -d "$TENANT_DB" -f "$f" >/dev/null; done

write_env() {
  local file="$1"; shift
  if [ -f "$file" ]; then
    echo "    $file already exists, leaving it as-is."
    return
  fi
  printf '%s\n' "$@" > "$file"
  echo "    wrote $file"
}

echo "==> Writing .env files (only where missing)..."
write_env platform/backend/.env \
  "PORT=5100" \
  "DATABASE_URL=${DB_URL_BASE}/${PLATFORM_DB}" \
  "JWT_SECRET=dev-test-secret-for-sandbox-only" \
  "FRONTEND_URL=http://localhost:3100" \
  "NODE_ENV=development" \
  "PLATFORM_BASE_DOMAIN=alpha.app"

write_env platform/frontend/.env.local \
  "NEXT_PUBLIC_API_URL=http://localhost:5100/api" \
  "NEXT_PUBLIC_BASE_DOMAIN=alpha.app"

write_env backend/.env \
  "PORT=5050" \
  "DATABASE_URL=${DB_URL_BASE}/${TENANT_DB}" \
  "JWT_SECRET=dev-test-secret-for-sandbox-only" \
  "ALLOWED_EMAIL_DOMAIN=zivahgroup.com" \
  "FRONTEND_URL=http://localhost:3000" \
  "NODE_ENV=development" \
  "PLATFORM_API_URL=http://localhost:5100/api" \
  "PLATFORM_TENANT_API_KEY="

write_env frontend/.env.local \
  "NEXTAUTH_URL=http://localhost:3000" \
  "NEXTAUTH_SECRET=local-dev-secret-not-for-production" \
  "NEXT_PUBLIC_API_URL=http://localhost:5050/api" \
  "ALLOWED_EMAIL_DOMAIN=zivahgroup.com" \
  "MULTI_TENANT_PATH_MODE=1" \
  "NEXT_PUBLIC_MULTI_TENANT_PATH_MODE=1"

echo "==> Installing dependencies (skips a package if node_modules already exists)..."
for dir in platform/backend platform/frontend backend frontend; do
  if [ -d "$dir/node_modules" ]; then
    echo "    $dir: node_modules present, skipping npm install"
  else
    echo "    $dir: npm install..."
    (cd "$dir" && npm install --no-audit --no-fund >/dev/null)
  fi
done

echo "==> Seeding super admin ($SUPER_ADMIN_EMAIL)..."
(cd platform/backend && npm run seed -- --email "$SUPER_ADMIN_EMAIL" --name "$SUPER_ADMIN_NAME" --password "$SUPER_ADMIN_PASSWORD" >/dev/null)

echo "==> Starting platform/backend on :5100..."
free_port 5100
(cd platform/backend && nohup npm run dev > /tmp/alpha-platform-backend.log 2>&1 &)
wait_for_port 5100 /tmp/alpha-platform-backend.log

echo "==> Creating tenant '$TENANT_NAME' (slug: $TENANT_SLUG) via the super admin API..."
TOKEN=$(curl_json_field 'JSON.parse(require("fs").readFileSync(0,"utf8")).token' \
  -X POST http://localhost:5100/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}")

EXISTING_TENANT_ID=$(curl -s http://localhost:5100/api/tenants -H "Authorization: Bearer $TOKEN" \
  | node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')).data||[]; const t=d.find(x=>x.slug==='$TENANT_SLUG'); t?t.id:''" 2>/dev/null || true)

if [ -n "$EXISTING_TENANT_ID" ]; then
  TENANT_ID="$EXISTING_TENANT_ID"
  echo "    tenant already exists ($TENANT_ID), reusing it."
else
  TENANT_ID=$(curl_json_field 'JSON.parse(require("fs").readFileSync(0,"utf8")).id' \
    -X POST http://localhost:5100/api/tenants -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$TENANT_NAME\",\"slug\":\"$TENANT_SLUG\",\"contact_name\":\"Ops Team\",\"contact_email\":\"ops@${TENANT_SLUG}.example\",\"deployment_mode\":\"shared\"}")
  echo "    created tenant $TENANT_ID"
fi

echo "==> Seeding tenant admin user ($TENANT_ADMIN_EMAIL) and assigning to '$TENANT_SLUG'..."
(cd backend && npm run seed -- --email "$TENANT_ADMIN_EMAIL" --name "$TENANT_ADMIN_NAME" --password "$TENANT_ADMIN_PASSWORD" >/dev/null)
$PSQL -d "$TENANT_DB" -c "UPDATE users SET tenant_id='$TENANT_ID' WHERE email='$(echo "$TENANT_ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]')'" >/dev/null

echo "==> Starting tenant CRM backend on :5050..."
free_port 5050
(cd backend && nohup npm run dev > /tmp/alpha-tenant-backend.log 2>&1 &)
wait_for_port 5050 /tmp/alpha-tenant-backend.log

echo "==> Creating a demo franchise ('$FRANCHISE_NAME') under '$TENANT_SLUG'..."
TENANT_TOKEN=$(curl_json_field 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.token' \
  -X POST http://localhost:5050/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TENANT_ADMIN_EMAIL\",\"password\":\"$TENANT_ADMIN_PASSWORD\",\"tenantSlug\":\"$TENANT_SLUG\"}")

EXISTING_FRANCHISE_ID=$(curl -s "http://localhost:5050/api/franchises?limit=100" -H "Authorization: Bearer $TENANT_TOKEN" \
  | node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')).data||[]; const f=d.find(x=>x.name==='$FRANCHISE_NAME'); f?f.id:''" 2>/dev/null || true)

if [ -n "$EXISTING_FRANCHISE_ID" ]; then
  FRANCHISE_ID="$EXISTING_FRANCHISE_ID"
  echo "    franchise already exists ($FRANCHISE_ID), reusing it."
else
  FRANCHISE_ID=$(curl_json_field 'JSON.parse(require("fs").readFileSync(0,"utf8")).id' \
    -X POST http://localhost:5050/api/franchises -H "Authorization: Bearer $TENANT_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$FRANCHISE_NAME\",\"contact_name\":\"$FRANCHISE_PORTAL_NAME\",\"contact_email\":\"$FRANCHISE_PORTAL_EMAIL\",\"type\":\"investor\",\"revenue_share_percent\":20,\"investment_amount\":500000}")
  echo "    created franchise $FRANCHISE_ID"
fi

echo "==> Seeding franchise portal login ($FRANCHISE_PORTAL_EMAIL)..."
(cd backend && npm run seed -- --email "$FRANCHISE_PORTAL_EMAIL" --name "$FRANCHISE_PORTAL_NAME" --password "$FRANCHISE_PORTAL_PASSWORD" --role franchise --franchiseId "$FRANCHISE_ID" >/dev/null)
$PSQL -d "$TENANT_DB" -c "UPDATE users SET tenant_id='$TENANT_ID' WHERE email='$(echo "$FRANCHISE_PORTAL_EMAIL" | tr '[:upper:]' '[:lower:]')'" >/dev/null

echo "==> Starting frontend apps (:3100, :3000)..."
free_port 3100
free_port 3000
(cd platform/frontend && nohup npm run dev > /tmp/alpha-platform-frontend.log 2>&1 &)
(cd frontend && nohup npm run dev > /tmp/alpha-tenant-frontend.log 2>&1 &)
wait_for_port 3100 /tmp/alpha-platform-frontend.log
wait_for_port 3000 /tmp/alpha-tenant-frontend.log

echo ""
echo "All set. Logs: /tmp/alpha-*.log"
echo ""
echo "  Super admin:              http://localhost:3100/login"
echo "                             $SUPER_ADMIN_EMAIL / $SUPER_ADMIN_PASSWORD"
echo ""
echo "  $TENANT_NAME tenant CRM:         http://localhost:3000/$TENANT_SLUG/login"
echo "                             $TENANT_ADMIN_EMAIL / $TENANT_ADMIN_PASSWORD"
echo ""
echo "  $TENANT_NAME franchise portal:   http://localhost:3000/$TENANT_SLUG/login"
echo "                             $FRANCHISE_PORTAL_EMAIL / $FRANCHISE_PORTAL_PASSWORD"
echo "                             (same login page — this account lands on /portal instead of /dashboard)"
echo ""
echo "Give the frontends a few seconds to finish starting before opening them."

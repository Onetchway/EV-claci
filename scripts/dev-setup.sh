#!/usr/bin/env bash
# One-shot local dev setup for the whole Alpha platform + a demo tenant
# ("Xpulse") on the shared backend/+frontend/ CRM, path-routed at /xpulse.
#
# Brings up 4 apps:
#   platform/backend   :5100  (super admin API)
#   platform/frontend  :3100  (super admin UI)
#   backend            :5000  (tenant CRM API, shared/path-tenant mode)
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
PGPASSWORD_VAL="${PGPASSWORD:-postgres}"
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

export PGPASSWORD="$PGPASSWORD_VAL"
PSQL="psql -h $PGHOST -p $PGPORT -U $PGUSER -v ON_ERROR_STOP=1"
DB_URL_BASE="postgresql://${PGUSER}:${PGPASSWORD_VAL}@${PGHOST}:${PGPORT}"

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
  "PORT=5000" \
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
  "NEXT_PUBLIC_API_URL=http://localhost:5000/api" \
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
(cd platform/backend && nohup npm run dev > /tmp/alpha-platform-backend.log 2>&1 &)
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:5100/api/auth/login && break; sleep 0.5; done

echo "==> Creating tenant '$TENANT_NAME' (slug: $TENANT_SLUG) via the super admin API..."
TOKEN=$(curl -s -X POST http://localhost:5100/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')

EXISTING_TENANT_ID=$(curl -s http://localhost:5100/api/tenants -H "Authorization: Bearer $TOKEN" \
  | node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')).data||[]; const t=d.find(x=>x.slug==='$TENANT_SLUG'); t?t.id:''")

if [ -n "$EXISTING_TENANT_ID" ]; then
  TENANT_ID="$EXISTING_TENANT_ID"
  echo "    tenant already exists ($TENANT_ID), reusing it."
else
  TENANT_ID=$(curl -s -X POST http://localhost:5100/api/tenants -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$TENANT_NAME\",\"slug\":\"$TENANT_SLUG\",\"contact_name\":\"Ops Team\",\"contact_email\":\"ops@${TENANT_SLUG}.example\",\"deployment_mode\":\"shared\"}" \
    | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')
  echo "    created tenant $TENANT_ID"
fi

echo "==> Seeding tenant admin user ($TENANT_ADMIN_EMAIL) and assigning to '$TENANT_SLUG'..."
(cd backend && npm run seed -- --email "$TENANT_ADMIN_EMAIL" --name "$TENANT_ADMIN_NAME" --password "$TENANT_ADMIN_PASSWORD" >/dev/null)
$PSQL -d "$TENANT_DB" -c "UPDATE users SET tenant_id='$TENANT_ID' WHERE email='$(echo "$TENANT_ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]')'" >/dev/null

echo "==> Starting backend (:5000) and frontend apps (:3100, :3000)..."
(cd backend && nohup npm run dev > /tmp/alpha-tenant-backend.log 2>&1 &)
(cd platform/frontend && nohup npm run dev > /tmp/alpha-platform-frontend.log 2>&1 &)
(cd frontend && nohup npm run dev > /tmp/alpha-tenant-frontend.log 2>&1 &)

echo ""
echo "All set. Logs: /tmp/alpha-*.log"
echo ""
echo "  Super admin:     http://localhost:3100/login"
echo "                    $SUPER_ADMIN_EMAIL / $SUPER_ADMIN_PASSWORD"
echo ""
echo "  $TENANT_NAME tenant CRM:  http://localhost:3000/$TENANT_SLUG/login"
echo "                    $TENANT_ADMIN_EMAIL / $TENANT_ADMIN_PASSWORD"
echo ""
echo "Give the frontends a few seconds to finish starting before opening them."

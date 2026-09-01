# Livanto Platform — multi-client super-admin control plane

Turns the existing Livanto CRM (`backend/` + `frontend/`, the EV charging
franchise CRM — CMS-adjacent pieces excluded per scope) into something you
sell to multiple clients, each with their own isolated copy, while you run
one super-admin console over all of them.

## Roles

- **Super admin (you)** — owns this `platform/` app only. Onboards
  clients, turns CRM features on/off per client, assigns billing terms,
  and reviews auto-generated invoices. Never queries a tenant's own
  employee/customer/session data — structurally can't, see below.
- **Tenant admin** — a client's own admin inside *their* copy of the CRM
  (`backend/` + `frontend/`). Manages their own employees, stations,
  clients, projects, etc. Nothing here changes that app's code; the
  platform only decides which of its features are switched on and how
  they're billed.

## Why the super admin can't see tenant data

`platform/` has its own database (`platform/database/schema.sql`) that
only ever stores: tenant contact info, feature toggles, billing terms,
and invoices. It has no foreign key, no query, no code path into any
tenant's CRM database. The one number that crosses the boundary —
employee count, for per-employee billing — is **pushed** by the tenant's
own backend to `POST /api/usage/report`, authenticated with a key only
that tenant holds (`tenant.api_key`). The platform never pulls; a tenant
can under-report and only shortchange their own invoice, but the
platform has no way to independently browse who those employees are.

## Deployment modes (chosen per tenant at onboarding)

Set via `tenants.deployment_mode`:

| Mode | Meaning |
|---|---|
| `dedicated` | Client's own domain, own hosting — a fully separate deploy of `backend/` + `frontend/`. Total isolation; you don't even operate their infrastructure. |
| `isolated` | Shared hosting (your infra), but a separate Postgres database per tenant. |
| `shared` | Shared hosting + shared database, rows scoped by a `tenant_id` column added to the CRM's tables. Cheapest, weakest isolation. |

`dedicated` and `isolated` need no code changes to `backend/`/`frontend/`
beyond adding the usage-reporting call described above. `shared` mode
additionally requires adding `tenant_id` to every table in
`database/schema.sql` and a middleware that scopes every query to
`req.user.tenant_id`.

**Status: infrastructure done, retrofit in progress.** Every table across
`database/schema.sql`, `database/nakjm_schema.sql` and
`database/nakjm_documents_schema.sql` now has a nullable `tenant_id`
column (`database/migrations/001_add_tenant_id.sql` for existing
deployments; new installs get it straight from the schema files). It's
NULL for every row in `dedicated`/`isolated`/standalone deploys, so
nothing changes for them. `backend/src/middleware/tenantScope.js` has the
two helpers every service uses — `tenantWhere(req, paramIndex)` to scope
a read, `tenantIdForInsert(req)` to stamp a write — and
`users.service.js` + `franchise.service.js` are retrofitted as the
reference implementation (see their diffs for the exact pattern:
add `tenant.clause`/`tenant.params` from `tenantWhere` into the
conditions array, pass `req` through from the controller).

The same mechanical change still needs applying to the rest of
`backend/src/services/*.service.js` (`assets`, `bss`, `chargers`,
`dashboard`, `revenue`, `sessions`, `settlements`, `stations`, and all
11 files under `services/nakjm/`) before a `shared`-mode tenant can
safely share an instance with others — until then, only onboard
`shared`-mode tenants one at a time behind a `dedicated`/`isolated`
deploy, or finish the retrofit first.

Also still open: OAuth self-signup (`backend/src/config/passport.js`)
doesn't resolve which tenant a new Google sign-in belongs to — it's
single-org by design (one `ALLOWED_EMAIL_DOMAIN`), see the comment in
`passport.js`. And `users.service.js` deliberately does NOT let a
tenant's own admin move users between tenants via `PUT /api/users/:id`
(that's a platform-level action, not a CRM one) — but the platform side
of "assign this user to this tenant" isn't built yet either. Until
both exist, a `shared`-mode tenant's users have to be seeded directly
(e.g. a one-off `UPDATE users SET tenant_id = ...` at onboarding), the
same way `nakjm-crm`'s `scripts/create-user.ts` bootstraps its first users.

## What's in this folder

```
platform/
  database/schema.sql   — the control-plane's own tables (see below)
  backend/               — Express API, the super-admin's only interface
  frontend/              — Next.js super-admin console
```

### `database/schema.sql`

- `super_admins` — platform operators (you), separate from any tenant's users.
- `tenants` — one row per client: contact info, deployment mode, status,
  billing plan/overrides, billing day, `api_key` for usage self-reporting.
- `billing_plans` — reusable pricing templates (`per_employee` or
  `fixed_monthly`), each tenant can also override the rate directly.
- `feature_catalog` / `tenant_features` — every togglable CRM module and
  each tenant's on/off state.
- `tenant_usage_snapshots` — monthly employee counts, self-reported only.
- `invoices` / `invoice_line_items` — generated bills.
- `audit_log` — every super-admin action against a tenant.

### `backend/` (Express + PostgreSQL, mirrors `backend/`'s conventions)

- `POST /api/auth/login` — super-admin login (email + password, JWT).
- `GET/POST/PUT/DELETE /api/tenants` — onboard, edit, suspend, delete clients.
- `PATCH /api/tenants/:id/status` — trial → active → suspended → cancelled.
- `POST /api/tenants/:id/rotate-key` — rotate a tenant's usage-reporting API key.
- `GET /api/features/catalog` — every feature the CRM offers.
- `GET/PUT /api/features/tenants/:tenantId[/:featureKey]` — read/toggle a tenant's features.
- `GET/POST/PUT/DELETE /api/billing-plans` — manage pricing templates.
- `POST /api/invoices/tenants/:tenantId/generate` — generate one invoice on demand.
- `PATCH /api/invoices/:id/paid` / `/void` — mark an invoice's status.
- `POST /api/usage/report` — **tenant-authenticated** (via `X-Tenant-Api-Key`), a tenant's own backend pushes its current employee count here.
- `src/jobs/generateInvoices.js` + `src/jobs/scheduler.js` — runs daily; any
  active tenant whose `billing_day` matches today gets last month's invoice
  generated automatically, no super-admin action needed.

Setup:
```bash
cd platform/backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET
psql "$DATABASE_URL" -f ../database/schema.sql
npm install
npm run seed -- --email you@livanto.com --name "Your Name" --password "changeme123"
npm run dev                # http://localhost:5100
```

### `frontend/` (Next.js super-admin console)

Pages: `/login`, `/tenants` (list + onboard), `/tenants/[id]` (feature
toggles, billing terms, invoice history, rotate API key), `/billing`
(pricing plans), `/invoices` (all invoices, mark paid).

```bash
cd platform/frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL
npm install
npm run dev                  # http://localhost:3100
```

## Closing the loop with the tenant CRM

`backend/src/jobs/reportUsage.js` is the tenant-side half of usage
self-reporting: it counts rows in that CRM's own `users` table and pushes
the count to `POST /api/usage/report` on the platform, authenticated with
the `PLATFORM_TENANT_API_KEY` issued when the super admin onboarded that
tenant (set `PLATFORM_API_URL` + `PLATFORM_TENANT_API_KEY` in `backend/.env`,
then cron `npm run report-usage` — e.g. daily). It's a no-op if those env
vars aren't set, so a standalone (non-platform) deploy of `backend/` is
unaffected. This is intentionally the *only* thing that CRM instance sends
to the platform.

Invoice generation (manual or the daily cron) also emails the tenant
contact via SMTP (`platform/backend/.env`'s `SMTP_*` vars, same
provider-agnostic pattern as `nakjm-crm`'s email notifications) — logs
and no-ops if SMTP isn't configured.

## Not built yet (next steps)

- `shared`-mode multi-tenancy inside `backend/`/`frontend/` itself
  (tenant_id column + scoping middleware) — only the platform side is done.
- Automated tenant provisioning for `dedicated`/`isolated` mode (spinning
  up a new database/deploy on tenant creation) — today `deployment_mode`
  is just recorded; the actual infra step is manual.
- Payment gateway integration — invoices are generated and tracked, but
  collecting payment (Razorpay/Stripe etc.) isn't wired up; `markPaid` is
  currently a manual super-admin action.

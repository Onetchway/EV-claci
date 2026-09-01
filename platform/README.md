# Alpha Platform — multi-client super-admin control plane

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

**Status: done.** Every table across `database/schema.sql`,
`database/nakjm_schema.sql` and `database/nakjm_documents_schema.sql` has
a nullable `tenant_id` column (`database/migrations/001_add_tenant_id.sql`
for existing deployments; new installs get it straight from the schema
files). It's NULL for every row in `dedicated`/`isolated`/standalone
deploys, so nothing changes for them. `backend/src/middleware/tenantScope.js`
has the two helpers every service uses — `tenantWhere(req, paramIndex)`
to scope a read, `tenantIdForInsert(req)` to stamp a write — and every
service in `backend/src/services/` (the EV CRM's `assets`, `bss`,
`chargers`, `dashboard`, `franchise`, `revenue`, `sessions`,
`settlements`, `stations`, `users`, and all 12 files under
`services/nakjm/`) now applies it: list/getOne scoped, create stamps
`tenant_id`, update/remove AND-append the tenant condition, and every
controller passes `req` through. Every cross-table dashboard aggregation
(`dashboard.service.js`, `nakjm/dashboard.service.js`, and
`franchise.service.js`'s own `franchiseDashboard()` — a second, separately
routed dashboard for the same franchise data) got the same treatment
rather than being left as a gap — an admin overview silently blending
another tenant's numbers would be a real leak, not just a missing nicety.

A `shared`-mode tenant can now safely share an instance with others.

## Domain routing (subdomain + custom domain, both super-admin managed)

A `shared`-mode instance now resolves which tenant an inbound request
belongs to from the Host it arrives on, two ways, both set from a
tenant's page in the super-admin console:

- **Subdomain** — every tenant's `slug` doubles as its subdomain, e.g.
  slug `acme` resolves at `acme.${PLATFORM_BASE_DOMAIN}`. Edit it under
  "Domain routing" on the tenant's page (this is the same slug used
  elsewhere, so renaming it changes the tenant's URL).
- **Custom domain** — a tenant can point their own domain
  (`crm.clientcompany.com`) at the instance instead of/as well as the
  subdomain; also set from the tenant's page. Unique across tenants.

How it works end to end:

1. `GET /api/tenants/resolve?host=...` on `platform/backend` — public,
   unauthenticated (it only returns `{id, name, slug, status,
   deployment_mode}`, never tenant data) — looks up a tenant by exact
   `custom_domain` match, then by `slug` against `PLATFORM_BASE_DOMAIN`.
2. `backend/src/utils/resolveTenant.js` — the tenant CRM's side, calls
   that endpoint (in-memory cached ~5 min) for the request's `req.hostname`.
   No-ops (returns `null`) if `PLATFORM_API_URL` isn't set, and fails open
   (never blocks login) if the platform is unreachable.
3. `backend/src/config/passport.js` — at Google sign-in, resolves the
   tenant from the request host. If one resolves, it replaces the
   single-org `ALLOWED_EMAIL_DOMAIN` gate entirely and a new user is
   created with that tenant's `tenant_id`. If none resolves (standalone,
   `dedicated`, `isolated`, or an unrecognized host), behavior is
   byte-for-byte what it was before this feature: the `ALLOWED_DOMAIN`
   gate applies, `tenant_id` stays `NULL`.

DNS/infra this doesn't do for you: pointing `*.${PLATFORM_BASE_DOMAIN}`
and each tenant's custom domain at your shared instance, and TLS for
both, are still your infra's job (e.g. a wildcard cert + reverse proxy).
`app.set('trust proxy', true)` is on in `backend/src/app.js` so
`req.hostname` reflects the real Host through a proxy.

Still open: `users.service.js` deliberately does NOT let a tenant's own
admin move an *existing* user between tenants via `PUT /api/users/:id`
(that's a platform-level action, not a CRM one) — domain routing only
covers *new* signups. There's no platform-side "reassign this user"
action yet, so moving an existing user needs a one-off `UPDATE users SET
tenant_id = ...`. Also: email is globally unique across all tenants
(`users.email UNIQUE`), so the same email can't have separate accounts
under two different tenants in `shared` mode — a real limitation, not
just an unbuilt feature; loosening it to `UNIQUE(tenant_id, email)` needs
its own follow-up since `tenant_id` is nullable for non-shared rows.

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
- `POST /api/provisioning/tenants/:tenantId/isolated-database` — creates and schema-loads a new Postgres database for an `isolated`-mode tenant (see "Tenant database provisioning" below).
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

## Tenant database provisioning ("isolated" mode)

`POST /api/provisioning/tenants/:tenantId/isolated-database` — super admin
only, and only for `isolated`-mode tenants — automates the database half
of onboarding: it `CREATE DATABASE`s a new tenant database (named
`tenant_<slug>`) on whatever Postgres server `PROVISIONING_ADMIN_DATABASE_URL`
points at, then loads the full CRM schema into it (`database/schema.sql`
+ `nakjm_schema.sql` + `nakjm_documents_schema.sql`, the same three files
a manual setup would run). The connection string — WITH credentials — is
returned once in the response and never persisted; the platform only
keeps a credential-free reference (`tenants.db_connection_ref`, host/port/
dbname, no username or password) so you can see at a glance whether a
tenant's been provisioned. Triggered from the tenant's page in the
super-admin console ("Database" card, isolated-mode tenants only).

This is the automatable half of provisioning. It does NOT deploy
`backend/`/`frontend/` anywhere or point DNS at anything — you still run
that CRM instance against the connection string yourself (or your
deploy tooling does). `dedicated`-mode tenants aren't covered by this at
all — that's a separate hosting stack entirely, per whatever provider
that tenant uses, which isn't something this platform can automate
without knowing which provider and holding its credentials.

## Not built yet (next steps)

- Automated `backend/`/`frontend/` *deployment* itself (only the database
  half of `isolated`-mode provisioning is automated, see above) — and
  anything for `dedicated` mode, which depends on a hosting provider
  decision this platform can't make for you.
- Real payment collection (Razorpay/Stripe etc.) is explicitly out of
  scope by design — invoices are generated, tracked, and emailed;
  `markPaid` is a deliberate manual super-admin action, not a gap.

# NaKJM Infra — EPC Field Survey & Reporting App

A field survey / EPC execution reporting system for NaKJM's EV charging station (EVCS)
installation projects. Engineers pick a client → project → work stage on an Android app, fill
in that stage's report form, capture required **geotagged photos**, and submit — the backend
generates a **PDF report in the client's format** automatically. Admins get a web dashboard
showing every client, project, stage-by-stage progress, and payment-milestone tracking.

The first client seeded is **V-Green India**, whose 12-stage execution process (Site Survey →
DISCOM → Layout/Electrical Drawing Approval → Civil → Earthing → Wiring → ACDB → Charger
Install → Testing → Commissioning → HOTO) and every report field/checklist/photo requirement is
derived from their Setup Playbook — see [`docs/vgreen-stage-forms.md`](docs/vgreen-stage-forms.md).

This is a standalone product, decoupled from the rest of this repo (the CSMS / charging-network
operations app in `backend/` and `frontend/` at the repo root is unrelated).

## Architecture

```
epc-field-app/
  backend/     Express + Prisma + PostgreSQL API — data model, geotag photo stamping, PDF generation
  admin-web/   Next.js admin dashboard — clients, projects, stage review/approval, PDF downloads
  mobile/      Expo React Native app (Android) — engineer's field data-collection app
  docs/        V-Green Playbook → stage/field mapping (drives the Prisma seed)
```

Everything is **data-driven per client**: a client's stages and each stage's form fields/photo
requirements live in the database (`StageTemplate` / `FormFieldDef` / `PhotoSlot`), not hardcoded
in the app. Onboarding a second client means seeding new stage templates, not shipping a new app
version. The same field definitions drive the mobile form UI, the admin data viewer, and the PDF
report layout, so all three always stay in sync.

Geotagged photos are captured on-device (camera + GPS) and stamped server-side (via `sharp`) with
address (reverse-geocoded), lat/long, and timestamp — matching the "GPS Map Camera" style photos
EPC clients expect. Stage progression is gated in Playbook order (e.g. civil/electrical work
can't start before layout/drawing approval) and payment milestones are computed automatically
from stage-approval status.

## Running it locally

### 1. Backend

```bash
cd backend
cp .env.example .env        # edit DATABASE_URL / PUPPETEER_EXECUTABLE_PATH if needed
docker compose up -d        # starts Postgres — or point DATABASE_URL at any Postgres 16 instance
npm install
npx prisma migrate dev
node prisma/seed.js         # seeds V-Green client, 12 stage templates, demo users, 1 sample project
npm run dev                 # http://localhost:4100
```

Seeded demo logins (printed by the seed script):
- **Admin**: `admin@nakjm.example` / `ChangeMe123!`
- **Engineer**: `engineer@nakjm.example` / `ChangeMe123!` (assigned to the sample project)

PDF generation uses Puppeteer against a Chromium binary — set `PUPPETEER_EXECUTABLE_PATH` in
`.env` to point at one if you don't have `/opt/pw-browsers/chromium` (the path this was built
against).

### 2. Admin web

```bash
cd admin-web
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_BASE_URL if backend isn't on localhost:4100
npm install
npm run dev                        # http://localhost:3100
```

### 3. Mobile (Android)

```bash
cd mobile
cp .env.example .env               # set EXPO_PUBLIC_API_BASE_URL to your machine's LAN IP:4100/api
                                    # ("localhost" won't resolve to your dev machine from a device/emulator)
npm install
npx expo start                     # scan the QR code with Expo Go, or press "a" for an Android emulator
```

## Deploying

Production hosting is [`dashboard.nakjminfra.com`](https://dashboard.nakjminfra.com) (admin) +
`api.nakjminfra.com` (backend), via a Render Blueprint at [`../render.yaml`](../render.yaml) that
auto-deploys on every push once connected. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full
one-time setup (Render, custom domains, and the mobile app's EAS build/OTA-update setup).

## Known limitations / not yet built

- **Document (`file`-type) fields** — e.g. "Electricity Bill", "Layout Drawing" — are currently
  recorded as a confirm/attached toggle in the app, not an actual file upload. Real geotagged
  *photos* (the bulk of the Playbook's evidence requirements) are fully implemented; generic
  document attachment would need a small addition to the submission API + a document-picker
  screen on mobile.
- **Offline queueing** is not implemented yet — the mobile app requires connectivity to save
  drafts, upload photos, and submit. Field sites with poor signal would need a local queue
  (e.g. `expo-sqlite`) that syncs when back online; this was scoped as a follow-up phase.
- **Publishing to the Play Store** requires your own Google Play Console account and signing
  keys — this build gets you to an `npx expo start` / EAS-buildable app; producing and
  distributing a signed release APK/AAB is a step only you can complete.
- A second client can be onboarded by seeding new `Client` / `StageTemplate` / `FormFieldDef` /
  `PhotoSlot` rows (following the pattern in `backend/prisma/seed.js`) — there's no admin UI for
  authoring stage templates yet, only for using them.

# Livanto Green CRM — EV Charging Franchise

A lead-to-handover CRM for EV charging franchise sales, built from scratch on
Next.js 14 (App Router) + TypeScript + Tailwind, with Firebase Auth, Firestore
and Cloud Storage as the backend.

Every rupee figure in the app — charger prices, GST, the three-stage payment
schedule, EMIs, payback and ROI — is derived from
`Livanto_Franchise_Investment_Model_New.xlsx`, and `npm run verify` asserts the
engine still agrees with the workbook.

---

## What it does

**Roles.** Three tiers, enforced in the UI, in the API routes, and in the
Firestore security rules.

| | Agent | Admin | Super Admin |
|---|---|---|---|
| See own leads | ✅ | ✅ | ✅ |
| See every lead | — | ✅ | ✅ |
| Create / edit leads | own only | ✅ | ✅ |
| Reassign a lead | — | ✅ | ✅ |
| Verify payments & documents | — | ✅ | ✅ |
| Apply a discount | — | ✅ | ✅ |
| Reopen a rejected lead | — | ✅ | ✅ |
| Agent performance, audit log | — | ✅ | ✅ |
| Create agents | — | ✅ | ✅ |
| Create/demote admins, reset passwords, delete | — | — | ✅ |

**Two kinds of lead.**
- *Franchise investor* — someone buying a charging franchise.
- *Site / location partner* — someone offering land or a forecourt (the "wants
  to share his location" flow), captured with the Google Maps link, location
  type, ownership, power load and remarks.

**Sources.** LinkedIn, Instagram, Meta Ads, Newspaper, Direct Call, Referral,
Channel Partner, Website, Walk-in, Exhibition, WhatsApp, Other.

**Pipeline.** New → Contacted → Introduction → EOI → Agreement → Commissioning
→ Handover. Rejected and On Hold are separate statuses, so a rejected lead
keeps its stage for reporting instead of disappearing.

**Drag-and-drop charger configurator.** Drag 60 / 90 / 120 / 180 / 240 / 360 kW
units into a basket — for example 2 × 60 kW + 2 × 120 kW — and the total cost,
18% GST, three-stage payment schedule, projected income, payback and bank EMIs
recompute live. Everything is also reachable by tap and keyboard, because
agents work from phones in the field.

**Payments.** A ledger per lead, reconciled against the quotation's EOI /
Infrastructure / Commissioning milestones. GST is always derived from the base
amount, never typed in. Admins verify; agents record.

**Documents.** Aadhaar, PAN, GST certificate, cancelled cheque, photo,
electricity bill, load sanction letter, property proof, lease agreement, site
photos, franchise agreement, receipts. Uploads go to Cloud Storage with a KYC
checklist that gates the Agreement stage.

**Stage gates.** You cannot record an EOI without a configuration, reach
Agreement without KYC on file, start Commissioning below 50% collection, or
hand over below 100%. The pipeline board enforces the same gates as the detail
page.

**Audit log.** Every write is attributed and diffed at field level — *"Stage:
EOI → Agreement"*, *"Total value: ₹18,29,000 → ₹30,09,000"* — with who, when,
and from which lead. The log is append-only by security rule; nothing in the
app can edit or delete an entry.

**Reporting.** Dashboard (pipeline by stage, source conversion, charger demand,
lead flow, overdue follow-ups), agent leaderboard with conversion rate and
average cycle time, and CSV export on leads, agents and the audit log.

---

## Setup

> Deploying to a real Firebase project? Follow **[DEPLOYMENT.md](./DEPLOYMENT.md)**
> instead — it covers the same ground plus App Hosting, billing, domains and a
> post-deploy checklist. The steps below are the short version for local
> development.

### 1. Create the Firebase project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode; pick a
   region close to your users, e.g. `asia-south1`).
4. **Build → Storage → Get started.**
5. **Project settings → General → Your apps → Web** — register an app and copy
   the config values.
6. **Project settings → Service accounts → Generate new private key** — this
   downloads a JSON file. Keep it out of Git.

### 2. Configure the app

```bash
cd crm
cp .env.example .env.local
```

Fill in the six `NEXT_PUBLIC_FIREBASE_*` values from step 5, and paste the whole
service-account JSON into `FIREBASE_SERVICE_ACCOUNT_KEY` (single line, or its
base64 form). Set `SEED_SUPER_ADMIN_EMAIL` to the address you want as the first
super admin.

### 3. Deploy the security rules and indexes

The rules are the real access control — the UI checks are only there so users
aren't shown buttons that would fail.

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # select your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Index builds take a few minutes. Until they finish, the audit log and some
filtered lead queries will report a missing-index error.

### 4. Seed and run

```bash
npm install
npm run seed        # creates the super admin + lead-code counter
npm run dev         # http://localhost:3100
```

`npm run seed` prints a temporary password if it created the account. Set
`SEED_DEMO_DATA=1` in `.env.local` first if you want five sample leads
(including the Shoyeb Khan site enquiry) to explore with.

Sign in, then go to **Team & Roles** to create your admins and agents. Each new
user gets a generated password shown once — hand it over securely.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3100 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run verify` | Asserts the pricing engine matches the Excel model |
| `npm run seed` | Bootstrap super admin, counter, optional demo data |

---

## How it is put together

```
crm/
├── firebase/
│   ├── firestore.rules        Role-based access control — the real enforcement
│   ├── storage.rules          Upload size/type limits, delete permissions
│   └── firestore.indexes.json Composite indexes for the lead & audit queries
├── scripts/
│   ├── seed.ts                Bootstrap
│   └── verify-pricing.ts      Guards the engine against the workbook
└── src/
    ├── lib/
    │   ├── catalog.ts         Six charger SKUs, transcribed from the Excel
    │   ├── pricing.ts         Quotation engine: GST, milestones, EMI, payback
    │   ├── constants.ts       Stages, sources, doc kinds, location types…
    │   ├── permissions.ts     One place every capability check is decided
    │   ├── diff.ts            Field-level change detection for the audit log
    │   ├── analytics.ts       Pure roll-ups: funnel, agent stats, demand
    │   └── db/                Firestore data layer (leads, payments, docs, log)
    ├── components/
    │   ├── charger-configurator.tsx   The drag-and-drop basket
    │   ├── lead-form.tsx              Create/edit, with duplicate detection
    │   └── lead/                      Stage stepper, payments, documents, activity
    └── app/(app)/             Dashboard, pipeline, leads, sites, catalogue,
                               agents, users, audit log
```

### Data model

```
users/{uid}                    role, active, region, manager, last sign-in
counters/leads                 sequence behind LG-FR-000142 / LG-ST-000143
leads/{id}                     client, source, stage, status, config, quote
  ├── payments/{id}            milestone ledger, base + GST + total
  └── documents/{id}           storage pointer, KYC kind, verification state
activities/{id}                append-only audit trail (ownerId-scoped)
```

Two deliberate choices:

- **Activities are top-level, not nested.** The per-lead timeline and the
  org-wide audit log become the same query with a different `where`, so nothing
  is written twice and the two can never disagree.
- **The quote is snapshotted onto the lead.** Lists and reports read
  `lead.value` directly instead of recomputing a basket for every row, and the
  engine recomputes it on every configuration change.

### A note on filtering

Firestore has no `LIKE` and a limited composite-index budget. The cheap,
highly-selective predicates (owner, type, status) run server-side; stage,
source, city, date range and free text are applied in memory over the returned
page, and names/phones/codes are additionally indexed as prefix tokens on
write. This is right for a sales pipeline of a few thousand live leads. Past
roughly 10,000, move search to Algolia or Typesense — see below.

---

## Suggested improvements

Things this build deliberately leaves out, roughly in the order I would do them.

**Worth doing soon**

1. **WhatsApp Business API integration.** In Indian field sales this is where
   the conversation actually happens. Two-way sync into the activity timeline
   would remove most manual note-taking, which is the main reason CRM timelines
   go stale.
2. **Automated follow-up reminders.** The data is already there
   (`nextFollowUpAt`); it needs a scheduled Cloud Function to push a daily
   digest over email/WhatsApp and escalate to the admin when a lead sits
   untouched past an SLA.
3. **Quotation PDF generation.** Agents currently read the numbers off the
   screen. A branded PDF of the quotation, payment schedule and returns —
   generated server-side and attached to the lead — would go straight into the
   sales conversation.
4. **Lead capture webhooks.** Meta Lead Ads, the website contact form and
   IndiaMART can all POST directly into a `/api/leads/inbound` route with
   round-robin assignment, instead of an agent retyping them.
5. **Server-side aggregation for reporting.** The dashboard currently pulls up
   to 500 leads to the client. Firestore aggregation queries or a nightly
   rollup document keeps it constant-cost as the book grows.

**Worth doing as you scale**

6. **Dedicated search** (Algolia / Typesense) once free-text filtering over the
   in-memory page stops being enough.
7. **Territory and team hierarchy.** `managerId` is stored but not yet used —
   an admin who should see only their own region currently sees everything.
8. **Duplicate merge.** The form warns about a repeat phone number; it cannot
   yet merge two records.
9. **Site feasibility scoring.** Power load, space and location type are
   captured — scoring them into a simple traffic light would let the team
   triage site enquiries without a survey visit.
10. **Post-handover lifecycle.** Once a station is live, the interesting data
    becomes uptime, monthly units dispensed and settlement against the assured
    minimum. That is a different module, and it is where the existing
    `backend/` service in this repo already points.

**Operational**

11. **Backups.** Turn on scheduled Firestore exports to GCS — this is a
    single `gcloud` command and it is the cheapest insurance you will buy.
12. **Rules unit tests.** `@firebase/rules-unit-testing` against the emulator,
    asserting that an agent genuinely cannot read another agent's lead. Right
    now that is verified by reading the rules, not by a test.
13. **PII handling.** Aadhaar and PAN are stored in plain fields. Consider
    masking them in the UI for non-admins and setting a Storage retention
    policy, particularly with India's DPDP Act in view.
14. **App Check.** Blocks scripted abuse of the Firebase endpoints from outside
    your app.

---

## Security notes

- The `NEXT_PUBLIC_FIREBASE_*` values are public by design. Access is
  controlled by the Firestore and Storage rules, not by hiding them.
- The service-account key is **not** public. It is used only by
  `/api/users`, which is the sole path that can create accounts or change a
  role. Changing a role also revokes the user's refresh tokens, so a demotion
  takes effect on their next request rather than whenever their token expires.
- Role checks live in `src/lib/permissions.ts` for the UI and are mirrored in
  `firebase/firestore.rules` for enforcement. If you change one, change both.
- Storage rules cannot read Firestore, so per-lead file ownership cannot be
  enforced there; access is gated on being a signed-in CRM user, and download
  URLs are only ever surfaced through the owner-scoped `documents`
  sub-collection. If you need stricter isolation, proxy downloads through a
  server route that checks lead ownership first.

# Livanto OCPP 2.0.1 Central System — Phase 1

Standalone WebSocket server implementing the OCPP 2.0.1 charge-point
lifecycle: `BootNotification`, `Heartbeat`, `StatusNotification`,
`Authorize`, `TransactionEvent`, `MeterValues`. Mirrors live charger status
and session/transaction logs into the same Firestore project the CRM uses,
so `/chargers` in the CRM can read them directly — no API layer between the
two.

**Not in Phase 1, on purpose:** this server never sends a Call to a charge
point (no remote start/stop/reset). Controlling physical hardware gets its
own tested pass once this connect/see/log foundation is proven against your
real chargers — see Phase 2 in the roadmap.

## Why a separate service

OCPP needs a long-lived WebSocket connection per charger, held open for as
long as the charger is powered on. That doesn't fit the CRM's Next.js app
(request/response, deployed via Firebase App Hosting) — this runs as its
own Cloud Run service instead, sharing only the Firestore project.

## Known gap: your chargers may not actually speak 2.0.1

Public spec sheets for Exicom, Everta and Mindra only ever mention OCPP
**1.6J** — see the research earlier in this build. This server was built
for 2.0.1 message shapes as explicitly instructed. If a real charger
connects offering only the `ocpp1.6` subprotocol, the server still accepts
the connection (so you'll see it in the logs and in `chargePoints` as
online) but its `BootNotification`/`StatusNotification`/etc. payloads use
different field names in 1.6 than 2.0.1, so parsing will likely fail —
watch the Cloud Run logs after connecting a real unit for the first time.
If that happens, the fix is a 1.6-shaped parallel set of handlers, not a
rewrite of this server.

## Known gap: no authentication on the WebSocket endpoint yet

OCPP's real security profiles (HTTP Basic Auth per charge point, or mutual
TLS) aren't implemented in Phase 1 — anyone who knows a charge point ID can
currently open a connection and post fake data. Fine for an initial test
against real hardware; before this handles your whole live fleet, add
Basic Auth (Security Profile 1) as a small follow-up.

## Local development

```bash
npm install
export FIREBASE_PROJECT_ID=livanto-278b5   # or FIREBASE_SERVICE_ACCOUNT_KEY
gcloud auth application-default login       # if not using a service-account key
npm run dev
```

Health check: `curl http://localhost:8080/healthz`
Charge points connect to: `ws://localhost:8080/ocpp/<chargePointId>`

## Deploy to Cloud Run

Run from Cloud Shell, same account you've used for the CRM's Firestore
rules deploys.

```bash
cd ~/EV-claci/ocpp-server            # after cloning/pulling the repo there
gcloud config set project livanto-278b5

# One-time: let Cloud Run's own service identity write to Firestore,
# the same "no key file to manage" pattern the CRM's App Hosting uses.
PROJECT_NUMBER=$(gcloud projects describe livanto-278b5 --format='value(projectNumber)')
gcloud projects add-iam-policy-binding livanto-278b5 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud run deploy livanto-ocpp \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 3 \
  --timeout 3600 \
  --concurrency 250 \
  --set-env-vars FIREBASE_PROJECT_ID=livanto-278b5
```

`--min-instances 1` matters more here than for a typical web app: scaling
to zero would drop every connected charger. `--timeout 3600` is Cloud
Run's max — a WebSocket connection open longer than that gets force-closed
and the charger will need to reconnect (it will, automatically, on its own
retry logic — OCPP charge points are built to expect this).

The command prints a `*.run.app` URL when done — that's the host your
chargers need to be configured to connect to, at
`wss://<that-host>/ocpp/<chargePointId>`. Configuring that URL into your
Exicom/Everta/Mindra chargers' own management settings is a step outside
this repo — check each vendor's config portal or ask their support for how
to set a custom Central System URL.

## What lands in Firestore

- `chargePoints/{chargePointId}` — status (`ONLINE`/`OFFLINE`), vendor/model
  info from BootNotification, per-connector status, last-seen timestamp.
- `chargeSessions/{chargePointId}__{transactionId}` — one doc per
  transaction, status (`ACTIVE`/`ENDED`), start/end time, energy delivered
  (Wh), stop reason.

Both collections are written only by this server's Admin SDK connection —
Firestore rules (in the CRM repo) allow the CRM's frontend to read them but
never write, so there's one source of truth for what a charger is actually
doing.

# Livanto OCPP 2.0.1 Central System — Phase 1 + Phase 2

Standalone WebSocket server implementing the OCPP 2.0.1 charge-point
lifecycle: `BootNotification`, `Heartbeat`, `StatusNotification`,
`Authorize`, `TransactionEvent`, `MeterValues`. Mirrors live charger status
and session/transaction logs into the same Firestore project the CRM uses,
so `/chargers` in the CRM can read them directly — no API layer between the
two. (Phase 1.)

Phase 2 adds the reverse direction — this server sending a charge point a
Call — plus RFID allow-listing and automatic fault/offline ticketing:

- **Remote commands**: `POST /command/<chargerId>` with a JSON body
  `{ "action": "...", "payload": {...} }`, one of `RequestStartTransaction`,
  `RequestStopTransaction`, `Reset`, `UnlockConnector`, `ChangeAvailability`.
  Requires an `x-command-key` header matching `COMMAND_API_KEY` — the CRM
  calls this from a server-side Next.js API route (never directly from the
  browser) so that key never reaches a client.
- **RFID allow-listing**: `Authorize` checks Firestore's `rfidTokens`
  collection. Fails open (accepts every tag) while that collection is
  empty, so a fresh deployment doesn't lock out every driver on day one —
  the moment an admin adds the first token in the CRM, enforcement switches
  on automatically.
- **Fault/offline tickets**: a `StatusNotification` reporting `Faulted`
  opens a ticket immediately; a periodic sweep (`OFFLINE_SWEEP_MS`, default
  6 minutes) catches chargers that go silent without a clean WebSocket
  close and marks them `OFFLINE` + opens a ticket. Both write to
  Firestore's `tickets` collection, which the CRM's Tickets page manages
  from there (assignment, status, SLA).

**Known limitation — command routing across multiple instances:** a Call
can only be sent from the Cloud Run instance actually holding that
charger's WebSocket connection. With `--max-instances 1` this is a
non-issue; with more than one instance, a command can land on an instance
that isn't holding the target connection and will correctly report
"not connected here" even though the charger is online elsewhere. Fine at
small fleet size — a real fix needs a cross-instance dispatch layer (e.g.
Redis pub/sub) before this handles a large fleet on `--max-instances 3`.

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

## Charge point allowlisting

A connection is only accepted if its charge point ID has an active
registration in Firestore's `chargerRegistry` collection — written by the
CRM's dashboard (Chargers & Stations → Add charger), which also generates
the exact `wss://` URL and a QR code for that ID. Unregistered or
deactivated IDs get their WebSocket closed immediately (code 1008).

This is ID-based allowlisting, not per-message authentication — it stops
someone from guessing a charge point ID and posting fake telemetry, but it
is not equivalent to OCPP's real security profiles (HTTP Basic Auth per
charge point, or mutual TLS), which still aren't implemented. Add Basic
Auth (Security Profile 1) as a follow-up before this handles a large live
fleet on a network you don't fully trust.

## Local development

```bash
npm install
export FIREBASE_PROJECT_ID=livanto-278b5   # or FIREBASE_SERVICE_ACCOUNT_KEY
gcloud auth application-default login       # if not using a service-account key
npm run dev
```

Health check: `curl http://localhost:8080/status`

Note: the health-check path is `/status`, not the more conventional
`/healthz` — Cloud Run's front end appears to special-case `/healthz`
internally and never forwards it to the container (confirmed by comparing
it against an arbitrary unmatched path, which correctly reached the
container's own 404 handler). `/status` avoids the collision.
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
  --set-env-vars FIREBASE_PROJECT_ID=livanto-278b5,COMMAND_API_KEY=<generate-a-long-random-string>
```

Generate `COMMAND_API_KEY` once (e.g. `openssl rand -hex 32`) and set the
*same* value as `OCPP_COMMAND_KEY` in the CRM's own environment (Firebase
App Hosting → your backend → Environment variables) — the CRM's
`/api/ocpp/command` route needs it to call this server. Treat it as a
secret: it's what stops anyone who finds this server's public URL from
sending remote-start/reset commands to your live chargers.

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

Always confirm the live URL with `gcloud run services describe livanto-ocpp
--region asia-southeast1 --format='value(status.url)'` rather than
reconstructing it from the project number — Cloud Run's URL format has
changed over time (e.g. `<service>-<hash>-<region-short>.a.run.app` is the
current format), and an old-style guessed URL can 404 even though the
service itself is healthy.

## What lands in Firestore

- `chargePoints/{chargePointId}` — status (`ONLINE`/`OFFLINE`), vendor/model
  info from BootNotification, per-connector status, last-seen timestamp.
- `chargeSessions/{chargePointId}__{transactionId}` — one doc per
  transaction, status (`ACTIVE`/`ENDED`), start/end time, energy delivered
  (Wh), stop reason.
- `tickets/{ticketId}` — opened by this server on a fault or offline sweep;
  from there owned by the CRM's Tickets page (assignment, status, SLA).
- `rfidTokens/{tokenId}` — read-only from this server's side; managed
  entirely by the CRM.

`chargePoints`/`chargeSessions`/tickets it opens are written only by this
server's Admin SDK connection — Firestore rules (in the CRM repo) allow the
CRM's frontend to read them but never write those specific fields, so
there's one source of truth for what a charger is actually doing.

# Deploying NaKJM Infra (dashboard.nakjminfra.com + mobile app)

This describes the one-time setup to get the backend API and admin dashboard live at
`api.nakjminfra.com` / `dashboard.nakjminfra.com`, and the Android app buildable/updatable —
in a way where, **after this initial setup, every change pushed to this repo's branch deploys
itself**. You won't need to open Render, or run any commands, for ordinary code changes.

Two things stay genuinely one-time, unavoidable manual steps, called out below: creating
accounts (Render, Expo, Google Play), and adding DNS records at your registrar. Everything
else — every deploy after that — is automatic.

---

## Part 1 — Backend + Admin Dashboard (Render, free tier)

### Cost & architecture

With ~3-4 users, a couple of times a week, this runs **entirely on free tiers**: Render's free
web service plan for both the backend and admin dashboard, a free [Neon.tech](https://neon.tech)
Postgres project, and a free [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket for
photo/PDF storage. **Trade-off**: free Render services spin down after 15 minutes idle and take
~30-50s to wake up on the next request — fine for occasional use, not for a tool that needs to
respond instantly at all times.

**Why not Render's own Postgres/disk?** Render's free Postgres auto-deletes after 30 days —
unacceptable for real project data. Free Render web services also don't support a persistent
disk at all, which is why photo/PDF storage moved to Cloudflare R2 (an S3-compatible bucket)
instead of local disk — the backend now supports either via a `STORAGE_DRIVER` env var
(`local` for disk, `s3` for R2), so this isn't a one-way door.

**Upgrade path, later, when it's worth it**: in `render.yaml`, change `plan: free` to
`plan: starter` on either service (backend first — that removes its cold start and gives
Puppeteer more reliable memory for PDF generation) — that's a one-line edit + push, nothing else
changes. Postgres can stay on Neon's free tier much longer than the app services can stay free,
since Neon's free tier doesn't expire and this app's data volume is small.

### One-time setup

**A. Database — Neon.tech (free, persists indefinitely)**
1. Sign up at [neon.tech](https://neon.tech) (free, no card required).
2. Create a project (any name/region — pick one close to your users, e.g. Singapore).
3. On the project dashboard, copy the **connection string** it shows you (starts with
   `postgresql://...neon.tech/...?sslmode=require`). Keep this handy for step D below.

**B. File storage — Cloudflare R2 (free, 10GB)**
1. Sign up / log into [Cloudflare](https://dash.cloudflare.com) → **Storage & Databases → R2**.
   R2 requires adding a payment method even on the free tier, but the included free monthly
   usage (10GB storage, no egress fees) comfortably covers this app's scale.
2. Create a bucket, e.g. `nakjm-infra-field-app`.
3. Open the bucket → **Settings → Public Development URL → Enable** (type `allow` to confirm).
   Copy the `*.r2.dev` URL it gives you — that's your `S3_PUBLIC_BASE_URL`.
4. R2 Overview page → **Account Details → API Tokens → Manage → Create API Token** → give it
   Object Read & Write permission, scoped to the bucket above. Copy the **Access Key ID** and
   **Secret Access Key** it shows you (the secret is shown once only).
5. Note your **Account ID** (shown on the R2 Overview page) — your endpoint is
   `https://<account-id>.r2.cloudflarestorage.com`.

You should now have: `DATABASE_URL` (Neon), and `S3_ACCOUNT_ID` / `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` / `S3_BUCKET` / `S3_ENDPOINT` / `S3_PUBLIC_BASE_URL` (R2).

**C. Render — hosting**
1. **Create a Render account** at [render.com](https://render.com) (free to sign up).
2. **Connect GitHub**: click your profile → **Account Settings → GitHub** (or you'll be
   prompted the first time you create a Blueprint) → authorize the Render GitHub App → grant it
   access to the `Onetchway/ev-claci` repository.
3. **Create the Blueprint**: **+ New → Blueprint** → select `Onetchway/ev-claci` → branch
   `claude/epc-field-survey-app-we534z` (or `main`, once this is merged — see note at the
   bottom). Render finds `render.yaml` automatically.
4. Render will show a review screen and **prompt you for the values of every `sync: false`
   env var** — this is where you paste in the Neon `DATABASE_URL` and the six R2 values from
   steps A/B above. Confirm the plan shows both services on **Free**, then click **Apply**.
5. **Wait for the first deploy** (~5–10 min — the backend build installs Chromium and the
   admin dashboard runs a Next.js build). Watch progress in each service's **Logs** tab.
6. **Seed the production database** (creates the V-Green client, its 12 stage templates, and
   the demo admin/engineer logins). Render's free plan has no Shell access, so this runs via a
   secret-gated endpoint instead: open `nakjm-infra-field-api` → **Environment** tab → copy the
   auto-generated `SEED_SECRET` value, then run (from anywhere with internet access):
   ```
   curl -X POST https://api.nakjminfra.com/api/admin/seed -H "X-Seed-Secret: <value>"
   ```
   This is safe to re-run; it skips anything already seeded. (I can also run this for you in a
   future session if you paste me the `SEED_SECRET` value.)
7. **Log in and change the seeded demo passwords immediately** (`admin@nakjm.example` /
   `ChangeMe123!` and `engineer@nakjm.example` / `ChangeMe123!`) — create your real admin/engineer
   accounts via the dashboard's **Engineers** page and deactivate or repassword the demo ones.

### Custom domains

8. Open **nakjm-infra-field-api** → **Settings → Custom Domains** → add `api.nakjminfra.com`.
   Render shows you a target hostname (something like `nakjm-infra-field-api.onrender.com`).
9. Open **nakjm-infra-dashboard** → **Settings → Custom Domains** → add
   `dashboard.nakjminfra.com`. Same idea — note the target hostname.
10. **At your domain registrar** (wherever `nakjminfra.com`'s DNS is managed — GoDaddy,
   Namecheap, etc.), open DNS management for `nakjminfra.com` and add two CNAME records:

    | Type  | Host        | Value (Target)                              |
    |-------|-------------|----------------------------------------------|
    | CNAME | `dashboard` | *(hostname Render showed you in step 9)*      |
    | CNAME | `api`       | *(hostname Render showed you in step 8)*      |

    DNS changes usually take a few minutes to a couple of hours to propagate. Render
    auto-issues SSL certificates for both domains once it sees the DNS pointed correctly — no
    action needed from you beyond adding the records.

### What's automatic from here on

Every push to the connected branch rebuilds and redeploys **both** services
(`autoDeployTrigger: commit` in `render.yaml`) — including the Postgres migration (the
backend's container runs `npx prisma migrate deploy` against Neon on every start before the
server boots — Render's free plan doesn't support a separate pre-deploy step, so this is baked
into the Docker image's startup command instead). When you ask for a change here, I push a
commit, and it's live within a few minutes (plus a
cold-start wait on free tier if it's been idle) — you don't need to open Render again unless
you want to change a secret, resize something, or look at logs.

**If PDF generation fails or times out**: that's most likely the free tier's 512MB RAM limit
struggling to run headless Chromium, especially right after waking from idle. It's the main
reason to eventually move the backend to `plan: starter` — see the upgrade note above.

**Branch note:** Render deploys whichever branch you pointed it at in step C.3. Right now all
work happens on `claude/epc-field-survey-app-we534z` per your branch policy. If/when you want
`main` to be "production," merge the PR and switch the branch Render tracks (Service →
Settings → Build & Deploy) — one click, no redeploy-from-scratch needed.

---

## Part 2 — Mobile App (Android)

Mobile is a different distribution model than a website: there's no single URL to redeploy —
there's a Play Store listing (or a direct APK), plus optional **over-the-air (OTA) updates**
for JS/UI-only changes that skip the app store entirely. Here's how to get as close to
"just push and it updates" as mobile allows.

### One-time setup

1. **Create a free Expo account** at [expo.dev](https://expo.dev).
2. **Give me an access token so I can build/update without you opening anything**: in the Expo
   dashboard → your account → **Access Tokens** → **Create Token**. Add it as an
   `EXPO_TOKEN` environment variable in this Claude Code environment's settings (same place
   other env vars for this environment live). Once that's set, I can run `eas` commands
   non-interactively in future sessions — no login prompt, nothing for you to click.
3. Once `EXPO_TOKEN` is available, I'll run (one-time, from `mobile/`):
   ```
   eas init                 # links the project, gets a real EAS project ID
   eas update:configure     # wires up app.json for OTA updates (runtimeVersion, update URL)
   ```
   These fill in project-specific values in `app.json` that can't be guessed ahead of time —
   `eas.json` (build profiles) is already committed and ready.

### Ongoing changes — two tiers

- **JS/UI-only changes** (form logic, styling, new screens, bug fixes — the vast majority of
  requests): once step 3 above is done, I can publish these instantly with `eas update`. Every
  device with the app installed fetches the new JS bundle the next time it opens — **no Play
  Store review, no reinstall, no action from you.**
- **Native changes** (new permission, new native SDK, an Expo SDK upgrade): these need an
  actual new build + store submission — inherent to how Android/Play Store work, not something
  any automation can skip. With `EXPO_TOKEN` set, I can still run `eas build` and, if you also
  give me Play Console API access (below), `eas submit` — so even this becomes "I push, it
  builds and uploads" rather than something you do by hand.

### Play Store publishing (separate, unavoidably manual first step)

Google requires a verified developer identity — this part genuinely has to be you:

1. Create a **Google Play Console** account ($25 one-time) at
   [play.google.com/console](https://play.google.com/console/), and complete identity
   verification.
2. Create the app listing (name: "NaKJM Infra Field App", category, privacy policy URL,
   screenshots, content rating questionnaire) — this first-time store listing setup is a Google
   requirement and can't be automated.
3. **Optional, to let me auto-submit builds**: Play Console → **Setup → API access** → create a
   service account, download its JSON key, and add its contents as another secret
   (`PLAY_STORE_SERVICE_ACCOUNT_JSON`) the same way as `EXPO_TOKEN`. With that, `eas submit` can
   push new builds to your Play Console's internal/production track without you opening it.
4. Until then, or for the very first release either way, I'll hand you the built `.aab` file
   (or a download link from `eas build`) and you upload it once in Play Console — after that
   first listing exists, subsequent updates can go through `eas submit` automatically.

### Local testing without any of the above

Right now, without any Expo/Play Store account, the app already runs via `npx expo start` in
`mobile/` (scan the QR with Expo Go, or run in an Android emulator) — useful for verifying
changes before you decide to invest in the account setup above.

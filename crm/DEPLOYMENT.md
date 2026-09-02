# Deploying the CRM to Firebase — project `livanto`

Step by step, start to finish. Budget about 45 minutes the first time, most of
it waiting for Firestore indexes to build.

> **New to this?** [START-HERE.md](./START-HERE.md) covers the same deployment
> assuming no technical background — every click spelled out, using a browser
> terminal so nothing is installed locally. This page assumes you are
> comfortable with a command line.

---

## Before you start: two things to know

**1. You need the Blaze (pay-as-you-go) plan.** The free Spark plan cannot run
server-side code, and this app has API routes (`/api/users`) and
server-rendered lead pages. There is no way around this. In practice a sales
team of 10–20 people costs roughly **₹0–500/month** — App Hosting scales to
zero when nobody is using it, and Firestore's free tier covers a pipeline of
this size. Set a budget alert in step 2 and you will not get a surprise.

**2. Use App Hosting, not Hosting.** They are different products with confusingly
similar names. Plain *Firebase Hosting* serves static files only — deploying
there would give you a broken app with no login and no API. *Firebase App
Hosting* runs the app on Cloud Run and is what these instructions use.

---

## Step 1 — Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. **Create a project** → name it **`livanto`**.
   - Firebase will show the project ID underneath. If `livanto` is already
     taken globally, it will suggest something like `livanto-a1b2c`.
     **Write down whatever ID it gives you** — you need the exact ID in
     step 5, and it is not always the same as the name.
3. Google Analytics is optional. Skip it unless you want it.

## Step 2 — Upgrade to Blaze and set a budget alert

1. Bottom-left of the console → **Upgrade** → **Blaze**.
2. Attach a billing account (credit card or UPI-linked GPay).
3. Now set the guard rail: **⚙️ → Usage and billing → Details & settings →
   Budgets & alerts** → create a budget of, say, **₹1,000/month** with alerts
   at 50%, 90% and 100%.

Do not skip the budget alert. It costs nothing and it is the difference between
noticing a runaway bill on day two and on day thirty.

## Step 3 — Turn on the three services

**Authentication**
1. **Build → Authentication → Get started**
2. **Sign-in method → Email/Password → Enable → Save**
   (leave "Email link" off)

**Firestore**
1. **Build → Firestore Database → Create database**
2. Choose **Production mode** — the rules in this repo replace the default ones
   in step 6.
3. Location: **`asia-south1` (Mumbai)** for an India-based team. **This cannot
   be changed later**, so pick deliberately.

**Storage**
1. **Build → Storage → Get started**
2. Production mode, same location.
3. Note the bucket name it shows — usually `livanto.firebasestorage.app`
   (newer projects) or `livanto.appspot.com` (older ones). You need the exact
   string in step 5.

## Step 4 — Register the web app and copy the keys

1. **⚙️ Project settings → General**
2. Scroll to **Your apps** → click the **`</>`** (web) icon
3. Nickname: `Livanto CRM`. Leave "Firebase Hosting" **unchecked** — App
   Hosting is set up separately in step 7.
4. **Register app.** You now get a config block:

```js
const firebaseConfig = {
  apiKey: "AIzaSy…",
  authDomain: "livanto.firebaseapp.com",
  projectId: "livanto",
  storageBucket: "livanto.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

Keep this tab open. These six values are used in step 5 and step 7.

> These values are **public by design** — they ship inside every web app's
> JavaScript. Your data is protected by the security rules deployed in step 6,
> not by keeping these secret.

## Step 5 — Configure and test locally

```bash
cd crm
cp .env.example .env.local
```

Open `.env.local` and fill in the six values from step 4:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=livanto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=livanto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=livanto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

The server routes and the seed script also need admin credentials. In
production App Hosting provides these automatically. Locally you have two
options — **prefer the first**:

**Option A — your own Google login (no key to manage):**

```bash
gcloud auth application-default login
```

That is all. The Admin SDK picks these up automatically, and there is no
private key sitting on your disk.

**Option B — a service-account key**, if you have no `gcloud` and do not want
to install it:

1. **⚙️ Project settings → Service accounts → Generate new private key**
2. A JSON file downloads. Copy its **entire contents onto one line** into
   `.env.local`:

```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"livanto",...}
```

> **That file is a real secret** — it grants full admin access to your project.
> `.env.local` is already in `.gitignore`; keep it that way, and delete the
> download once pasted. This is exactly why Option A is preferable.

Now install and check it runs:

```bash
npm install
npm run verify     # confirms pricing still matches the Excel model
npm run dev        # http://localhost:3200
```

You will see the login page. You cannot sign in yet — that is step 8.

## Step 6 — Deploy the security rules and indexes

**This is the most important step.** Until it runs, your database is either
locked shut or wide open, and neither is what you want.

```bash
npm install -g firebase-tools
firebase login
```

From the `crm/` directory:

```bash
firebase use --add
```

Pick `livanto` from the list; give it the alias `default`.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Expected output ends with `✔ Deploy complete!`.

**Indexes take 5–15 minutes to build.** Watch progress at **Firestore →
Indexes**. Until every index shows **Enabled**, the audit log and some filtered
lead views will show a missing-index error. That is expected; it resolves on
its own.

## Step 7 — Deploy the app with App Hosting

App Hosting deploys from GitHub and rebuilds on every push.

### 7a. Push your code to GitHub

The code is already on the branch `claude/ev-charger-crm-build-7ddmrn`. Either
merge it to `main`, or point App Hosting at that branch directly in 7b.

### 7b. Create the backend

1. **Build → App Hosting → Get started**
2. **Connect to GitHub** → authorise Firebase → select the `EV-claci` repo
3. Configure:

| Field | Value |
|---|---|
| **Root directory** | `crm` |
| **Live branch** | `main` (or `claude/ev-charger-crm-build-7ddmrn`) |
| **Automatic rollouts** | Enabled |
| **Backend name** | `livanto-crm` |
| **Region** | `asia-east1` (closest App Hosting region to India) |

The **root directory must be `crm`** — the repo also contains an unrelated
`frontend/` app, and App Hosting will build the wrong thing if you leave it at
the repo root.

4. **Finish and deploy.**

### 7c. Fill in the environment values

The repo ships `crm/apphosting.yaml` with `REPLACE_ME` placeholders. Edit that
file with your real values from step 4 and push:

```yaml
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSy…            # ← your real key
    availability: [BUILD, RUNTIME]
  # …and the same for the other five
```

```bash
git add crm/apphosting.yaml
git commit -m "Set Firebase web config for the livanto project"
git push
```

The push triggers a rebuild. First build takes 5–10 minutes; watch it under
**App Hosting → your backend → Rollouts**.

> These must be `availability: [BUILD, RUNTIME]`, not runtime alone.
> `NEXT_PUBLIC_*` values are compiled into the JavaScript bundle at build time,
> so a runtime-only setting produces a deployed app that cannot reach Firebase.

When it finishes you get a URL like `https://livanto-crm--livanto.asia-east1.hosted.app`.

### 7d. Authorise the domain for sign-in

**Authentication → Settings → Authorized domains → Add domain** → paste your
App Hosting hostname.

Miss this and login fails with `auth/unauthorized-domain`.

## Step 8 — Create the first super admin

Still from `crm/`, using the credentials from step 5:

```bash
npm run seed -- --email you@livantogreen.com --name "Your Name"
```

Output:

```
✓ Super admin ready: you@livantogreen.com

  ┌──────────────────────────────────────────┐
  │  Temporary password: xK9mQ2pL7vNb4T      │
  └──────────────────────────────────────────┘
```

**Copy that password.** It is shown once and never stored.

Add `--demo` to also insert five sample leads, including the Shoyeb Khan site
enquiry. It is safe to run the seed repeatedly — it skips anything that already
exists and only re-applies the super-admin role.

If you are not on your own machine, this runs unchanged in
[Google Cloud Shell](https://shell.cloud.google.com) — clone the repo, `cd
EV-claci/crm`, `npm install`, then the command above with
`--project YOUR-PROJECT-ID`.

## Step 9 — Sign in and set up the team

1. Open your App Hosting URL
2. Sign in with the seeded email and temporary password
3. Go to **Team & Roles → Add user** for each admin and agent

Each new account gets a generated password shown **once** — copy it before
closing the dialog and pass it on securely. Users can change it themselves via
**Forgot password** on the login screen.

---

## Optional: a custom domain

**App Hosting → your backend → Custom domains → Add domain**, e.g.
`crm.livantogreen.com`. Firebase gives you DNS records to add at your registrar;
the certificate is issued automatically and takes up to 24 hours.

Then add that domain to **Authentication → Settings → Authorized domains** too.

---

## Verifying it actually works

Run through this once after deploying:

- [ ] Sign in as the super admin
- [ ] **Charger Catalogue** — the 60 kW row reads ₹15,50,000 + ₹2,79,000 GST = **₹18,29,000**
- [ ] Drag 2 × 60 kW and 2 × 120 kW into the calculator → total **₹96,76,000**
- [ ] Create a test lead; confirm it gets a code like `LG-FR-000001`
- [ ] Open it, upload any PDF as an Aadhaar document → it appears and can be verified
- [ ] Record a payment → the collection bar moves
- [ ] **Activity** tab shows your changes with your name against them
- [ ] Create an agent in **Team & Roles**, sign in as them in a private window,
      confirm they see **only their own leads** and no Team/Audit menu items
- [ ] **Audit Log** loads without a missing-index error (if it errors, indexes
      from step 6 are still building)

---

## Troubleshooting

**`auth/unauthorized-domain` on login**
Step 7d — add the App Hosting hostname to Authorized domains.

**"The query requires an index" in the audit log or leads list**
Indexes are still building (step 6). Check **Firestore → Indexes**. If one
failed, the error message contains a direct link that creates it in one click.

**"Missing or insufficient permissions"**
Rules were not deployed, or were deployed to a different project. Run
`firebase use` to confirm which project is active, then re-run the step 6
deploy.

**Deployed app shows "Firebase is not configured"**
The `NEXT_PUBLIC_*` values in `apphosting.yaml` are still `REPLACE_ME`, or they
were set to `RUNTIME` only. Fix `apphosting.yaml`, push, and let it rebuild.

**Build fails on App Hosting but works locally**
Almost always the root directory. It must be `crm`, not the repo root.

**`npm run seed` says it cannot sign in**
Run `gcloud auth application-default login` and retry. If you are using a
service-account key instead, `FIREBASE_SERVICE_ACCOUNT_KEY` must be the whole
JSON on a single line — or base64-encode the file (`base64 -w0
serviceAccount.json`) and paste that; the script accepts either.

**`npm run seed` cannot work out the project**
Pass it explicitly: `npm run seed -- --project livanto --email you@example.com`.

**Users can sign in but see nothing**
Their profile has `active: false`, or the seed never ran. Check
**Firestore → users** in the console.

---

## Running costs, honestly

For a 10–20 person sales team:

| Service | Typical monthly |
|---|---|
| App Hosting (scales to zero) | ₹0–300 |
| Firestore (well inside free tier) | ₹0 |
| Storage (a few GB of KYC documents) | ₹0–50 |
| Authentication | ₹0 |

The realistic risk is not the CRM itself but leaving something else running on
the same Blaze project. The budget alert from step 2 covers that.

---

## Keeping it running

**Turn on backups** — this is one command and it is the cheapest insurance you
will buy:

```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d \
  --project=livanto
```

**Deploying changes** — with automatic rollouts enabled, push to the live
branch and App Hosting rebuilds. Rules and indexes are separate; after editing
anything in `crm/firebase/`, re-run:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

**Before every release**, run `npm run verify`. If the workbook is ever revised,
that check fails loudly instead of the CRM quietly quoting the wrong price.

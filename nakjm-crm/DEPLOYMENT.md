# Deploying the NAKJM EPC CRM to Firebase — project `nakjm`

Step by step, start to finish, the same playbook used for the Livanto Green
CRM (`crm/`), adapted for NAKJM. Budget about 45 minutes the first time.

---

## Before you start: two things to know

**1. You need the Blaze (pay-as-you-go) plan.** The free Spark plan cannot
run server-side code, and this app has API routes (`/api/users`). There is
no way around this. For a small internal team this runs roughly
**₹0–500/month** — App Hosting scales to zero when nobody is using it, and
Firestore's free tier covers a business this size. Set a budget alert in
step 2 and you will not get a surprise.

**2. Use App Hosting, not Hosting.** They are different products with
confusingly similar names. Plain *Firebase Hosting* serves static files
only — deploying there would give you a broken app with no login and no
API. *Firebase App Hosting* runs the app on Cloud Run and is what these
instructions use.

---

## Step 1 — Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. **Create a project** → name it **`nakjm`**.
   - Firebase will show the project ID underneath. If `nakjm` is already
     taken globally, it will suggest something like `nakjm-a1b2c`.
     **Write down whatever ID it gives you** — you need the exact ID in
     step 5, and it is not always the same as the name.
3. Google Analytics is optional. Skip it unless you want it.

## Step 2 — Upgrade to Blaze and set a budget alert

1. Bottom-left of the console → **Upgrade** → **Blaze**.
2. Attach a billing account.
3. Set the guard rail: **⚙️ → Usage and billing → Details & settings →
   Budgets & alerts** → create a budget of, say, **₹1,000/month** with
   alerts at 50%, 90% and 100%.

## Step 3 — Turn on the three services

**Authentication**
1. **Build → Authentication → Get started**
2. **Sign-in method → Email/Password → Enable → Save**
3. **Sign-in method → Google → Enable → Save**

**Firestore**
1. **Build → Firestore Database → Create database**
2. Choose **Production mode** — the rules in this repo replace the
   default ones in step 6.
3. Location: **`asia-south1` (Mumbai)** for an India-based team. **This
   cannot be changed later**, so pick deliberately.

**Storage**
1. **Build → Storage → Get started**
2. Production mode, same location.
3. Note the bucket name it shows — usually `nakjm.firebasestorage.app`.

## Step 4 — Register the web app and copy the keys

1. **⚙️ Project settings → General**
2. Scroll to **Your apps** → click the **`</>`** (web) icon
3. Nickname: `NAKJM EPC CRM`. Leave "Firebase Hosting" **unchecked** — App
   Hosting is set up separately in step 7.
4. **Register app.** You now get a config block with six values — keep this
   tab open, they're used in step 5 and step 7.

> These values are **public by design** — they ship inside every web app's
> JavaScript. Your data is protected by the security rules deployed in
> step 6, not by keeping these secret.

## Step 5 — Configure and test locally

```bash
cd nakjm-crm
cp .env.example .env.local
```

Fill in the six `NEXT_PUBLIC_FIREBASE_*` values from step 4.

The server routes and the seed script also need admin credentials. In
production App Hosting provides these automatically. Locally, prefer:

```bash
gcloud auth application-default login
```

(Or paste a service-account key into `FIREBASE_SERVICE_ACCOUNT_KEY` — see
`.env.example` for the two options.)

```bash
npm install
npm run typecheck
npm run dev        # http://localhost:3200
```

You will see the login page. You cannot sign in yet — that is step 8.

## Step 6 — Deploy the security rules and indexes

**This is the most important step.** Until it runs, your database is
either locked shut or wide open, and neither is what you want.

```bash
npm install -g firebase-tools
firebase login
```

From the `nakjm-crm/` directory:

```bash
firebase use --add
```

Pick `nakjm` from the list; give it the alias `default`.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Expected output ends with `✔ Deploy complete!`.

## Step 7 — Deploy the app with App Hosting

### 7a. Push your code to GitHub

The code is on the `EV-claci` repo, under `nakjm-crm/`.

### 7b. Create the backend

1. **Build → App Hosting → Get started**
2. **Connect to GitHub** → authorise Firebase → select the `EV-claci` repo
3. Configure:

| Field | Value |
|---|---|
| **Root directory** | `nakjm-crm` |
| **Live branch** | `main` |
| **Automatic rollouts** | Enabled |
| **Backend name** | `nakjm-crm` |
| **Region** | `asia-east1` (closest App Hosting region to India) |

The **root directory must be `nakjm-crm`** — the repo also contains
unrelated `frontend/`, `backend/` and `crm/` apps, and App Hosting will
build the wrong thing if you leave it at the repo root.

4. **Finish and deploy.**

### 7c. Fill in the environment values

The repo ships `nakjm-crm/apphosting.yaml` with `REPLACE_ME` placeholders.
Edit that file with your real values from step 4 and push:

```bash
git add nakjm-crm/apphosting.yaml
git commit -m "Set Firebase web config for the nakjm project"
git push
```

The push triggers a rebuild. First build takes 5–10 minutes; watch it
under **App Hosting → your backend → Rollouts**.

> `NEXT_PUBLIC_*` values must be `availability: [BUILD, RUNTIME]`, not
> runtime alone — they're compiled into the JavaScript bundle at build
> time.

When it finishes you get a URL like
`https://nakjm-crm--nakjm.asia-east1.hosted.app`.

### 7d. Authorise the domain for sign-in

**Authentication → Settings → Authorized domains → Add domain** → paste
your App Hosting hostname.

Miss this and login fails with `auth/unauthorized-domain`.

## Step 8 — Create the first super admin

Still from `nakjm-crm/`, using the credentials from step 5:

```bash
npm run seed -- --email you@nakjminfra.com --name "Your Name"
```

Output:

```
✓ Super admin ready: you@nakjminfra.com

  ┌──────────────────────────────────────────┐
  │  Temporary password: xK9mQ2pL7vNb4T      │
  └──────────────────────────────────────────┘
```

**Copy that password.** It is shown once and never stored.

## Step 9 — Sign in and set up the team

1. Open your App Hosting URL
2. Sign in with the seeded email and temporary password
3. Go to **Users & Roles → Add User** for each admin, project manager,
   operations, finance and site staff member

---

## Custom domain — `app.nakjminfra.com`

1. **App Hosting → your backend → Custom domains → Add domain** →
   `app.nakjminfra.com`
2. Firebase shows you DNS records (usually a couple of `TXT` records for
   verification, then an `A`/`CNAME` record) — add them at wherever
   `nakjminfra.com`'s DNS is managed (your domain registrar or DNS
   provider). The certificate is issued automatically and can take up to
   24 hours.
3. Once it's live, add `app.nakjminfra.com` to **Authentication →
   Settings → Authorized domains** too (same requirement as step 7d).
4. The login page is then `https://app.nakjminfra.com/login`.

---

## Verifying it actually works

- [ ] Sign in as the super admin
- [ ] Add a client, then a project against them
- [ ] Import a BOQ Excel file on the BOQ tab — line items appear for review
- [ ] Generate a quotation from that BOQ — version increments correctly
- [ ] Create a purchase order against a vendor, record a payment against
      it — the PO's paid amount updates
- [ ] Upload a client PO/work order when creating a project or a proforma
      invoice — it uploads to Storage and links on the record
- [ ] Submit a site report — progress shows on the project Overview tab
      and the org-wide Dashboard
- [ ] Create a second user with a narrower role (e.g. Site Engineer),
      sign in as them in a private window, confirm they can't create
      clients/vendors but can submit site reports

---

## Troubleshooting

**`auth/unauthorized-domain` on login**
Step 7d / custom domain step 3 — add the hostname to Authorized domains.

**"Missing or insufficient permissions"**
Rules weren't deployed, or were deployed to a different project. Run
`firebase use` to confirm which project is active, then re-run the step 6
deploy.

**Deployed app shows "Firebase is not configured"**
The `NEXT_PUBLIC_*` values in `apphosting.yaml` are still `REPLACE_ME`, or
set to `RUNTIME` only. Fix `apphosting.yaml`, push, and let it rebuild.

**Build fails on App Hosting but works locally**
Almost always the root directory. It must be `nakjm-crm`, not the repo
root.

**`npm run seed` says it cannot sign in**
Run `gcloud auth application-default login` and retry, or set
`FIREBASE_SERVICE_ACCOUNT_KEY` in `.env.local`.

---

## Keeping it running

**Turn on backups:**

```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d \
  --project=nakjm
```

**Deploying changes** — with automatic rollouts enabled, push to the live
branch and App Hosting rebuilds. Rules and indexes are separate; after
editing anything in `nakjm-crm/firebase/`, re-run:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

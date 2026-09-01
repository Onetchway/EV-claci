# Putting the CRM online — a guide that assumes nothing

This walks you through getting the CRM live on the internet for your team.

**You do not need to know how to code.** Most of it is clicking through
websites. There are five commands you copy and paste, and they all run inside
a black box in your web browser — you do not install anything on your computer.

**Time:** about an hour, though roughly 20 minutes of that is waiting.

**Cost:** you must put a credit card on file. Realistically this will cost you
**₹0–500 a month** for a team of 10–20 people. Step 3 sets up an alert so you
find out immediately if that ever changes.

**What you need before starting**
- A Google account (a Gmail address works)
- A credit card or UPI-linked payment method
- The GitHub account that owns the `EV-claci` code

---

## A few words you will keep seeing

You do not need to understand these deeply. This is just so nothing looks like
gibberish.

| Word | What it actually means |
|---|---|
| **Firebase** | Google's service that will store your leads and run your CRM. |
| **Project** | Your own private space inside Firebase. Yours is called `livanto`. |
| **Console** | The Firebase website where you click things: console.firebase.google.com |
| **Cloud Shell** | A black box in your browser where you paste commands. Nothing is installed on your computer. |
| **Repository / repo** | The folder on GitHub where your CRM's code lives. |
| **Deploy** | Putting the code online so people can use it. |
| **Security rules** | The settings that decide who can see which leads. Without these your data is either locked shut or open to the world. |

---

# Part 1 — Set up Firebase (all clicking)

## Step 1: Create your project

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Sign in with your Google account
3. Click **Create a project**
4. Type **`livanto`** as the name
5. Look just below the name box. It shows a small grey **Project ID**.
   - If it says `livanto`, good.
   - If it says something like `livanto-4f2a9`, that is because someone else in
     the world already used `livanto`. That is fine and normal.

   > ✏️ **Write this Project ID down.** You will need it several times, and it
   > is not always the same as the name. Everywhere this guide says `livanto`,
   > use your actual ID instead.

6. Click **Continue**
7. Google Analytics — switch it **off**. You do not need it. Click **Create project**
8. Wait about 30 seconds, then click **Continue**

## Step 2: Add your payment method

Your CRM needs to run actual software, not just display a web page. Google's
free tier cannot do that, so you need the paid plan. Again — for a team your
size this genuinely costs almost nothing, and the next step protects you.

1. Look at the **bottom-left** of the screen. You will see **Spark plan** and an
   **Upgrade** button.
2. Click **Upgrade** → choose **Blaze — Pay as you go**
3. Follow the prompts to add your card

## Step 3: Set a spending alert ⚠️

**Do not skip this.** It takes two minutes and it is the difference between
noticing a problem immediately and noticing it a month later.

1. Click the **⚙️ gear icon** (top left, next to "Project Overview")
2. Click **Usage and billing**
3. Click the **Details & settings** tab
4. Click **Modify plan**, then find **Budgets & alerts** (this opens Google Cloud)
5. Click **Create budget**
6. Name: `CRM budget`. Amount: **₹1000**
7. Tick the alert boxes for **50%**, **90%**, **100%**
8. Click **Finish**

You will now get an email if spending ever heads somewhere unexpected.

## Step 4: Switch on the three services you need

### 4a. Logins

1. Left sidebar → **Build** → **Authentication**
2. Click **Get started**
3. Click **Email/Password** in the list
4. Turn on the **first** toggle (Email/Password). Leave the second one
   (Email link) off.
5. Click **Save**

### 4b. The database

1. Left sidebar → **Build** → **Firestore Database**
2. Click **Create database**
3. Location: choose **`asia-south1 (Mumbai)`** if your team is in India

   > ⚠️ **This cannot be changed later.** Pick the region closest to where
   > your team actually works.

4. Choose **Start in production mode**
5. Click **Create**, and wait about a minute

### 4c. File storage (for Aadhaar, PAN, site photos)

1. Left sidebar → **Build** → **Storage**
2. Click **Get started**
3. **Start in production mode** → **Next**
4. Same location as before → **Done**
5. When it finishes, look at the top of the page for a line like
   `gs://livanto.firebasestorage.app`

   > ✏️ **Write down that address**, without the `gs://` part. So just
   > `livanto.firebasestorage.app`. You need it in the next step.

## Step 5: Get your six settings

1. Click the **⚙️ gear icon** → **Project settings**
2. Stay on the **General** tab and scroll to the bottom, to **Your apps**
3. Click the **`</>`** icon (it looks like angle brackets)
4. App nickname: `Livanto CRM`
5. **Leave the "Also set up Firebase Hosting" box UNTICKED.** We use a different
   service later, and ticking this causes confusion.
6. Click **Register app**

You now see a block of text. Buried in it are six values you need:

```js
const firebaseConfig = {
  apiKey: "AIzaSyC7xR2mK9pL...",
  authDomain: "livanto.firebaseapp.com",
  projectId: "livanto",
  storageBucket: "livanto.firebasestorage.app",
  messagingSenderId: "482910337265",
  appId: "1:482910337265:web:9a3f2c1b8d7e6f5a4b3c2d"
};
```

> ✏️ **Copy this whole block into a Notepad or Notes file and keep it open.**
> You will paste from it in Part 2.

**Is it safe to have these on screen?** Yes. These six values are public by
design — they are inside every website's code and anyone can read them. What
actually protects your leads is the security rules you install in Part 3.

---

# Part 2 — Put your settings into the code (all clicking)

Your CRM's code needs to know those six values. You will edit one file directly
on the GitHub website — no software needed.

1. Go to **[github.com/Onetchway/EV-claci](https://github.com/Onetchway/EV-claci)**
2. Near the top left there is a button showing a branch name (probably `main`).
   Click it and choose **`claude/ev-charger-crm-build-7ddmrn`**
3. Click into the **`crm`** folder
4. Click the file **`apphosting.yaml`**
5. Click the **pencil ✏️ icon** (top right of the file) to edit it

You will see a section like this:

```yaml
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: REPLACE_ME
```

6. Replace every **`REPLACE_ME`** with the matching value from your Notepad.
   They line up by name:

| In the file | From your Notepad |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

Three that already have values (`livanto.firebaseapp.com`, `livanto`,
`livanto.firebasestorage.app`) are only correct if your Project ID really is
`livanto`. **If yours was different, change those too.**

> ⚠️ **Do not use quote marks**, and keep the spacing exactly as it is. YAML
> files care about indentation. Just replace the words, change nothing else.

Correct:
```yaml
    value: AIzaSyC7xR2mK9pL...
```
Wrong:
```yaml
    value: "AIzaSyC7xR2mK9pL..."
```

7. Scroll to the bottom, click the green **Commit changes** button
8. In the popup, click **Commit changes** again

---

# Part 3 — The five commands

This is the only part with typing, and none of it happens on your computer —
it all runs in a browser window.

## Step 6: Open Cloud Shell

1. Go to **[shell.cloud.google.com](https://shell.cloud.google.com)**
2. Sign in with the same Google account
3. If it asks anything, click **Continue** / **Authorize**
4. Wait for a black box with a blinking cursor

That black box is Cloud Shell. It is a free computer running in Google's data
centre. Everything below gets pasted in there.

> **How to paste:** `Ctrl+V` on Windows, `Cmd+V` on Mac. If right-click paste
> does not work, use the keyboard shortcut. After pasting, press **Enter**.
>
> Commands are not instant. Wait for the blinking cursor to come back before
> pasting the next one.

## Step 7: Tell it which project (command 1 of 5)

Replace `livanto` with your Project ID if it is different:

```
gcloud config set project livanto
```

Expected: `Updated property [core/project].`

## Step 8: Download the code (command 2 of 5)

```
git clone https://github.com/Onetchway/EV-claci.git && cd EV-claci/crm && git checkout claude/ev-charger-crm-build-7ddmrn
```

Expected: some lines about "Cloning into...", ending with a branch message.

> If it says **"Authentication failed"** or asks for a password, your repo is
> private. See Troubleshooting at the bottom.

## Step 9: Install the pieces it needs (command 3 of 5)

```
npm install
```

**This takes 2–3 minutes** and prints a lot of text. Warnings in yellow are
normal and can be ignored. Wait for the cursor to return.

## Step 10: Install the security rules (command 4 of 5) 🔒

**This is the most important command in this guide.** Until it runs, your
database has no rules about who can see what.

```
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

The first time, it will ask you to log in:

- It may ask **"Allow Firebase to collect CLI usage information?"** — answer
  `Y` or `N`, either is fine
- It prints a **long URL**. Copy it, open it in a new browser tab, pick your
  Google account, click **Allow**
- You get a **code**. Copy it, come back to Cloud Shell, paste it, press Enter

Expected ending: **`✔ Deploy complete!`**

### Now wait ⏳

The database is building its search indexes. **This takes 5–15 minutes.**

You can watch it: Firebase console → **Firestore Database** → **Indexes** tab.
Wait until every row says **Enabled**.

You can do Step 11 while waiting.

## Step 11: Create your login (command 5 of 5)

Change the email and name to yours, then paste:

```
npm run seed -- --email you@livantogreen.com --name "Your Name"
```

Want a few sample leads to look at first? Add `--demo` at the end.

Expected:

```
✓ Super admin ready: you@livantogreen.com

  ┌──────────────────────────────────────────┐
  │  Temporary password: xK9mQ2pL7vNb4T      │
  └──────────────────────────────────────────┘
```

> ✏️ **Copy that password immediately.** It is shown once and stored nowhere.
> If you lose it, just run the command again with a different email.

---

# Part 4 — Put the CRM online (all clicking)

## Step 12: Create the App Hosting backend

1. Firebase console → left sidebar → **Build** → **App Hosting**
2. Click **Get started**
3. Click **Connect to GitHub**, authorise Firebase, and pick the **EV-claci**
   repository
4. Now fill the form in **exactly** like this:

| Field | What to put |
|---|---|
| **Live branch** | `claude/ev-charger-crm-build-7ddmrn` |
| **Root directory** | `crm` |
| **Automatic rollouts** | On |
| **Backend ID** | `livanto-crm` |
| **Region** | `asia-east1` |

> ⚠️ **Root directory must be `crm`.** The repository contains other, unrelated
> code. Leave this blank and it builds the wrong thing and fails.

5. Click **Finish and deploy**

**This takes 5–10 minutes.** Watch it under **Rollouts**. When it finishes you
get a web address like:

```
https://livanto-crm--livanto.asia-east1.hosted.app
```

> ✏️ **Write this address down.** This is your CRM.

## Step 13: Allow logins from that address

Firebase blocks logins from addresses it does not recognise, including your own.

1. Firebase console → **Authentication**
2. **Settings** tab → **Authorized domains**
3. Click **Add domain**
4. Paste your address **without** the `https://` part:
   `livanto-crm--livanto.asia-east1.hosted.app`
5. Click **Add**

Skip this and login fails with `auth/unauthorized-domain`.

## Step 14: Log in

1. Open your CRM address
2. Email: the one from Step 11. Password: the temporary one from Step 11
3. You are in.

**Change your password now:** sign out, click **Forgot password**, enter your
email, and follow the link Google emails you.

## Step 15: Add your team

1. Left sidebar → **Team & Roles**
2. Click **Add user**
3. Fill in name, email, and pick a role:

| Role | What they can do |
|---|---|
| **Agent** | Only their own leads. Cannot see anyone else's. |
| **Admin** | Every lead, verify payments and documents, see reports |
| **Super Admin** | Everything, plus creating other admins |

4. Click **Create user**

A password appears **once**. Copy it and send it to that person. Tell them to
change it via **Forgot password**.

---

# Check it actually works

Go through this once:

- [ ] You can log in
- [ ] **Charger Catalogue** — the 60 kW row shows ₹15,50,000 + ₹2,79,000 GST = **₹18,29,000**
- [ ] On the same page, drag **2 × 60 kW** and **2 × 120 kW** into the box → total **₹96,76,000**
- [ ] **New lead** — create a test lead; it gets a code like `LG-FR-000001`
- [ ] Open that lead → **Documents** → upload any PDF
- [ ] **Payments** → record a payment → the green bar moves
- [ ] **Activity** → your changes are listed with your name
- [ ] Create an Agent in Team & Roles, log in as them in a private/incognito
      window → they see **only their own leads**, and no Team or Audit Log menu
- [ ] **Audit Log** opens without an error (if it errors, the indexes from
      Step 10 are still building — wait)

---

# One last thing: backups

Worth doing on day one. Back in Cloud Shell, paste this (change `livanto` to
your Project ID):

```
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d --project=livanto
```

Now you have a rolling week of daily backups.

---

# Troubleshooting

**"auth/unauthorized-domain" when logging in**
Step 13 was missed or the address was typed wrong. It must have no `https://`
and no trailing `/`.

**"The query requires an index"**
The indexes from Step 10 are still building. Check Firestore → Indexes. If one
says *Error*, click the link in the message — it creates the missing one for you.

**"Missing or insufficient permissions"**
Step 10 did not finish, or it ran against a different project. In Cloud Shell
run `gcloud config get-value project` and confirm it matches, then run Step 10
again.

**The site says "Firebase is not configured"**
Part 2 did not take. Go back to `apphosting.yaml` on GitHub and check no
`REPLACE_ME` is left. After fixing, Firebase rebuilds automatically — give it
10 minutes.

**The build failed in App Hosting**
Nine times out of ten this is **Root directory**. It must be `crm`. Fix it under
App Hosting → your backend → Settings, then redeploy.

**"Authentication failed" on Step 8**
Your repository is private. Two options:
- Make it public: GitHub → repo → Settings → scroll down → Change visibility
- Or, in Cloud Shell, run `gh auth login` and follow the prompts, then retry

**Step 11 says "Could not sign in to Firebase"**
Run `gcloud auth application-default login` in Cloud Shell, follow the URL and
code, then run Step 11 again.

**Step 11 says Firestore does not exist**
Step 4b was missed. Create the database, then retry.

**I lost the temporary password**
Run Step 11 again with a *different* email address to create a second super
admin, log in as that, and reset the first from **Team & Roles**.

**Cloud Shell says my session expired**
Normal — it sleeps after inactivity. Reconnect, then run `cd EV-claci/crm`
before your next command.

---

# What things cost

| Service | Typical monthly, 10–20 users |
|---|---|
| App Hosting | ₹0–300 (it sleeps when nobody is using it) |
| Database | ₹0 (well within the free allowance) |
| File storage | ₹0–50 |
| Logins | ₹0 |

The real risk is not this CRM — it is leaving something *else* running on the
same account later. That is exactly what the alert in Step 3 is for.

---

# When you want to change something

- **Change who is on the team** → Team & Roles inside the CRM. No technical work.
- **Change charger prices** → these come from your Excel model and live in the
  code. This one needs a developer.
- **Update the code** → anything pushed to that GitHub branch rebuilds and goes
  live automatically in about 10 minutes.
- **Change the security rules** → after editing anything in `crm/firebase/`,
  Step 10 must be run again. It is not automatic.

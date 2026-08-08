# Mac walkthrough — every single step

Written for a Mac, assuming you have never used Terminal. Nothing is skipped.

Work through it in order. Do not jump ahead — several steps only work if the
one before them finished properly.

If anything on your screen differs from what this says to expect, **stop** and
ask, rather than carrying on. A wrong turn early produces confusing errors much
later.

---

# PART 0 — Getting Terminal ready

## 0.1 Open Terminal

1. Hold **Cmd** and press **Space**. A search bar appears in the middle of the screen.
2. Type: **terminal**
3. Press **Enter**

A window opens with a white or black background and a line of text ending in a
`$` or `%` symbol, with a blinking cursor. Something like:

```
mark@MacBook-Pro ~ %
```

That is called the **prompt**. It means Terminal is ready for you to type.

## 0.2 How to use Terminal

Three things to know, and that is genuinely all:

- **To run a command:** type it (or paste it), then press **Enter**.
- **To paste:** **Cmd+V**. (Right-click paste often does not work. Use Cmd+V.)
- **To know when a command has finished:** the prompt (`%` with a blinking
  cursor) comes back. Some commands take minutes. Do not type anything while
  waiting — just let it run.

> **Terminal never asks "are you sure?"** It does exactly what you type, the
> moment you press Enter. So paste one command at a time and read what comes
> back before pasting the next.

## 0.3 Check Node.js is installed

The app needs a program called Node.js. Let us find out if you have it.

Paste this and press Enter:

```
node -v
```

**If you see a version number** like `v20.11.0` or `v22.14.0` — you have it.
Skip to Part 1.

**If you see `command not found: node`** — you need to install it:

1. Go to **[nodejs.org](https://nodejs.org)**
2. Click the big green button on the left, labelled **LTS** (it will say
   something like "22.x.x LTS — Recommended For Most Users")
3. A `.pkg` file downloads. Double-click it.
4. Click **Continue → Continue → Agree → Install**. Enter your Mac password
   when asked.
5. When it finishes, **close Terminal completely** (Cmd+Q) and open it again
   (step 0.1)
6. Type `node -v` again — you should now see a version number

---

# PART 1 — Point Terminal at your project

Terminal is always "sitting in" one folder. You have to move it into your
project folder before the commands will work.

## 1.1 Find your project folder in Finder

Open Finder and locate the **`livanto-ev-crm`** folder — the one you got by
unzipping. It is probably on your Desktop or in Downloads.

Open it. You should see files including `package.json`, `README.md` and a
folder called `src`. If you instead see a *single* folder inside also called
`livanto-ev-crm`, go into that one — that is the real project folder.

## 1.2 Move Terminal into that folder

This is the easiest and most reliable way, and it avoids typing paths:

1. In Terminal, type **`cd`** followed by **one space**. Do not press Enter yet.

   ```
   cd 
   ```

2. Now **drag the `livanto-ev-crm` folder from Finder** and drop it onto the
   Terminal window.
3. Terminal fills in the full path by itself. It will look something like:

   ```
   cd /Users/mark/Downloads/livanto-ev-crm
   ```

4. **Now** press Enter.

The prompt changes to show the folder name. You are in.

## 1.3 Confirm you are in the right place

Paste this:

```
pwd && ls
```

`pwd` shows where you are, `ls` lists what is there. You should see the path
ending in `livanto-ev-crm`, then a list including:

```
README.md          package.json       src
START-HERE.md      firebase           scripts
apphosting.yaml    firebase.json      tsconfig.json
```

**If you do not see `package.json`,** you are in the wrong folder. Redo 1.2.

## 1.4 Confirm you have the complete code ⚠️

An earlier version of the zip was missing files. Check yours:

```
ls src/lib
```

You should see **10 entries** — 8 files plus two folders, `db` and `firebase`:

```
analytics.ts   constants.ts   diff.ts     permissions.ts   types.ts
catalog.ts     db             firebase    pricing.ts       utils.ts
```

That is the correct and complete list. (There are 15 files in total once you
count inside the two folders, which is what the next command checks.)

Then check inside the two sub-folders:

```
ls src/lib/db src/lib/firebase
```

Expect `activity.ts  documents.ts  leads.ts  payments.ts  users.ts` and
`admin.ts  client.ts`.

**If `catalog.ts`, `pricing.ts` or `leads.ts` are missing,** you have the old
zip. Download the corrected one and start Part 1 again with the new folder.

---

# PART 2 — Install the app's building blocks

Still in Terminal, in your project folder:

```
npm install
```

Press Enter, then **wait 2 to 3 minutes**. You will see a lot of scrolling text.

**This is normal and not a problem:**
- Yellow lines starting with `npm warn deprecated`
- Mentions of vulnerabilities

**Success looks like:**

```
added 614 packages in 42s
```

and the prompt returns.

> **If you see `command not found: npm`** — Node.js is not installed. Go back
> to step 0.3.

---

# PART 3 — Get your six Firebase settings

Now switch to your web browser for a bit.

## 3.1 Open your project

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Click your **`livanto`** project

> ⚠️ You mentioned a project called `livanto` already exists. **Use that one.**
> Do not create a second project — you would end up with your settings in one
> and your data in the other, which causes permission errors that are very hard
> to unpick.

## 3.2 Register the web app (if you have not already)

1. Click the **⚙️ gear icon** at the top left, next to "Project Overview"
2. Click **Project settings**
3. Stay on the **General** tab, scroll to the bottom, to **Your apps**

**If you already see a web app listed,** click it and skip to 3.3.

**If not:**
1. Click the **`</>`** icon (angle brackets)
2. App nickname: `Livanto CRM`
3. **Leave "Also set up Firebase Hosting" UNTICKED** — we use a different
   service later, and ticking this causes confusion
4. Click **Register app**
5. Click **Continue to console**

## 3.3 Copy the settings

Back in **Project settings → General → Your apps**, scroll to **SDK setup and
configuration** and select **Config**. You will see:

```js
const firebaseConfig = {
  apiKey: "AIzaSyC7xR2mK9pL...",
  authDomain: "livanto.firebaseapp.com",
  projectId: "livanto",
  storageBucket: "livanto.firebasestorage.app",
  messagingSenderId: "482910337265",
  appId: "1:482910337265:web:9a3f2c1b8d7e6f5a"
};
```

**Leave this browser tab open.** You are about to copy from it.

---

# PART 4 — Put those settings into the app

## 4.1 Create the settings file

Back in Terminal:

```
cp .env.example .env.local
```

Nothing appears to happen. That is correct — it copied a file silently.

## 4.2 Open it for editing

```
open -e .env.local
```

TextEdit opens showing a file with lots of `#` comment lines and some blank
settings.

## 4.3 Fill in the six values

Find these six lines and put your values after each `=` sign:

| Line in the file | Value to copy from the browser |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY=` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID=` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID=` | `appId` |

When done it should look like this:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC7xR2mK9pL...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=livanto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=livanto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=livanto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=482910337265
NEXT_PUBLIC_FIREBASE_APP_ID=1:482910337265:web:9a3f2c1b8d7e6f5a
```

⚠️ **Three rules:**
- **No quote marks.** `apiKey: "AIzaSy..."` in the browser becomes
  `NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...` here — drop the quotes.
- **No spaces** around the `=` sign.
- **No comma** at the end of the line.

## 4.4 Save

Press **Cmd+S**, then **Cmd+W** to close TextEdit.

> **Are these secret?** No. These six values are inside every website's code
> and anyone can read them. What protects your data is Part 6.

---

# PART 5 — Switch on the three Firebase services

Back to the browser, in your `livanto` project.

## 5.1 Logins

1. Left sidebar → **Build** → **Authentication**
2. Click **Get started**
3. Click **Email/Password** in the list
4. Turn on the **first** toggle. Leave the second one (Email link) off.
5. Click **Save**

## 5.2 The database

1. Left sidebar → **Build** → **Firestore Database**
2. Click **Create database**
3. Location: **`asia-south1 (Mumbai)`** for an India-based team

   > ⚠️ **This can never be changed.** Choose the region closest to where your
   > team actually works.

4. Select **Start in production mode**
5. Click **Create**, wait about a minute

## 5.3 File storage

1. Left sidebar → **Build** → **Storage**
2. Click **Get started**
3. **Start in production mode** → **Next**
4. Same location as 5.2 → **Done**

---

# PART 6 — Install the security rules 🔒

**This is the most important step in the whole guide.** Until it runs, the app
cannot read anything and every page shows "Missing or insufficient permissions".

## 6.1 Log in to the Firebase tool

Back in Terminal (make sure you are still in the project folder — if unsure,
run `pwd`):

```
npx firebase-tools login
```

- If it asks **"Ok to proceed? (y)"** — type `y` and press Enter
- If it asks about collecting usage information — `Y` or `N`, either is fine
- Your **browser opens**. Choose your Google account. Click **Allow**.
- The browser says you can close the tab. Go back to Terminal.

You should see `✔  Success! Logged in as you@gmail.com`

## 6.2 Deploy the rules

Replace `livanto` with your real project ID if different:

```
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage --project livanto
```

This takes about a minute. Success looks like:

```
✔  Deploy complete!
```

## 6.3 Wait for the indexes ⏳

The database is now building search indexes in the background. **This takes 5
to 15 minutes.**

To watch: Firebase Console → **Firestore Database** → **Indexes** tab. Wait
until all 12 rows say **Enabled**.

You can carry on with Part 7 while this happens.

---

# PART 7 — Create your login

The app has no users yet. This step creates the first one — you, as Super Admin.

## 7.1 Download an admin key

1. Browser → **⚙️ Project settings** → **Service accounts** tab
2. Click **Generate new private key**
3. A warning appears — click **Generate key**
4. A `.json` file downloads to your Downloads folder

## 7.2 Copy its contents

1. Open Finder → **Downloads**
2. Find the file, named something like `livanto-firebase-adminsdk-xxxxx.json`
3. **Right-click it → Open With → TextEdit**
4. Press **Cmd+A** (select all), then **Cmd+C** (copy)
5. Close TextEdit

## 7.3 Add it to your settings file

In Terminal:

```
open -e .env.local
```

1. Scroll to the very bottom of the file
2. Click at the end of the last line and press **Enter** to make a new line
3. Type exactly: `FIREBASE_SERVICE_ACCOUNT_KEY=`
4. Immediately after the `=`, press **Cmd+V** to paste

It must all be on **one single line**. It will be very long and run off the
edge of the window — that is fine and correct.

5. Press **Cmd+S** to save, **Cmd+W** to close

> ⚠️ **This one really is secret.** Unlike the six values in Part 4, this key
> gives complete control of your database. It is safe in `.env.local` (that file
> is never uploaded anywhere), but:
> - Never paste it into a chat, email or website
> - Delete the downloaded `.json` file from Downloads once you have pasted it

## 7.4 Delete the downloaded file

In Finder → Downloads → right-click the `.json` file → **Move to Bin**. Then
empty the Bin.

## 7.5 Create your account

In Terminal, **change the email and name to your own**, then run it:

```
npm run seed -- --email you@livantogreen.com --name "Your Name"
```

> Want five sample leads to look at, including the Shoyeb Khan site enquiry?
> Add `--demo` to the very end.

Success looks like:

```
Authenticated with a service-account key (project livanto).

Seeding Livanto Green CRM

✓ Super admin ready: you@livantogreen.com

  ┌──────────────────────────────────────────┐
  │  Temporary password: xK9mQ2pL7vNb4T      │
  └──────────────────────────────────────────┘

  Copy it now — it is not shown again and is not stored anywhere.

✓ Lead code counter ready
```

## 7.6 Save that password

**Select the password with your mouse and press Cmd+C.** Paste it somewhere
safe — a note, a password manager.

It is not stored anywhere. If you lose it, run 7.5 again with a *different*
email address to create a second admin.

---

# PART 8 — Run it on your Mac

## 8.1 Start it

```
npm run dev
```

After a few seconds:

```
▲ Next.js 14.2.35
- Local:  http://localhost:3100
✓ Ready in 2.3s
```

**Leave this Terminal window open.** The app runs only while this is running.

## 8.2 Open it

In your browser, go to:

```
http://localhost:3100
```

You should see the green Livanto Green CRM login screen.

## 8.3 Sign in

- **Email:** the one from step 7.5
- **Password:** the temporary one from step 7.5

You should land on the Dashboard.

## 8.4 Check it actually works

- Click **Charger Catalogue** — the 60 kW row should read ₹15,50,000 +
  ₹2,79,000 GST = **₹18,29,000**
- On the same page, drag **2 × 60 kW** and **2 × 120 kW** into the box on the
  right — the total should be **₹96,76,000**
- Click **Leads → New lead**, fill in a name, phone and city, and save

If all three work, everything is correctly connected.

## 8.5 Stopping and restarting

- **To stop:** click the Terminal window, hold **Ctrl** and press **C**
- **To start again later:** open Terminal, `cd` into the folder (step 1.2),
  then `npm run dev`

---

# PART 9 — Put it online for your team

Everything so far runs only on your Mac, and only while Terminal is open. To
give your team a web address, follow **Part 4 of `START-HERE.md`** in this same
folder.

In short: connect App Hosting to your GitHub repository with **root directory
`crm`**, then add the web address it gives you to **Authentication → Settings →
Authorized domains**.

> ⚠️ **Do not put your service-account key into `apphosting.yaml`,** and never
> into any setting whose name starts with `NEXT_PUBLIC_`. Those are sent to
> every visitor's browser. App Hosting authenticates by itself — the key from
> Part 7 is for your Mac only.

---

# If something goes wrong

**`command not found: npm`**
Node.js is not installed → step 0.3.

**`no such file or directory: package.json`**
Terminal is in the wrong folder → step 1.2.

**`Module not found: Can't resolve '@/lib/catalog'`**
You have the old, incomplete zip → step 1.4.

**The page says "Firebase is not configured"**
`.env.local` is wrong. Run `open -e .env.local` and check: no quote marks, no
spaces around `=`, all six lines filled. Then stop the app (Ctrl+C) and
`npm run dev` again — settings are only read at startup.

**"Missing or insufficient permissions"**
Part 6 did not complete, or ran against a different project. Run it again and
check the project ID.

**"The query requires an index"**
The indexes are still building → step 6.3. Wait.

**`auth/invalid-credential` when signing in**
Wrong email or password. Run step 7.5 again to create a fresh one.

**`npm run seed` says it cannot sign in**
The key in step 7.3 is not on one single line, or got pasted with a line break.
Redo 7.2 and 7.3.

**Terminal shows a `>` and will not run anything**
You have an unclosed quote mark. Press **Ctrl+C** and retype the command.

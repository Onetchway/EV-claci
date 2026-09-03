# Firebase setup brief — paste this into ChatGPT

Copy everything between the two lines below into ChatGPT. It is written to be
self-contained: ChatGPT cannot see your code, so this tells it everything it
needs and, just as importantly, what it must not change.

---

## ✂️ COPY FROM HERE ✂️

I need help setting up Firebase for an existing, working Next.js application.
Please read all the constraints before answering.

### What I am doing

I have a finished CRM application. I am **not** writing code — I only need help
creating and configuring the Firebase project it connects to, and diagnosing
errors if setup goes wrong.

### Ground rules — important

1. **The application code is complete and verified.** It compiles with zero
   TypeScript errors and builds successfully. If something fails, the cause is
   Firebase configuration, not missing code. Please do not offer to rewrite,
   regenerate or "fix" application files.
2. **Do not redesign the data model, the user roles, or the security rules.**
   These are already written and are interdependent — the roles are enforced in
   the app, in the server routes, and inside the security rules. Changing one
   without the others silently breaks access for everyone. If you think
   something is wrong, tell me, but do not hand me replacement code for them.
3. **I am not a developer.** Please give exact, literal steps: which page, which
   button, which menu. If I must run a command, give the whole command ready to
   paste, and tell me what output means success.
4. **If you are unsure, say so.** I would much rather hear "I am not certain,
   check the Firebase docs for X" than a confident answer that turns out to be
   invented. I have already lost time to a tool that guessed.

### The application

- Next.js 14.2.35, App Router, TypeScript
- Firebase Web SDK v10 (modular)
- Deployed on **Firebase App Hosting** (not plain Firebase Hosting — the app has
  server-side API routes, so static hosting cannot run it)
- The app lives in a `crm/` subfolder of the repository, not at the root

### Firebase products it uses

| Product | Used for |
|---|---|
| Authentication | Email/Password sign-in only. No Google/phone/social. |
| Cloud Firestore | All CRM data |
| Cloud Storage | Uploaded KYC documents (Aadhaar, PAN, site photos) |
| App Hosting | Running the app itself |

### Firestore structure the app writes to

```
users/{uid}                     staff accounts and their role
counters/leads                  a counter used to generate lead reference codes
leads/{leadId}                  the CRM records
  ├── payments/{paymentId}      sub-collection
  └── documents/{documentId}    sub-collection
activities/{activityId}         append-only audit log
```

Cloud Storage path: `leads/{leadId}/{documentKind}/{filename}`

### User roles

Exactly three, spelled in capitals with underscores:

```
SUPER_ADMIN
ADMIN
AGENT
```

These exact strings are also written into Firebase Auth custom claims and are
checked inside the security rules. **Please do not suggest renaming them or
adding roles like "manager", "sales" or "viewer".** Doing so would break the
security rules that are already deployed.

### Environment variables

Six public values, read by the browser (these are safe to be public — Firebase
web config always is):

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Server-side admin access uses **Application Default Credentials** in production
(App Hosting supplies these automatically — there is no service-account key to
store). Locally it can optionally use `FIREBASE_SERVICE_ACCOUNT_KEY`.

Please never ask me to paste the contents of any private key or service-account
file into this chat.

### Security rules and indexes

These files already exist in my repository and must be deployed as-is:

```
crm/firebase/firestore.rules
crm/firebase/storage.rules
crm/firebase/firestore.indexes.json    (12 composite indexes)
```

Deployed with:

```
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

**Please do not write me new rules.** If a rule seems to be causing a problem,
explain which rule and why, and I will take it back to the developer.

### What I need help with

<!-- Delete the ones that do not apply, and add your actual error message -->

1. Creating the Firebase project and enabling Authentication, Firestore and
   Storage correctly
2. Understanding the Blaze (pay-as-you-go) plan requirement and keeping costs
   controlled
3. Setting up App Hosting to deploy from my GitHub repository, where the app is
   in the `crm/` subfolder
4. Diagnosing this error I am seeing:

```
[paste the exact error message here]
```

### Facts about my project

<!-- Fill these in before sending -->

- Firebase project ID: `________`
- Storage bucket shown in the console: `________`
- App Hosting URL (if I have got that far): `________`
- Where it fails: `________`

## ✂️ COPY TO HERE ✂️

---

## Things to watch for in the reply

A few answers are common, confidently given, and wrong for this project. If you
see any of these, push back or come back to me:

**"Just use Firebase Hosting"** — wrong. This app has server-side API routes.
Plain Hosting serves static files only and will give you an app where login
does nothing. It must be **App Hosting**.

**"You can do this on the free Spark plan"** — wrong. Spark cannot run
server-side code. Blaze is required. (It is still nearly free at your usage —
the cost concern is real but small.)

**"Set your rules to `allow read, write: if true`"** — this is a very common
suggestion for fixing permission errors. It makes every lead, phone number and
uploaded Aadhaar card readable by anyone on the internet who knows your project
ID. Never deploy it, not even temporarily.

**Any answer that renames the roles** to admin/manager/sales/viewer, or offers
you a fresh `types.ts`, `permissions.ts` or rules file — that is the failure
that already cost you a round. The roles are `SUPER_ADMIN`, `ADMIN`, `AGENT`.

**"Put your service account key in an environment variable called
NEXT_PUBLIC_..."** — anything starting with `NEXT_PUBLIC_` is shipped to every
visitor's browser. A service-account key there would hand full control of your
database to anyone who views the page source.

---

## Honestly — you may not need ChatGPT for this

`START-HERE.md` in this same folder already walks the whole setup step by step,
written for someone with no technical background, with a troubleshooting
section keyed to the exact error messages Firebase produces.

The brief above is genuinely useful for two things: when you hit an error the
troubleshooting section does not cover, and when you want a second explanation
of a step in different words. For the main path, follow START-HERE.md — it was
written against this specific codebase, which a general assistant cannot see.

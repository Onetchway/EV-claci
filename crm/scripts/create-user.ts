/**
 * Create or promote a user by email — most commonly used to grant Super
 * Admin, since that can't be done from inside the app (nobody can promote
 * themselves).
 *
 *   npm run create-user -- --email anand@livantogreen.com --name "Anand" --role SUPER_ADMIN
 *
 * If a Firebase Auth user with that email already exists (e.g. they already
 * signed in once via Google, which auto-provisions an Agent profile through
 * the app's own bootstrap path), this finds that same account by email and
 * updates it in place — it does not create a second, disconnected identity.
 * Safe to re-run.
 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Role } from "../src/lib/constants";

// --- env ---------------------------------------------------------------------

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        const [, key, rawValue] = m;
        if (process.env[key!] !== undefined) continue;
        process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file is optional */
    }
  }
}
loadEnv();

function args(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; } else { out[key] = true; }
  }
  return out;
}
const ARGS = args();

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json);
    return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  return null;
}

function projectId(): string | undefined {
  return (
    (ARGS.project as string | undefined) ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function init() {
  if (getApps().length) return;
  const sa = serviceAccount();
  if (sa) {
    initializeApp({ credential: cert(sa), projectId: sa.projectId });
    console.log(`Authenticated with a service-account key (project ${sa.projectId}).`);
    return;
  }
  const project = projectId();
  if (!project) {
    console.error(
      "\nCould not work out which Firebase project to use.\n\n" +
        "In Google Cloud Shell, run this first:\n" +
        "    gcloud config set project YOUR-PROJECT-ID\n\n" +
        "Or pass it directly:\n" +
        '    npm run create-user -- --project YOUR-PROJECT-ID --email you@example.com --role SUPER_ADMIN\n',
    );
    process.exit(1);
  }
  try {
    initializeApp({ credential: applicationDefault(), projectId: project });
    console.log(`Authenticated as the signed-in Google account (project ${project}).`);
  } catch (err) {
    console.error(
      "\nNo Google credentials found. In Cloud Shell run:\n" +
        "    gcloud auth application-default login\n",
    );
    console.error(err);
    process.exit(1);
  }
}
init();
const auth = getAuth();
const db = getFirestore();

// --- main ---------------------------------------------------------------------

const VALID_ROLES: Role[] = [
  "SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "AGENT", "FINANCE", "OPERATIONS", "VIEWER",
];

async function main() {
  const email = (ARGS.email as string | undefined)?.trim().toLowerCase();
  const name = (ARGS.name as string | undefined)?.trim();
  const role = (ARGS.role as string | undefined)?.trim().toUpperCase() as Role | undefined;

  if (!email) {
    console.error('Usage: npm run create-user -- --email you@livantogreen.com --name "Full Name" --role SUPER_ADMIN');
    process.exit(1);
  }
  if (role && !VALID_ROLES.includes(role)) {
    console.error(`--role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  const finalRole = role ?? "AGENT";

  let userRecord = await auth.getUserByEmail(email).catch(() => null);
  if (userRecord) {
    console.log(`Found existing Auth user for ${email} (uid ${userRecord.uid}).`);
  } else {
    userRecord = await auth.createUser({
      email,
      displayName: name || email.split("@")[0],
      emailVerified: true,
    });
    console.log(`Created a new Auth user for ${email} (uid ${userRecord.uid}). They sign in with Google — no password was set.`);
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: finalRole, roles: [finalRole] });
  console.log(`Set custom claim role=${finalRole}.`);

  const userRef = db.collection("users").doc(userRecord.uid);
  const existing = await userRef.get();

  await userRef.set(
    {
      uid: userRecord.uid,
      email,
      name: name || existing.data()?.name || userRecord.displayName || email.split("@")[0],
      role: finalRole,
      roles: [finalRole],
      phone: existing.data()?.phone ?? "",
      managerId: existing.data()?.managerId ?? null,
      region: existing.data()?.region ?? null,
      active: true,
      photoURL: userRecord.photoURL ?? existing.data()?.photoURL ?? null,
      createdAt: existing.data()?.createdAt ?? FieldValue.serverTimestamp(),
      createdBy: existing.data()?.createdBy ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`Firestore profile upserted with role=${finalRole}, active=true.`);
  console.log(
    "\nNote: an already-signed-in browser session for this account keeps its OLD custom claims " +
      "until the ID token refreshes (usually within an hour, or immediately on next sign-out/sign-in).",
  );
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });

/**
 * One-time bootstrap.
 *
 *   npm run seed -- --email you@nakjminfra.com --name "Your Name"
 *
 * Creates the super-admin account so somebody can sign in at all. Safe to
 * re-run: it upserts by email.
 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
        "In Google Cloud Shell, run this first:\n    gcloud config set project YOUR-PROJECT-ID\n\n" +
        "Or pass it directly:\n    npm run seed -- --project YOUR-PROJECT-ID --email you@example.com\n",
    );
    process.exit(1);
  }
  try {
    initializeApp({ credential: applicationDefault(), projectId: project });
    console.log(`Authenticated as the signed-in Google account (project ${project}).`);
  } catch (err) {
    console.error(
      "\nNo Google credentials found.\n\n" +
        "If you are in Google Cloud Shell this should not happen — try:\n    gcloud auth application-default login\n\n" +
        "On your own machine, either run that same command, or set FIREBASE_SERVICE_ACCOUNT_KEY in nakjm-crm/.env.local.\n",
    );
    console.error(err);
    process.exit(1);
  }
}
init();

const auth = getAuth();
const db = getFirestore();

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function main() {
  const email = (ARGS.email as string) || process.env.SEED_SUPER_ADMIN_EMAIL;
  const name = (ARGS.name as string) || process.env.SEED_SUPER_ADMIN_NAME || "Super Admin";
  if (!email) {
    console.error('Pass --email you@nakjminfra.com (or set SEED_SUPER_ADMIN_EMAIL in .env.local).');
    process.exit(1);
  }

  const existing = await auth.getUserByEmail(email).catch(() => null);
  const password = (ARGS.password as string) || process.env.SEED_SUPER_ADMIN_PASSWORD || randomPassword();

  const uid = existing
    ? existing.uid
    : (await auth.createUser({ email, password, displayName: name, emailVerified: true })).uid;

  await auth.setCustomUserClaims(uid, { role: "SUPER_ADMIN", roles: ["SUPER_ADMIN"] });

  await db.collection("users").doc(uid).set(
    {
      uid, email, name, role: "SUPER_ADMIN", roles: ["SUPER_ADMIN"], active: true, phone: "",
      photoURL: null, createdAt: FieldValue.serverTimestamp(), lastLoginAt: null,
    },
    { merge: true },
  );

  console.log(`\n✓ Super admin ready: ${email}`);
  if (!existing) {
    console.log(`\n  ┌──────────────────────────────────────────┐`);
    console.log(`  │  Temporary password: ${password.padEnd(20)}│`);
    console.log(`  └──────────────────────────────────────────┘\n`);
  } else {
    console.log("  (account already existed — role/profile refreshed, password unchanged)\n");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

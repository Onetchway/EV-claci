/**
 * Create (or update) a team member from the command line.
 *
 *   npm run create-user -- --email jane@nakjminfra.com --name "Jane Doe" --role ADMIN
 *
 * Roles: SUPER_ADMIN, ADMIN, PROJECT_MANAGER, OPERATIONS, FINANCE, SITE_ENGINEER, VIEWER.
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

if (!getApps().length) {
  const sa = serviceAccount();
  const projectId = (ARGS.project as string) || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (sa) initializeApp({ credential: cert(sa), projectId: sa.projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}

const auth = getAuth();
const db = getFirestore();

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function main() {
  const email = ARGS.email as string;
  const name = ARGS.name as string;
  const role = (ARGS.role as string) || "VIEWER";
  if (!email || !name) {
    console.error('Usage: npm run create-user -- --email you@nakjminfra.com --name "Your Name" --role ADMIN');
    process.exit(1);
  }

  const existing = await auth.getUserByEmail(email).catch(() => null);
  const password = (ARGS.password as string) || randomPassword();
  const uid = existing ? existing.uid : (await auth.createUser({ email, password, displayName: name, emailVerified: true })).uid;

  await auth.setCustomUserClaims(uid, { role, roles: [role] });
  await db.collection("users").doc(uid).set(
    { uid, email, name, role, roles: [role], active: true, phone: (ARGS.phone as string) || "", photoURL: null, createdAt: FieldValue.serverTimestamp(), lastLoginAt: null },
    { merge: true },
  );

  console.log(`\n✓ ${email} — role ${role}`);
  if (!existing) console.log(`  Temporary password: ${password}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });

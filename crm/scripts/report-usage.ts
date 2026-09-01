/**
 * Reports this CRM's current employee count to the Alpha platform's
 * super-admin control plane, for per-employee billing — the tenant-side
 * counterpart to backend/src/jobs/reportUsage.js, adapted for this app's
 * Firebase Admin SDK instead of Postgres.
 *
 * This is the ONLY data this tenant CRM sends to the platform. No employee
 * names, no leads, no operational data — a single count, pushed by this
 * app, never pulled by the platform (see platform/README.md's "Why the
 * super admin can't see tenant data").
 *
 *   npm run report-usage
 *
 * Meant to be cron'd daily. No-ops if PLATFORM_API_URL /
 * PLATFORM_TENANT_API_KEY aren't set, so a standalone deploy (not running
 * under the Alpha platform) is unaffected.
 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

function init() {
  if (getApps().length) return;
  const sa = serviceAccount();
  if (sa) {
    initializeApp({ credential: cert(sa), projectId: sa.projectId });
    return;
  }
  const project =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  initializeApp({ credential: applicationDefault(), projectId: project });
}

async function main() {
  const apiUrl = process.env.PLATFORM_API_URL;
  const apiKey = process.env.PLATFORM_TENANT_API_KEY;
  if (!apiUrl || !apiKey) {
    console.log("[report-usage] PLATFORM_API_URL / PLATFORM_TENANT_API_KEY not set — skipping (not running under the Alpha platform).");
    return;
  }

  init();
  const db = getFirestore();
  const usersSnap = await db.collection("users").where("active", "==", true).get();
  const employeeCount = usersSnap.size;

  const res = await fetch(`${apiUrl}/usage/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Api-Key": apiKey },
    body: JSON.stringify({ employee_count: employeeCount }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Platform rejected usage report (${res.status}): ${body}`);
  }

  console.log(`[report-usage] Reported ${employeeCount} active users to the platform.`);
}

main().catch((err) => {
  console.error("[report-usage] Failed:", err.message);
  process.exit(1);
});

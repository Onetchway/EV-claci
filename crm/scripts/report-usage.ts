/**
 * Reports which of this CRM's users are active to the Alpha platform's
 * super-admin control plane, for per-employee billing — the tenant-side
 * counterpart to backend/src/jobs/reportUsage.js, adapted for this app's
 * Firebase Admin SDK instead of Postgres.
 *
 * Nothing about this tenant's leads, operational data, or who their
 * employees actually are crosses this line — no name, no email, no role.
 * Each user is reported only as their opaque Firestore uid (meaningless
 * outside this tenant's own CRM) plus whether they're currently active,
 * so the platform can track *when* each seat joined/left and prorate the
 * bill accordingly (Google Workspace style: a seat added mid-month is
 * billed only for the days it existed) instead of just counting heads at
 * month end. Pushed by this app on its own schedule, never pulled by the
 * platform (see tenantAuth.js's own comment on the receiving end). Set
 * PLATFORM_REPORT_COUNT_ONLY=1 to fall back to sharing just a flat active
 * count instead, with no join-date proration.
 *
 * This one CRM deployment can serve MANY tenants at once (see
 * src/lib/tenant.ts) — so this reports once PER ORG, never the whole
 * `users` collection as a single blob: each org's own users are counted
 * separately and sent under that org's own platform API key (Firestore's
 * organizationPlatformKeys/{orgId}, same key api/organizations/[id]/
 * platform-key sets — see lib/platform-features.ts's getOrgPlatformKey
 * for the read side of that same collection). The one org with no orgId
 * at all (a standalone/non-white-label deploy) instead uses this whole
 * instance's own PLATFORM_TENANT_API_KEY env var. An org with neither is
 * silently skipped — it isn't onboarded onto the platform.
 *
 *   npm run report-usage
 *
 * Meant to be cron'd daily — see crm/src/app/api/cron/report-usage/route.ts
 * for the HTTP-triggerable equivalent (what an external scheduler, e.g.
 * Vercel Cron / Cloud Scheduler, should actually hit in a real deploy).
 * No-ops entirely if PLATFORM_API_URL isn't set.
 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { reportAllOrgsUsage } from "../src/lib/platform-usage-report";

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
  if (!apiUrl) {
    console.log("[report-usage] PLATFORM_API_URL not set — skipping (not running under the Alpha platform).");
    return;
  }

  init();
  const db = getFirestore();
  const results = await reportAllOrgsUsage(db, apiUrl, process.env.PLATFORM_TENANT_API_KEY, process.env.PLATFORM_REPORT_COUNT_ONLY === "1");

  if (results.length === 0) {
    console.log("[report-usage] No org has a platform API key configured — nothing to report.");
    return;
  }
  for (const r of results) {
    console.log(`[report-usage] ${r.orgLabel}: reported ${r.reportedUsers} users (${r.activeUsers} active)${r.mode === "count_only" ? " (count only)" : ""}.`);
  }
}

main().catch((err) => {
  console.error("[report-usage] Failed:", err.message);
  process.exit(1);
});

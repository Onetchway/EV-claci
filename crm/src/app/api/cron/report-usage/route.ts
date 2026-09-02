import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { reportAllOrgsUsage } from "@/lib/platform-usage-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HTTP-triggerable equivalent of scripts/report-usage.ts (see that file's
 * own comment for the full rationale, including why this reports once
 * per org rather than the whole `users` collection as one blob). Needed
 * because nothing keeps a persistent Node process around to run a cron
 * job in-process the way platform/backend's Express server does (node-cron
 * in platform/backend/src/jobs/scheduler.js) — a serverless Next.js
 * deploy needs an external scheduler (Vercel Cron, Cloud Scheduler, a
 * plain crontab hitting this URL with curl) instead. Guarded by
 * CRON_SECRET so it can't be triggered by anyone who finds the URL; not
 * the same secret as PLATFORM_PROVISION_SECRET, a different trust
 * boundary (that one lets the platform create accounts here; this one
 * only reports headcounts out).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "This CRM instance has no CRON_SECRET configured — the cron route is disabled." }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Invalid cron secret." }, { status: 401 });
  }

  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ skipped: "PLATFORM_API_URL not set — not running under the Alpha platform." });
  }

  const results = await reportAllOrgsUsage(
    adminDb(), apiUrl, process.env.PLATFORM_TENANT_API_KEY, process.env.PLATFORM_REPORT_COUNT_ONLY === "1",
  );
  return NextResponse.json({ orgs: results });
}

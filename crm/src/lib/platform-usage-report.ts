import type { Firestore } from "firebase-admin/firestore";

/**
 * Shared by scripts/report-usage.ts (manual/cron-invoked script) and
 * src/app/api/cron/report-usage/route.ts (HTTP-triggerable equivalent for
 * a serverless deploy) — see either file's own comment for the full
 * rationale. Kept framework-free (just the Admin SDK's Firestore type +
 * fetch) so both call sites can use it without pulling in Next.js.
 */

export interface EmployeeReport {
  external_uid: string;
  active: boolean;
}

export interface OrgReportResult {
  orgLabel: string;
  reportedUsers: number;
  activeUsers: number;
  mode: "count_only" | "prorated";
}

async function reportOrg(
  apiUrl: string,
  apiKey: string,
  orgLabel: string,
  employees: EmployeeReport[],
  countOnly: boolean,
): Promise<OrgReportResult> {
  if (countOnly) {
    const activeUsers = employees.filter((e) => e.active).length;
    const res = await fetch(`${apiUrl}/usage/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Api-Key": apiKey },
      body: JSON.stringify({ employee_count: activeUsers }),
    });
    if (!res.ok) throw new Error(`Platform rejected usage report for ${orgLabel} (${res.status}): ${await res.text()}`);
    return { orgLabel, reportedUsers: activeUsers, activeUsers, mode: "count_only" };
  }

  const res = await fetch(`${apiUrl}/usage/employees`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Api-Key": apiKey },
    body: JSON.stringify({ employees }),
  });
  if (!res.ok) throw new Error(`Platform rejected employee report for ${orgLabel} (${res.status}): ${await res.text()}`);
  const { employee_count: activeUsers } = (await res.json()) as { employee_count: number };
  return { orgLabel, reportedUsers: employees.length, activeUsers, mode: "prorated" };
}

/**
 * Reports every onboarded org's users separately, each under that org's
 * own platform API key — never the whole `users` collection as one blob,
 * since this one CRM deployment can serve many tenants at once (see
 * src/lib/tenant.ts). The one org with no orgId at all (a standalone,
 * non-white-label deploy) uses `defaultOrgApiKey` (this whole instance's
 * PLATFORM_TENANT_API_KEY) instead of a per-org Firestore key. An org
 * with neither is skipped — it isn't onboarded onto the platform.
 */
export async function reportAllOrgsUsage(
  db: Firestore,
  apiUrl: string,
  defaultOrgApiKey: string | undefined,
  countOnly: boolean,
): Promise<OrgReportResult[]> {
  const usersSnap = await db.collection("users").get();
  const byOrg = new Map<string | null, EmployeeReport[]>();
  for (const doc of usersSnap.docs) {
    const orgId = (doc.data().orgId as string | undefined) ?? null;
    const list = byOrg.get(orgId) ?? [];
    list.push({ external_uid: doc.id, active: doc.data().active !== false });
    byOrg.set(orgId, list);
  }

  const keysSnap = await db.collection("organizationPlatformKeys").get();
  const orgKeys = new Map<string, string>();
  for (const doc of keysSnap.docs) {
    const key = doc.data().tenantApiKey as string | undefined;
    if (key) orgKeys.set(doc.id, key);
  }

  const results: OrgReportResult[] = [];
  for (const [orgId, employees] of byOrg) {
    const apiKey = orgId === null ? defaultOrgApiKey : orgKeys.get(orgId);
    if (!apiKey) continue;
    results.push(await reportOrg(apiUrl, apiKey, orgId === null ? "default org" : `org ${orgId}`, employees, countOnly));
  }
  return results;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { getEnabledCategories } from "@/lib/platform-features";

/**
 * The investor-facing /portal (see src/app/portal/layout.tsx) has no
 * signed-in CRM profile to read an orgId claim from — the tenant instead
 * comes from the URL path (app.alpha.com/{slug}/portal/..., see
 * src/middleware.ts). middleware only tags the *rewritten* page request
 * with an x-tenant-slug header, never a plain fetch("/api/platform-
 * features") like this one gets called with (its RESERVED set skips
 * rewriting /api/* entirely) — so that header is never actually present
 * here. The tenant_slug cookie middleware also sets survives across that
 * fetch instead (same fix as api/organizations/branding/route.ts), so
 * read the tenant from there.
 */
export async function GET() {
  const slug = cookies().get("tenant_slug")?.value ?? null;
  let orgId: string | null = null;
  if (slug) {
    const snap = await adminDb().collection("organizations").where("slug", "==", slug).limit(1).get();
    orgId = snap.empty ? null : snap.docs[0].id;
  }
  const categories = await getEnabledCategories(orgId);
  const franchises = categories === null || categories.has("sales");
  return NextResponse.json({ franchises });
}

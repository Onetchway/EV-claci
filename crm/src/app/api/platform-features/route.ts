import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { getEnabledCategories } from "@/lib/platform-features";

/**
 * The investor-facing /portal (see src/app/portal/layout.tsx) has no
 * signed-in CRM profile to read an orgId claim from — the tenant instead
 * comes from the URL path (app.alpha.com/{slug}/portal/..., see
 * src/middleware.ts, which hands the slug down as this header). Resolves
 * that slug to an org, then to whether its "sales" feature category
 * (which the franchise/investor portal falls under) is enabled.
 */
export async function GET() {
  const slug = headers().get("x-tenant-slug");
  let orgId: string | null = null;
  if (slug) {
    const snap = await adminDb().collection("organizations").where("slug", "==", slug).limit(1).get();
    orgId = snap.empty ? null : snap.docs[0].id;
  }
  const categories = await getEnabledCategories(orgId);
  const franchises = categories === null || categories.has("sales");
  return NextResponse.json({ franchises });
}

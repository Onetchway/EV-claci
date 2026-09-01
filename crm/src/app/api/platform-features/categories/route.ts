import { NextResponse } from "next/server";

import { errorResponse, requireCaller } from "@/app/api/_lib/guard";
import { getEnabledCategories } from "@/lib/platform-features";

/**
 * The signed-in user's own org's enabled feature categories (platform/
 * database/schema.sql's feature_catalog.category) — what (app)/layout.tsx
 * filters NAV_GROUPS by. `null` (every category) when this org isn't
 * onboarded onto the platform, or has no key set — see lib/platform-
 * features.ts's fail-open rule.
 */
export async function GET(req: Request) {
  try {
    const caller = await requireCaller(req, "AGENT");
    const categories = await getEnabledCategories(caller.orgId);
    return NextResponse.json({ categories: categories ? [...categories] : null });
  } catch (err) {
    return errorResponse(err);
  }
}

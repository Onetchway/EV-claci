import { NextResponse } from "next/server";

import { errorResponse, requireCaller } from "@/app/api/_lib/guard";
import { getEnabledFeatures } from "@/lib/platform-features";

/**
 * The signed-in user's own org's enabled feature categories and individual
 * feature keys (platform/database/schema.sql's feature_catalog) — what
 * (app)/layout.tsx filters NAV_GROUPS by, at both the group level
 * (category) and the individual-item level (key). `null` for both (every
 * category/key) when this org isn't onboarded onto the platform, or has no
 * key set — see lib/platform-features.ts's fail-open rule.
 */
export async function GET(req: Request) {
  try {
    const caller = await requireCaller(req, "AGENT");
    const features = await getEnabledFeatures(caller.orgId);
    return NextResponse.json({
      categories: features ? [...features.categories] : null,
      keys: features ? [...features.keys] : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

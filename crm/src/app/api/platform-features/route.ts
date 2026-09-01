import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/platform-features";

/**
 * Client components (e.g. the investor-facing portal at src/app/portal/)
 * can't call the server-only platform-features helper directly, so this
 * thin route exposes it. Add more keys here as more of the app needs
 * client-side gating.
 */
export async function GET() {
  const franchises = await isFeatureEnabled("franchises");
  return NextResponse.json({ franchises });
}

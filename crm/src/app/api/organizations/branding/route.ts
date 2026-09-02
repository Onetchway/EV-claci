import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminConfigured, adminDb } from "@/lib/firebase/admin";

/**
 * Public, unauthenticated branding lookup for the sign-in page — before a
 * user is signed in there's no org claim to read yet, only the tenant_slug
 * cookie middleware sets on path-based tenant routes (see src/middleware.ts,
 * src/lib/tenant.ts). Returns just a name/logo, never anything sensitive,
 * and falls back to a generic default when there's no tenant context
 * (single-tenant deploys, or this cookie not set).
 */
export async function GET() {
  const fallback = { name: "CRM", logoUrl: null as string | null };
  const slug = cookies().get("tenant_slug")?.value;
  if (!slug || !adminConfigured()) return NextResponse.json(fallback);

  const snap = await adminDb().collection("organizations").where("slug", "==", slug).limit(1).get();
  if (snap.empty) return NextResponse.json(fallback);

  const org = snap.docs[0].data() as { name?: string; logoUrl?: string };
  return NextResponse.json({ name: org.name || fallback.name, logoUrl: org.logoUrl || null });
}

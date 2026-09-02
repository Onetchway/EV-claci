"use client";

import { usePathname } from "next/navigation";
import { getIdTokenResult } from "firebase/auth";

import { getFirebaseAuth } from "./firebase/client";

// See src/middleware.ts. In path-based tenant mode the browser URL keeps
// its /xpulse prefix even though middleware strips it internally, so
// usePathname() (which reflects the real browser URL, not the rewritten
// one) is how client components recover the current tenant slug.
export function useTenantSlug(): string | null {
  const pathname = usePathname();
  if (process.env.NEXT_PUBLIC_MULTI_TENANT_PATH_MODE !== "1") return null;
  const first = pathname.split("/").filter(Boolean)[0];
  return first || null;
}

// Prefixes an app-relative path ("/leads") with the current tenant slug
// when in path-based tenant mode; returns it unchanged otherwise.
export function tenantHref(path: string, slug: string | null): string {
  if (!slug) return path;
  return `/${slug}${path}`;
}

// The signed-in user's orgId, from their ID token's custom claim (set
// alongside `role` at account creation — see src/app/api/users/route.ts).
// This is what every Firestore query and write actually scopes by; the
// path slug above is only ever used for routing/branding, never trusted
// for data access on its own. Firestore security rules read the same
// claim server-side (firebase/firestore.rules's orgId() function), so a
// client that got this wrong (or lied about it) still can't read or write
// another tenant's documents.
export async function getCurrentTenantId(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  const result = await getIdTokenResult(user);
  return (result.claims.orgId as string | undefined) ?? null;
}

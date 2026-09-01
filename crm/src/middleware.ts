import { NextResponse, type NextRequest } from "next/server";

// Path-based multi-tenancy: app.alpha.com/xpulse/leads instead of a
// separate Firebase project (or even a separate domain) per tenant — see
// src/lib/tenant.ts, which the app reads the slug back out of. Opt-in via
// MULTI_TENANT_PATH_MODE so livantogreen.com's own deploy (a single
// tenant, no prefix) is completely unaffected.
//
// The first path segment is taken as the tenant slug, stripped, and the
// request rewritten internally so every existing route file (src/app/
// (app)/leads/page.tsx etc.) matches unchanged — the browser URL bar
// still shows /xpulse/leads. Auth itself is unaffected: this app's own
// AppLayout already redirects to /login client-side when signed out,
// and Firestore security rules (not this file) are what actually
// separate one tenant's data from another's — see firebase/firestore.rules.
const RESERVED = new Set(["api", "_next", "favicon.ico"]);

export function middleware(req: NextRequest) {
  if (process.env.MULTI_TENANT_PATH_MODE !== "1") return NextResponse.next();

  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0];
  if (!slug || RESERVED.has(slug)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/" + segments.slice(1).join("/");

  const res = NextResponse.rewrite(url);
  res.cookies.set("tenant_slug", slug, { path: "/", sameSite: "lax" });
  res.headers.set("x-tenant-slug", slug);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

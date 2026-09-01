import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

// Auth-gated routes (see the old src/middleware.js this replaces, which
// used next-auth/middleware directly). Checked against the path *after*
// stripping any tenant prefix below, so this list stays app-relative.
const PROTECTED = ['/dashboard', '/stations', '/chargers', '/franchise', '/revenue', '/settlements', '/users'];

const RESERVED = new Set(['api', '_next', 'favicon.ico']);

function isProtected(pathname) {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Path-based multi-tenancy: app.alpha.com/xpulse/dashboard instead of a
  // separate subdomain/domain per tenant. Opt-in via MULTI_TENANT_PATH_MODE
  // so a standalone or subdomain-routed deploy (see backend/src/utils/
  // resolveTenant.js's resolveTenantByHost) is completely unaffected.
  //
  // The first path segment is taken as the tenant slug, stripped, and the
  // request rewritten internally so every existing route file (src/app/
  // (dashboard)/dashboard/page.js etc.) matches unchanged — the browser
  // URL bar still shows /xpulse/dashboard. The slug is also handed to the
  // app as a cookie + request header so server code and client code (see
  // src/lib/tenant.js) can read it without re-parsing the path.
  let slug = null;
  let appPath = pathname;
  if (process.env.MULTI_TENANT_PATH_MODE === '1') {
    const segments = pathname.split('/').filter(Boolean);
    const first = segments[0];
    if (first && !RESERVED.has(first)) {
      slug = first;
      appPath = '/' + segments.slice(1).join('/');
    }
  }

  if (isProtected(appPath)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = slug ? `/${slug}/login` : '/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = appPath;
  const res = NextResponse.rewrite(url);
  res.cookies.set('tenant_slug', slug, { path: '/', sameSite: 'lax' });
  res.headers.set('x-tenant-slug', slug);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

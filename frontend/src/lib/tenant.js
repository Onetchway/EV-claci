'use client';
import { usePathname } from 'next/navigation';

// See middleware.js. In path-based tenant mode the browser URL keeps its
// /xpulse prefix even though middleware strips it internally, so
// usePathname() (which reflects the real browser URL, not the rewritten
// one) is how client components recover the current tenant slug.
export function useTenantSlug() {
  const pathname = usePathname();
  if (process.env.NEXT_PUBLIC_MULTI_TENANT_PATH_MODE !== '1') return null;
  const first = pathname.split('/').filter(Boolean)[0];
  return first || null;
}

// Prefixes an app-relative path ("/dashboard") with the current tenant
// slug when in path-based tenant mode; returns it unchanged otherwise.
export function tenantHref(path, slug) {
  if (!slug) return path;
  return `/${slug}${path}`;
}

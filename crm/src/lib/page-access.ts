/**
 * Centralized view-access policy for the CMS section of the app, enforced
 * once in (app)/layout.tsx rather than scattered per-page. Every CMS page
 * previously only gated its write actions (buttons) via canManage* checks
 * in permissions.ts — any signed-in user, any role, could open the page
 * directly and read the data underneath. This map closes that gap for the
 * pages where "who can see this" actually matters (financial, ops, and
 * customer data), while leaving Sales/Operations/Dashboard pages and
 * anything already self-gated (adminOnly nav items, Settings) alone.
 *
 * SUPER_ADMIN always has access regardless of what's listed — enforced in
 * hasPageAccess() below, not repeated in every entry.
 *
 * Keys are route path prefixes — a viewer needs access to the prefix that
 * matches their current pathname (so /chargers/abc123 inherits /chargers'
 * policy without a separate entry).
 */

import type { Role } from "./constants";

export const PAGE_ACCESS: Record<string, Role[]> = {
  "/cms-dashboard": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  "/chargers": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/stations": ["ADMIN", "OPERATIONS", "SITE_OWNER", "VIEWER"],
  "/sessions": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  "/tickets": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/tariffs": ["ADMIN", "FINANCE", "VIEWER"],
  "/zones": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/earnings": ["ADMIN", "FINANCE", "VIEWER"],
  "/insights": ["ADMIN", "FINANCE", "VIEWER"],
  "/emsp-users": ["ADMIN", "OPERATIONS", "FINANCE", "CUSTOMER_SUPPORT", "VIEWER"],
  "/payments": ["ADMIN", "OPERATIONS", "FINANCE", "CUSTOMER_SUPPORT", "VIEWER"],
  "/fleets": ["ADMIN", "OPERATIONS", "FLEET_MANAGER", "VIEWER"],
  "/invoices": ["ADMIN", "FINANCE", "VIEWER"],
  "/settlements": ["ADMIN", "FINANCE", "SITE_OWNER", "VIEWER"],
  "/coupons": ["ADMIN", "FINANCE", "VIEWER"],
  "/subscriptions": ["ADMIN", "FINANCE", "VIEWER"],
  "/reports": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
};

/** Display names for the matrix on Team & Roles — kept in sync with the CMS nav labels in (app)/layout.tsx. */
export const PAGE_LABEL: Record<string, string> = {
  "/cms-dashboard": "CMS Dashboard",
  "/chargers": "Charger Management",
  "/stations": "Station Management",
  "/sessions": "Sessions",
  "/tickets": "Ticket Management",
  "/tariffs": "Tariffs & Pricing",
  "/zones": "Zones & Load Balancing",
  "/earnings": "Earnings & Statistics",
  "/insights": "Business Insights",
  "/emsp-users": "User Management",
  "/payments": "Payment Transactions",
  "/fleets": "Fleet Management",
  "/invoices": "Invoicing",
  "/settlements": "Settlements",
  "/coupons": "Coupons",
  "/subscriptions": "Subscriptions",
  "/reports": "Reports",
};

/** Longest-matching-prefix lookup — /chargers/abc123 matches the /chargers policy. */
function policyFor(pathname: string): Role[] | null {
  let best: string | null = null;
  for (const prefix of Object.keys(PAGE_ACCESS)) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best.length)) {
      best = prefix;
    }
  }
  return best ? PAGE_ACCESS[best]! : null;
}

export function hasPageAccess(pathname: string, roles: Role[]): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  const allowed = policyFor(pathname);
  if (!allowed) return true; // not policy-controlled — unchanged (existing) behavior
  return roles.some((r) => allowed.includes(r));
}

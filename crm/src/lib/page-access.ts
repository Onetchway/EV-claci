/**
 * Centralized view-access policy, enforced once in (app)/layout.tsx rather
 * than scattered per-page. Every page previously only gated its write
 * actions (buttons) via canManage* checks in permissions.ts — any
 * signed-in user, any role, could open the page directly and read the
 * data underneath.
 *
 * Three layers, checked in order:
 *  1. SUPER_ADMIN always has access to everything.
 *  2. A per-user override (AppUser.pageAccessOverrides, Super-Admin-set from
 *     Team & Roles) — true/false for a specific path wins over the role
 *     default either way.
 *  3. The role policy — DEFAULT_PAGE_ACCESS below, overridable per-path by
 *     a Super Admin via the settings/roleAccessPolicy doc (lib/db/access-policy.ts).
 *     A path with no entry anywhere is open to any signed-in user, gated
 *     only by canManage* on its action buttons (unchanged legacy behavior).
 *
 * Keys are route path prefixes — a viewer needs access to the prefix that
 * matches their current pathname (so /chargers/abc123 inherits /chargers'
 * policy without a separate entry).
 */

import type { Role } from "./constants";

export const DEFAULT_PAGE_ACCESS: Record<string, Role[]> = {
  // Dashboard
  "/dashboard": ["ADMIN", "SALES_MANAGER", "AGENT", "FINANCE", "OPERATIONS", "FLEET_MANAGER", "CUSTOMER_SUPPORT", "SITE_OWNER", "VIEWER"],
  // CMS
  "/cms-dashboard": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  "/chargers": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/stations": ["ADMIN", "OPERATIONS", "SITE_OWNER", "VIEWER"],
  "/sessions": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  "/tickets": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/complaints": ["ADMIN", "OPERATIONS", "CUSTOMER_SUPPORT", "VIEWER"],
  "/tariffs": ["ADMIN", "FINANCE", "VIEWER"],
  "/zones": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/earnings": ["ADMIN", "FINANCE", "VIEWER"],
  "/energy": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  "/insights": ["ADMIN", "FINANCE", "VIEWER"],
  "/emsp-users": ["ADMIN", "OPERATIONS", "FINANCE", "CUSTOMER_SUPPORT", "VIEWER"],
  "/payments": ["ADMIN", "OPERATIONS", "FINANCE", "CUSTOMER_SUPPORT", "VIEWER"],
  "/fleets": ["ADMIN", "OPERATIONS", "FLEET_MANAGER", "VIEWER"],
  "/depot-charging": ["ADMIN", "OPERATIONS", "FLEET_MANAGER", "VIEWER"],
  "/invoices": ["ADMIN", "FINANCE", "VIEWER"],
  "/settlements": ["ADMIN", "FINANCE", "SITE_OWNER", "VIEWER"],
  "/reconciliation": ["ADMIN", "FINANCE", "OPERATIONS"],
  "/coupons": ["ADMIN", "FINANCE", "VIEWER"],
  "/subscriptions": ["ADMIN", "FINANCE", "VIEWER"],
  "/reports": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  // Sales
  "/leads": ["ADMIN", "SALES_MANAGER", "AGENT", "VIEWER"],
  "/loans": ["ADMIN", "SALES_MANAGER", "AGENT", "VIEWER"],
  "/sites": ["ADMIN", "SALES_MANAGER", "AGENT", "VIEWER"],
  "/partners": ["ADMIN", "SALES_MANAGER", "VIEWER"],
  "/quotations": ["ADMIN", "SALES_MANAGER", "VIEWER"],
  "/catalog": ["ADMIN", "SALES_MANAGER", "AGENT", "VIEWER"],
  // Operations
  "/projects": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/vendors": ["ADMIN", "OPERATIONS", "VIEWER"],
  "/purchase-orders": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  "/assets": ["ADMIN", "OPERATIONS", "FINANCE", "VIEWER"],
  // Settings (the adminOnly-flagged nav items — /users, /settings, /logs,
  // /developer, /trash, /ocpi, /organizations — are locked to Admin/Super
  // Admin at the nav level already and deliberately left out of this
  // editable policy so they can't be loosened by mistake)
  "/diagnostics": ["ADMIN", "OPERATIONS", "CUSTOMER_SUPPORT", "VIEWER"],
};

/** Display names for the matrix on Team & Roles — kept in sync with the nav labels in (app)/layout.tsx. */
export const PAGE_LABEL: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cms-dashboard": "CMS Dashboard",
  "/chargers": "Charger Management",
  "/stations": "Station Management",
  "/sessions": "Sessions",
  "/tickets": "Ticket Management",
  "/complaints": "Complaints",
  "/tariffs": "Tariffs & Pricing",
  "/zones": "Zones & Load Balancing",
  "/earnings": "Earnings & Statistics",
  "/energy": "Energy",
  "/insights": "Business Insights",
  "/emsp-users": "User Management",
  "/payments": "Payment Transactions",
  "/fleets": "Fleet Management",
  "/depot-charging": "Depot / Scheduled Charging",
  "/invoices": "Invoicing",
  "/settlements": "Settlements",
  "/reconciliation": "Razorpay Reconciliation",
  "/coupons": "Coupons",
  "/subscriptions": "Subscriptions",
  "/reports": "Reports",
  "/leads": "All Leads",
  "/loans": "Loan Customers",
  "/sites": "Site Enquiries",
  "/partners": "Channel Partners",
  "/quotations": "Create Quotation",
  "/catalog": "Charger Catalogue",
  "/projects": "Project Management",
  "/vendors": "Vendor Management",
  "/purchase-orders": "Purchase Orders",
  "/assets": "Asset Register",
  "/diagnostics": "Diagnostic Knowledge Base",
};

export const PAGE_ACCESS_PATHS = Object.keys(DEFAULT_PAGE_ACCESS);

/** Longest-matching-prefix lookup — /chargers/abc123 matches the /chargers policy. */
function matchPrefix(pathname: string, map: Record<string, unknown>): string | null {
  let best: string | null = null;
  for (const prefix of Object.keys(map)) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best.length)) {
      best = prefix;
    }
  }
  return best;
}

export function hasPageAccess(
  pathname: string,
  roles: Role[],
  opts?: { policyOverrides?: Record<string, Role[]> | null; userOverrides?: Record<string, boolean> | null },
): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;

  if (opts?.userOverrides) {
    const userMatch = matchPrefix(pathname, opts.userOverrides);
    if (userMatch) return opts.userOverrides[userMatch]!;
  }

  const policy = { ...DEFAULT_PAGE_ACCESS, ...(opts?.policyOverrides ?? {}) };
  const match = matchPrefix(pathname, policy);
  if (!match) return true; // not policy-controlled — legacy behavior
  return roles.some((r) => policy[match]!.includes(r));
}

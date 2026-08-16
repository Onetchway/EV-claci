import { ORG_WIDE_ROLES, ROLE_RANK, type Role } from "./constants";
import type { Lead } from "./types";

/**
 * Capability-based access control.
 *
 * A user may hold several roles — a sales manager who also handles finance,
 * say — and their abilities are the union across all of them. Rank still
 * exists, but only for the two things that are genuinely hierarchical:
 * who may grant a role, and who the Firestore rules treat as an admin.
 */

export interface Viewer {
  uid: string;
  /** Primary (highest-ranked) role — what the auth token carries. */
  role: Role;
  /** Every role held. Defaults to `[role]` when absent. */
  roles?: Role[];
}

export function rolesOf(viewer: Viewer): Role[] {
  const list = viewer.roles?.length ? viewer.roles : [viewer.role];
  return list.filter(Boolean);
}

export function hasRole(viewer: Viewer, ...roles: Role[]): boolean {
  const mine = rolesOf(viewer);
  return roles.some((r) => mine.includes(r));
}

/** Highest rank across every role held. */
export function topRank(viewer: Viewer): number {
  return Math.max(...rolesOf(viewer).map((r) => ROLE_RANK[r] ?? 0));
}

export const isAdmin = (role: Role) => ROLE_RANK[role] >= ROLE_RANK.ADMIN;
export const isSuperAdmin = (role: Role) => role === "SUPER_ADMIN";

export const viewerIsAdmin = (viewer: Viewer) => hasRole(viewer, "ADMIN", "SUPER_ADMIN");

/** Agents see only their own book; every other role sees the organisation. */
export function canSeeAllLeads(roleOrViewer: Role | Viewer): boolean {
  if (typeof roleOrViewer === "string") return ORG_WIDE_ROLES.includes(roleOrViewer);
  return rolesOf(roleOrViewer).some((r) => ORG_WIDE_ROLES.includes(r));
}

/** Roles that may create and edit lead records at all. */
const WRITE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "AGENT", "OPERATIONS"];

export const canCreateLead = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);

export function canViewLead(viewer: Viewer, lead: Pick<Lead, "ownerId">): boolean {
  return canSeeAllLeads(viewer) || lead.ownerId === viewer.uid;
}

export function canEditLead(viewer: Viewer, lead: Pick<Lead, "ownerId" | "status">): boolean {
  if (!hasRole(viewer, ...WRITE_ROLES)) return false;
  if (hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER")) return true;
  // An agent works their own leads, but a rejected one is frozen until an
  // admin reopens it — otherwise rejection stats can be quietly rewritten.
  return lead.ownerId === viewer.uid && lead.status !== "REJECTED";
}

export const canReassign = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

/** Only finance and admins confirm money actually landed. */
export const canVerifyPayment = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

export const canDeletePayment = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN", "ADMIN");

export const canVerifyDocument = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE");

export function canDeleteDocument(
  viewer: Viewer,
  doc: { uploadedBy: { uid: string }; status: string },
): boolean {
  if (viewerIsAdmin(viewer)) return true;
  return doc.uploadedBy.uid === viewer.uid && doc.status === "PENDING";
}

export const canManageUsers = (viewer: Viewer) => viewerIsAdmin(viewer);

/** Only a super admin may create or demote another admin. */
export function canAssignRole(viewer: Viewer, target: Role): boolean {
  if (hasRole(viewer, "SUPER_ADMIN")) return true;
  if (!hasRole(viewer, "ADMIN")) return false;
  // An admin may hand out anything below admin, but not admin itself.
  return ROLE_RANK[target] < ROLE_RANK.ADMIN;
}

export const canViewAuditLog = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "FINANCE");

export const canExport = (viewer: Viewer) => canSeeAllLeads(viewer);

/** Changing the money on a quotation is a commercial decision, not a clerical one. */
export const canApplyDiscount = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

export const canOverridePrice = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

export const canReopenLead = (viewer: Viewer) => viewerIsAdmin(viewer);

// ---------------------------------------------------------------------------
// EOI / Letter of Intent
// ---------------------------------------------------------------------------

/** Anyone who can edit the lead can draft the letter. */
export function canDraftEoi(viewer: Viewer, lead: Pick<Lead, "ownerId" | "status">): boolean {
  return canEditLead(viewer, lead);
}

/** Issuing a letter commits the company commercially — a narrower group. */
export const canIssueEoi = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "FINANCE");

export const canEditFinancing = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "FINANCE", "AGENT");

/** Pairing a site enquiry with the investor who will fund it. */
export const canLinkLeads = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

// ---------------------------------------------------------------------------
// Channel partners
// ---------------------------------------------------------------------------

export const canManagePartners = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

/** Approving/paying commission is a money decision, same bar as verifying a payment. */
export const canManageCommissions = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// ---------------------------------------------------------------------------
// Trash — soft delete is reversible, so it's open to admins; permanently
// deleting is not, so it stays super-admin only (matches the Firestore
// delete rule on leads/projects).
// ---------------------------------------------------------------------------

export const canTrash = (viewer: Viewer) => viewerIsAdmin(viewer);
export const canPermanentlyDelete = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN");

// ---------------------------------------------------------------------------
// Charger catalogue — the six DC options are the verified investment model
// and stay code-only; adding a new charger (AC or DC) to the live catalogue
// is a pricing decision, same bar as overriding a unit price.
// ---------------------------------------------------------------------------

export const canManageCatalog = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

// ---------------------------------------------------------------------------
// Procurement & vendors — who Livanto pays to build a station. Operations
// runs this day to day; Finance needs it to reconcile spend; either can
// record a vendor payment, same bar as verifying a lead payment.
// ---------------------------------------------------------------------------

export const canManageVendors = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE");

/** Same bar as vendors — an asset's depreciation schedule is a finance/ops decision. */
export const canManageAssets = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE");

export const canManageChargers = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS");

// Client quotations — the same bar as making a pricing decision
// (canManageCatalog / discount / price-override), since drafting a
// quotation is exactly that.
export const canManageQuotations = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

// Charger fault tickets and RFID allow-listing — same bar as chargers themselves.
export const canManageTickets = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS");
export const canManageRfid = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS");

// Charging-session pricing — a finance/commercial decision, not an ops one.
export const canManageTariffs = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// EMSP (driver-facing) users, corporate accounts, and fleet/vehicle/driver records.
export const canManageEmspUsers = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE");
export const canManageFleets = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS");

export const canManageInvoices = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// Site revenue-share payouts to a host (e.g. an RWA) — money leaving the business, Finance-gated like invoices.
export const canManageSettlements = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// Roaming-partner credentials are sensitive — admin only, no Operations/Finance carve-out.
export const canManageOcpi = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN");

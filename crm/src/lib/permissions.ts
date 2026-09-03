import { expandRole, ORG_WIDE_ROLES, ROLE_RANK, type Role } from "./constants";
import type { Lead, SitePartner } from "./types";

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
  /** HR access to HRMS org-wide without the ADMIN role itself — see AppUser.hrmsAdmin. */
  hrmsAdmin?: boolean;
}

export function rolesOf(viewer: Viewer): Role[] {
  const list = viewer.roles?.length ? viewer.roles : [viewer.role];
  return list.filter(Boolean).flatMap(expandRole);
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

/** Merging moves data between two lead records org-wide — same bar as reassigning ownership. */
export const canMergeLeads = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

/** Same bar as leads — the same team enters site partners and their locations. */
export const canManageSitePartners = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);

export function canViewSitePartner(viewer: Viewer, partner: Pick<SitePartner, "ownerId">): boolean {
  return canSeeAllLeads(viewer) || partner.ownerId === viewer.uid;
}

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

/** Deleting a letter is at least as consequential as issuing one — same bar. */
export const canDeleteEoi = canIssueEoi;

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

/** Narrower than canManageChargers — a Site Owner may submit their own charger for review (Firestore rules enforce it lands inactive/pending), but can't touch the registry otherwise. */
export const canSelfServeRegisterCharger = (viewer: Viewer) =>
  hasRole(viewer, "SITE_OWNER");

// Client quotations — the same bar as making a pricing decision
// (canManageCatalog / discount / price-override), since drafting a
// quotation is exactly that.
export const canManageQuotations = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");

// Proforma invoices — filed under Operations now, but Sales still raises the pricing decision behind one.
export const canManageProformaInvoices = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "OPERATIONS");

// Charger fault tickets and RFID allow-listing — same bar as chargers themselves.
export const canManageTickets = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS");
export const canManageRfid = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS");

// The diagnostic knowledge base is edited by whoever also triages tickets.
export const canManageDiagnostics = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "CUSTOMER_SUPPORT");

// Customer complaints — same bar as Customer Support's other customer-facing work.
export const canManageComplaints = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "CUSTOMER_SUPPORT");

// Charging-session pricing — a finance/commercial decision, not an ops one.
export const canManageTariffs = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// EMSP (driver-facing) users, corporate accounts, and fleet/vehicle/driver records.
export const canManageEmspUsers = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE", "CUSTOMER_SUPPORT");
export const canManageFleets = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "OPERATIONS", "FLEET_MANAGER");

export const canManageInvoices = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// Site revenue-share payouts to a host (e.g. an RWA) — money leaving the business, Finance-gated like invoices.
export const canManageSettlements = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// Roaming-partner credentials are sensitive — admin only, no Operations/Finance carve-out.
export const canManageOcpi = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN");

// ---------------------------------------------------------------------------
// HRMS — attendance, roster, holidays, leave
// ---------------------------------------------------------------------------

/** Managers, HR, and admins: build the weekly roster, mark attendance by hand, and decide leave requests — everyone else only works their own record. A Sales Manager without hrmsAdmin is further scoped to their own direct reports — see canSeeAllHrms. */
export const canManageHrms = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER") || Boolean(viewer.hrmsAdmin);

/** Whether this HRMS manager sees the whole org rather than just their own direct reports (managerId). Admin/Super Admin and anyone flagged HR see everyone; a plain Sales Manager is scoped to their team. */
export const canSeeAllHrms = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN") || Boolean(viewer.hrmsAdmin);

/** Office/geofence config and the leave-type catalogue are org-wide policy — admin only, same bar as OCPI credentials. */
export const canManageHrmsSetup = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN");

// ---------------------------------------------------------------------------
// Payroll — salary data. Deliberately narrower than canManageHrms (which
// includes a plain Sales Manager) and with NO hrmsAdmin-flag carve-out
// (unlike most of the rest of HRMS) — only Super Admin/Admin/Finance may
// see or edit salary structures and payslips, full stop. Exactly mirrors
// canManagePayroll() in firebase/firestore.rules, which enforces the same
// bar at the database level regardless of what this function says.
// ---------------------------------------------------------------------------
export const canManagePayroll = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = [
  "SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "OPERATIONS", "FINANCE",
  "SITE_ENGINEER", "VIEWER",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  OPERATIONS: "Operations",
  FINANCE: "Finance",
  SITE_ENGINEER: "Site Engineer",
  VIEWER: "Viewer",
};

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  SITE_ENGINEER: 1,
  FINANCE: 2,
  OPERATIONS: 2,
  PROJECT_MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

/** A role never implies any other — kept for parity with permission helpers that expect it. */
export function expandRole(r: Role): Role[] {
  return [r];
}

/** Roles that see every client/project, not just the ones they're assigned to. */
export const ORG_WIDE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "OPERATIONS", "FINANCE"];

// ---------------------------------------------------------------------------
// Clients & vendors
// ---------------------------------------------------------------------------

export const CLIENT_TYPES = ["OEM", "CPO", "PRIVATE", "GOVERNMENT", "OTHER"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const VENDOR_CATEGORIES = [
  "ELECTRICAL", "CIVIL", "CABLING", "TRANSFORMER", "HT_WORKS", "EQUIPMENT_SUPPLY", "LOGISTICS", "MANPOWER", "OTHER",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const DEPARTMENTS = [
  "PROJECT_MANAGEMENT", "SITE", "PROCUREMENT", "DESIGN", "FINANCE", "QC_QA", "ADMIN",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const PROJECT_TYPES = [
  "EV_CHARGING_STATION", "HT_CONNECTION", "SOLAR", "SUBSTATION", "BATTERY_SWAP", "OTHER",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = [
  "LEAD", "QUOTATION", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  LEAD: { label: "Lead", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  QUOTATION: { label: "Quotation", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  APPROVED: { label: "Approved", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-brand-50 text-brand-700 ring-brand-200" },
  ON_HOLD: { label: "On Hold", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

// ---------------------------------------------------------------------------
// Quotations / BOQ / PO / PI
// ---------------------------------------------------------------------------

export const QUOTATION_STATUSES = ["DRAFT", "SENT", "NEGOTIATION", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const BOQ_STATUSES = ["DRAFT", "APPROVED", "REVISED"] as const;
export type BoqStatus = (typeof BOQ_STATUSES)[number];

export const BOQ_CATEGORIES = ["HT", "LT", "CIVIL", "MEP", "CHARGER", "OTHER"] as const;
export type BoqCategory = (typeof BOQ_CATEGORIES)[number];

export const PO_STATUSES = ["DRAFT", "ISSUED", "ACKNOWLEDGED", "PARTIALLY_DELIVERED", "COMPLETED", "CANCELLED"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PI_STATUSES = ["DRAFT", "SENT", "PAID", "PARTIALLY_PAID", "CANCELLED"] as const;
export type PiStatus = (typeof PI_STATUSES)[number];

export const PAYMENT_MODES = ["BANK_TRANSFER", "CHEQUE", "UPI", "CASH", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SITE_REPORT_TYPES = ["DAILY", "WEEKLY", "MILESTONE", "ISSUE"] as const;
export type SiteReportType = (typeof SITE_REPORT_TYPES)[number];

export function statusMeta(status: string): { label: string; className: string } {
  return (
    PROJECT_STATUS_META[status as ProjectStatus] ?? {
      label: status.replace(/_/g, " "),
      className: "bg-ink-100 text-ink-700 ring-ink-200",
    }
  );
}

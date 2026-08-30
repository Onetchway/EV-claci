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

export const DEPARTMENT_LABEL: Record<Department, string> = {
  PROJECT_MANAGEMENT: "Project Management",
  SITE: "Site",
  PROCUREMENT: "Procurement",
  DESIGN: "Design",
  FINANCE: "Finance",
  QC_QA: "QC / QA",
  ADMIN: "Admin",
};

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

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const ACTIVITY_ENTITY_TYPES = [
  "CLIENT", "VENDOR", "PROJECT", "QUOTATION", "BOQ", "PURCHASE_ORDER",
  "PROFORMA_INVOICE", "CLIENT_PAYMENT", "VENDOR_PAYMENT", "SITE_REPORT", "TEAM_MEMBER", "USER", "ASSET",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ENTITY_LABEL: Record<ActivityEntityType, string> = {
  CLIENT: "Client",
  VENDOR: "Vendor",
  PROJECT: "Project",
  QUOTATION: "Quotation",
  BOQ: "BOQ",
  PURCHASE_ORDER: "Purchase Order",
  PROFORMA_INVOICE: "Proforma Invoice",
  CLIENT_PAYMENT: "Client Payment",
  VENDOR_PAYMENT: "Vendor Payment",
  SITE_REPORT: "Site Report",
  TEAM_MEMBER: "Team Member",
  USER: "User",
  ASSET: "Asset",
};

export const ACTIVITY_ACTIONS = ["CREATE", "UPDATE", "STATUS_CHANGE", "DELETE"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Asset register — site equipment tracked from procurement through its
// depreciable life. Confirm useful life / method with your CA before relying
// on it for filing; this is an internal management view, not a substitute
// for statutory books.
// ---------------------------------------------------------------------------

export const ASSET_CATEGORIES = [
  "TRANSFORMER", "PANEL_ELECTRICAL", "CABLE_CONDUCTOR", "TOOLS_MACHINERY", "VEHICLE", "IT_EQUIPMENT", "OTHER",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  TRANSFORMER: "Transformer / HT Equipment",
  PANEL_ELECTRICAL: "LT Panel / Electrical",
  CABLE_CONDUCTOR: "Cable / Conductor",
  TOOLS_MACHINERY: "Tools & Machinery",
  VEHICLE: "Vehicle",
  IT_EQUIPMENT: "IT Equipment",
  OTHER: "Other",
};

export const ASSET_STATUSES = ["IN_SERVICE", "UNDER_MAINTENANCE", "DECOMMISSIONED", "DISPOSED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  IN_SERVICE: "In service",
  UNDER_MAINTENANCE: "Under maintenance",
  DECOMMISSIONED: "Decommissioned",
  DISPOSED: "Disposed",
};

export const ASSET_STATUS_COLOR: Record<AssetStatus, string> = {
  IN_SERVICE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  UNDER_MAINTENANCE: "bg-amber-50 text-amber-700 ring-amber-200",
  DECOMMISSIONED: "bg-ink-100 text-ink-600 ring-ink-200",
  DISPOSED: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** Straight-line: equal expense every year. WDV: a fixed % of the *remaining* book value every year (the method Indian tax law generally expects for plant & machinery). */
export const DEPRECIATION_METHODS = ["STRAIGHT_LINE", "WDV"] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

export const DEPRECIATION_METHOD_LABEL: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE: "Straight-line",
  WDV: "Written Down Value (WDV)",
};

// ---------------------------------------------------------------------------
// HRMS — attendance & roster
// ---------------------------------------------------------------------------

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "WEEK_OFF", "HOLIDAY"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  ON_LEAVE: "On leave",
  WEEK_OFF: "Week off",
  HOLIDAY: "Holiday",
};

export const ATTENDANCE_STATUS_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ABSENT: "bg-rose-50 text-rose-700 ring-rose-200",
  HALF_DAY: "bg-amber-50 text-amber-700 ring-amber-200",
  ON_LEAVE: "bg-violet-50 text-violet-700 ring-violet-200",
  WEEK_OFF: "bg-ink-100 text-ink-600 ring-ink-200",
  HOLIDAY: "bg-sky-50 text-sky-700 ring-sky-200",
};

// ---------------------------------------------------------------------------
// Company details — used on the printed letterhead for PI/PO/Quotation/BOQ
// ---------------------------------------------------------------------------

export const COMPANY_INFO = {
  name: "NAKJM INFRASTRUCTURE PRIVATE LIMITED",
  gstin: "07AALCN2650H1ZE",
  cin: "U41001DL2026PTC462479",
  email: "connect@nakjminfra.com",
  website: "www.nakjminfra.com",
  registeredAddress:
    "Ground Floor, Plot No. 5-A, KH No. 44/17 & 14, Chhawla Extn, New Delhi, South West Delhi, Delhi 110071, India",
  officeAddress:
    "CoWynd Managed Office, First Floor, Plot 103, Dwarka Sector 19, New Delhi, Delhi 110075, India",
};

export function statusMeta(status: string): { label: string; className: string } {
  return (
    PROJECT_STATUS_META[status as ProjectStatus] ?? {
      label: status.replace(/_/g, " "),
      className: "bg-ink-100 text-ink-700 ring-ink-200",
    }
  );
}

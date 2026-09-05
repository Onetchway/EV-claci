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

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "TEMPORARY"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  TEMPORARY: "Temporary",
};

export const ROLL_STATUSES = ["ON_ROLL", "OFF_ROLL"] as const;
export type RollStatus = (typeof ROLL_STATUSES)[number];

export const ROLL_STATUS_LABEL: Record<RollStatus, string> = {
  ON_ROLL: "On roll",
  OFF_ROLL: "Off roll",
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
// Tenders — government/institutional tender tracking, upstream of BOQ and
// Quotations in the Client → Tender → BOQ → Quotation → PO/WO → Project chain.
// ---------------------------------------------------------------------------

export const TENDER_STATUSES = [
  "DRAFT", "PREPARING", "SUBMITTED", "TECHNICAL_QUALIFIED", "FINANCIAL_BID", "AWARDED", "LOST", "CANCELLED",
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const TENDER_STATUS_META: Record<TenderStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  PREPARING: { label: "Preparing", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  SUBMITTED: { label: "Submitted", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  TECHNICAL_QUALIFIED: { label: "Technical Qualified", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  FINANCIAL_BID: { label: "Financial Bid", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  AWARDED: { label: "Awarded", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  LOST: { label: "Lost", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  CANCELLED: { label: "Cancelled", className: "bg-ink-100 text-ink-500 ring-ink-200" },
};

// ---------------------------------------------------------------------------
// RFQs — a client's direct Request for Quotation, upstream of the priced
// Quotation itself (distinct from a Tender, which is a public/institutional
// bid process).
// ---------------------------------------------------------------------------

export const RFQ_STATUSES = ["OPEN", "QUOTED", "CLOSED", "LOST"] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const RFQ_STATUS_META: Record<RfqStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  QUOTED: { label: "Quoted", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  CLOSED: { label: "Closed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  LOST: { label: "Lost", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

// ---------------------------------------------------------------------------
// Site Visit — an engineer (or several) dispatched to a client's project
// site to inspect/survey before or during execution, distinct from a
// recurring SiteReport (progress update on work already underway).
// ---------------------------------------------------------------------------

export const SITE_VISIT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type SiteVisitStatus = (typeof SITE_VISIT_STATUSES)[number];

export const SITE_VISIT_STATUS_META: Record<SiteVisitStatus, { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

// ---------------------------------------------------------------------------
// Sub-vendor contracts (work subcontracted out to a vendor, with its own stages/payment schedule)
// ---------------------------------------------------------------------------

export const SUB_VENDOR_CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "DELAYED", "COMPLETED", "TERMINATED"] as const;
export type SubVendorContractStatus = (typeof SUB_VENDOR_CONTRACT_STATUSES)[number];

export const SUB_VENDOR_CONTRACT_STATUS_META: Record<SubVendorContractStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  ACTIVE: { label: "Active", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  DELAYED: { label: "Delayed", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  TERMINATED: { label: "Terminated", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const SUB_VENDOR_PAYMENT_STATUSES = ["PENDING", "INVOICED", "PAID"] as const;
export type SubVendorPaymentStatus = (typeof SUB_VENDOR_PAYMENT_STATUSES)[number];

export const SUB_VENDOR_PAYMENT_STATUS_META: Record<SubVendorPaymentStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  INVOICED: { label: "Invoiced", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  PAID: { label: "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

// ---------------------------------------------------------------------------
// Employee expenses & reimbursement
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES = ["TRAVEL_BIKE", "TRAVEL_CAR", "OTHER_TRAVEL", "HOTEL", "DAILY_ALLOWANCE", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  TRAVEL_BIKE: "Travel — Bike", TRAVEL_CAR: "Travel — Car", OTHER_TRAVEL: "Other Travel",
  HOTEL: "Hotel", DAILY_ALLOWANCE: "Daily Allowance", OTHER: "Other",
};

/** These two categories take a distance (km) and auto-compute the amount from Settings -> Expense policy; every other category is a direct amount entry. */
export const DISTANCE_BASED_EXPENSE_CATEGORIES: ExpenseCategory[] = ["TRAVEL_BIKE", "TRAVEL_CAR"];

export const EXPENSE_REPORT_STATUSES = ["DRAFT", "SUBMITTED", "MANAGER_APPROVED", "FINANCE_APPROVED", "REJECTED", "PAID"] as const;
export type ExpenseReportStatus = (typeof EXPENSE_REPORT_STATUSES)[number];

export const EXPENSE_REPORT_STATUS_META: Record<ExpenseReportStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  SUBMITTED: { label: "Pending Manager", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  MANAGER_APPROVED: { label: "Pending Finance", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  FINANCE_APPROVED: { label: "Approved", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  PAID: { label: "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
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

export const BOQ_CATEGORY_LABEL: Record<BoqCategory, string> = {
  HT: "HT Works", LT: "LT Works", CIVIL: "Civil Work", MEP: "MEP", CHARGER: "Charger Installation", OTHER: "Other Works",
};

export const PO_STATUSES = ["DRAFT", "ISSUED", "ACKNOWLEDGED", "PARTIALLY_DELIVERED", "COMPLETED", "CANCELLED"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PI_STATUSES = ["DRAFT", "SENT", "PAID", "PARTIALLY_PAID", "CANCELLED"] as const;
export type PiStatus = (typeof PI_STATUSES)[number];

/** Same total tax, different printed breakdown: IGST (inter-state) or CGST+SGST (intra-state). */
export const GST_TYPES = ["IGST", "CGST_SGST"] as const;
export type GstType = (typeof GST_TYPES)[number];
export const GST_TYPE_LABEL: Record<GstType, string> = { IGST: "IGST", CGST_SGST: "CGST & SGST" };

/** Standard GST state codes -- the first two digits of every Indian GSTIN. */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh (Old)",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh",
};

/** Reads the state straight off a GSTIN's first two digits, the authoritative source -- never a free-text field that can drift from it. */
export function gstStateFromGstin(gstin: string): string {
  return GST_STATE_CODES[gstin.trim().slice(0, 2)] ?? "";
}

/** IGST if the two GSTINs' state codes differ, CGST+SGST if they match -- the actual place-of-supply rule, not a manual guess. */
export function gstTypeForCounterparty(homeGstin: string, counterpartyGstin: string | null | undefined): GstType {
  if (!counterpartyGstin) return "IGST";
  return homeGstin.trim().slice(0, 2) === counterpartyGstin.trim().slice(0, 2) ? "CGST_SGST" : "IGST";
}

/**
 * The client GSTIN that actually applies to a project: a live match against the client's
 * state-wise registrations for the project's own site state, so it always tracks state edits
 * without needing the project's stored billingGstin to be manually re-synced. Falls back to
 * billingGstin (set at project creation) and then the client's single default GSTIN.
 */
export function billedGstinForProject(
  client: { gstin?: string; gstRegistrations?: { gstin: string; state: string }[] } | null | undefined,
  project: { site?: { state?: string }; billingGstin?: string | null } | null | undefined,
): string | undefined {
  const stateMatch = client?.gstRegistrations?.find((r) => r.state === project?.site?.state)?.gstin;
  return stateMatch || project?.billingGstin || client?.gstin || undefined;
}

/** Every Indian state/UT name, alphabetical, for a "State" dropdown -- the same list GST registration is drawn from, minus the old pre-bifurcation Andhra Pradesh code. */
export const INDIAN_STATES = Object.values(GST_STATE_CODES)
  .filter((s) => s !== "Andhra Pradesh (Old)")
  .sort((a, b) => a.localeCompare(b));

export const PAYMENT_MODES = ["BANK_TRANSFER", "CHEQUE", "UPI", "CASH", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SITE_REPORT_TYPES = ["DAILY", "WEEKLY", "MILESTONE", "ISSUE"] as const;
export type SiteReportType = (typeof SITE_REPORT_TYPES)[number];

// ---------------------------------------------------------------------------
// Project execution — stages (delivery workstreams) and tasks within them.
// ---------------------------------------------------------------------------

export const STAGE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DELAYED", "BLOCKED", "COMPLETED"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const STAGE_STATUS_META: Record<StageStatus, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-brand-50 text-brand-700 ring-brand-200" },
  DELAYED: { label: "Delayed", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  BLOCKED: { label: "Blocked", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

/**
 * Default stage sequence per project type — used to bulk-generate a
 * project's Stages instead of adding them one at a time. Not user-editable
 * yet (a full admin-configurable template system is a larger follow-up);
 * for now this lives in code, mirroring the brief's example templates.
 */
/**
 * EV_CHARGING_STATION's sequence follows V-Green's Setup Playbook (v1.2) section-by-section --
 * each stage name maps to one of its numbered sections, so stage progress lines up with the
 * playbook's own document checklist and payment-milestone structure (30% Appendix Signing / 10%
 * Civil / 30% Construction Handover / 25% Go-Live / 5% Warranty).
 */
export const STAGE_TEMPLATES: Record<ProjectType, string[]> = {
  EV_CHARGING_STATION: [
    "Site Survey", "Appendix Signing & BOQ Approval", "DISCOM Application",
    "Site Layout & Electrical Drawing Approval", "Civil Work", "ACDB Installation & Electrical Work",
    "EVCS Delivery & Installation", "Electrical Testing & Pre-Energization",
    "Final Energization & Commissioning (Go-Live)", "HOTO & Final Handover",
  ],
  SOLAR: ["Site Survey", "Design", "Approval", "Civil Work", "Structure Installation", "Module Installation", "Electrical Installation", "Testing", "Commissioning", "Handover"],
  HT_CONNECTION: ["Site Survey", "Design", "HT Line Work", "Substation Work", "Testing", "Commissioning", "Handover"],
  SUBSTATION: ["Site Survey", "Design", "Civil Work", "Equipment Installation", "Testing", "Commissioning", "Handover"],
  BATTERY_SWAP: ["Site Survey", "Civil Work", "Electrical Work", "Installation", "Testing", "Commissioning", "Handover"],
  OTHER: ["Site Survey", "Design", "Execution", "Testing", "Handover"],
};

export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-brand-50 text-brand-700 ring-brand-200" },
  BLOCKED: { label: "Blocked", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  DONE: { label: "Done", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

// ---------------------------------------------------------------------------
// Documents — central repository, categorised, per the brief's Document
// Management module. CLIENT_PO / WORK_ORDER / BOQ_UPLOAD / QUOTATION_UPLOAD
// are the categories the app itself writes when a PO/BOQ/quotation source
// file is attached; the rest are user-driven uploads on a project.
// ---------------------------------------------------------------------------

export const DOCUMENT_CATEGORIES = [
  "CLIENT_PO", "WORK_ORDER", "TENDER", "BOQ_UPLOAD", "QUOTATION_UPLOAD", "PO_UPLOAD", "DRAWING", "TECHNICAL",
  "APPROVAL", "DPR", "MEASUREMENT", "PHOTO", "INSPECTION", "SITE_SURVEY", "TEST_REPORT", "HOTO", "COMPLETION",
  "SITE_VISIT_REPORT", "OTHER",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  CLIENT_PO: "Client PO", WORK_ORDER: "Work Order", TENDER: "Tender Document", BOQ_UPLOAD: "BOQ",
  QUOTATION_UPLOAD: "Quotation", PO_UPLOAD: "Purchase Order", DRAWING: "Drawing", TECHNICAL: "Technical Document", APPROVAL: "Approval",
  DPR: "DPR", MEASUREMENT: "Measurement", PHOTO: "Photo", INSPECTION: "Inspection Report",
  SITE_SURVEY: "Site Survey Report", TEST_REPORT: "Test Report (Earthing/Voltage/IR/Continuity)", HOTO: "HOTO Checklist/Photos",
  COMPLETION: "Completion Document", SITE_VISIT_REPORT: "Site Visit Report/Photos", OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Issues — lightweight site issue tracker, scoped to a project/stage.
// ---------------------------------------------------------------------------

export const ISSUE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_PRIORITY_META: Record<IssuePriority, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  MEDIUM: { label: "Medium", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  HIGH: { label: "High", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  CRITICAL: { label: "Critical", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const ISSUE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_META: Record<IssueStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-brand-50 text-brand-700 ring-brand-200" },
  RESOLVED: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CLOSED: { label: "Closed", className: "bg-ink-100 text-ink-500 ring-ink-200" },
};

// ---------------------------------------------------------------------------
// RFI — Request for Information, a lightweight clarification thread.
// ---------------------------------------------------------------------------

export const RFI_STATUSES = ["OPEN", "ASSIGNED", "RESPONSE_REQUIRED", "CLARIFIED", "CLOSED"] as const;
export type RfiStatus = (typeof RFI_STATUSES)[number];

export const RFI_STATUS_META: Record<RfiStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  ASSIGNED: { label: "Assigned", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  RESPONSE_REQUIRED: { label: "Response Required", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  CLARIFIED: { label: "Clarified", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CLOSED: { label: "Closed", className: "bg-ink-100 text-ink-500 ring-ink-200" },
};

// ---------------------------------------------------------------------------
// Quality — lightweight inspections + NCRs. Not a full QMS per the brief.
// ---------------------------------------------------------------------------

export const INSPECTION_RESULTS = ["PASS", "FAIL", "PASS_WITH_OBSERVATIONS"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const NCR_STATUSES = ["OPEN", "CORRECTIVE_ACTION", "CLOSED"] as const;
export type NcrStatus = (typeof NCR_STATUSES)[number];

export const NCR_STATUS_META: Record<NcrStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  CORRECTIVE_ACTION: { label: "Corrective Action", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  CLOSED: { label: "Closed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

// ---------------------------------------------------------------------------
// Drawings — revision-controlled drawing register. Each upload is a new
// revision under the same drawing number; previous revisions are never
// deleted, only superseded.
// ---------------------------------------------------------------------------

export const DRAWING_DISCIPLINES = ["ARCHITECTURAL", "STRUCTURAL", "CIVIL", "ELECTRICAL", "MEP", "SOLAR", "OTHER"] as const;
export type DrawingDiscipline = (typeof DRAWING_DISCIPLINES)[number];

export const DRAWING_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "SUPERSEDED"] as const;
export type DrawingStatus = (typeof DRAWING_STATUSES)[number];

export const DRAWING_STATUS_META: Record<DrawingStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  SUPERSEDED: { label: "Superseded", className: "bg-ink-100 text-ink-500 ring-ink-200" },
};

// ---------------------------------------------------------------------------
// Punch list + Handover — project close-out.
// ---------------------------------------------------------------------------

export const PUNCH_ITEM_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED"] as const;
export type PunchItemStatus = (typeof PUNCH_ITEM_STATUSES)[number];

export const PUNCH_ITEM_STATUS_META: Record<PunchItemStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-brand-50 text-brand-700 ring-brand-200" },
  RESOLVED: { label: "Resolved", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  ACCEPTED: { label: "Accepted", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

/** Execution Complete -> Internal Inspection -> Punch List -> Punch List Closure -> Client Inspection -> Handover -> Completed. */
export const HANDOVER_STAGES = [
  "EXECUTION_COMPLETE", "INTERNAL_INSPECTION", "PUNCH_LIST", "PUNCH_LIST_CLOSURE",
  "CLIENT_INSPECTION", "HANDED_OVER", "COMPLETED",
] as const;
export type HandoverStage = (typeof HANDOVER_STAGES)[number];

export const HANDOVER_STAGE_LABEL: Record<HandoverStage, string> = {
  EXECUTION_COMPLETE: "Execution Complete",
  INTERNAL_INSPECTION: "Internal Inspection",
  PUNCH_LIST: "Punch List",
  PUNCH_LIST_CLOSURE: "Punch List Closure",
  CLIENT_INSPECTION: "Client Inspection",
  HANDED_OVER: "Handed Over",
  COMPLETED: "Completed",
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const ACTIVITY_ENTITY_TYPES = [
  "CLIENT", "VENDOR", "PROJECT", "TENDER", "RFQ", "QUOTATION", "BOQ", "PURCHASE_ORDER",
  "PROFORMA_INVOICE", "CLIENT_PAYMENT", "VENDOR_PAYMENT", "SITE_REPORT", "SITE_VISIT", "SUB_VENDOR_CONTRACT",
  "TEAM_MEMBER", "USER", "ASSET",
  "STAGE", "TASK", "ISSUE", "MEASUREMENT", "DOCUMENT", "RFI", "INSPECTION", "NCR", "DRAWING",
  "PUNCH_ITEM", "HANDOVER", "LEAVE_REQUEST", "EXPENSE_REPORT",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ENTITY_LABEL: Record<ActivityEntityType, string> = {
  CLIENT: "Client",
  VENDOR: "Vendor",
  PROJECT: "Project",
  TENDER: "Tender",
  RFQ: "RFQ",
  QUOTATION: "Quotation",
  BOQ: "BOQ",
  PURCHASE_ORDER: "Purchase Order",
  PROFORMA_INVOICE: "Proforma Invoice",
  CLIENT_PAYMENT: "Client Payment",
  VENDOR_PAYMENT: "Vendor Payment",
  SITE_REPORT: "Site Report",
  SITE_VISIT: "Site Visit",
  SUB_VENDOR_CONTRACT: "Sub-Vendor Contract",
  TEAM_MEMBER: "Team Member",
  USER: "User",
  ASSET: "Asset",
  STAGE: "Stage",
  TASK: "Task",
  ISSUE: "Issue",
  MEASUREMENT: "Measurement",
  DOCUMENT: "Document",
  RFI: "RFI",
  INSPECTION: "Inspection",
  NCR: "NCR",
  DRAWING: "Drawing",
  PUNCH_ITEM: "Punch Item",
  HANDOVER: "Handover",
  LEAVE_REQUEST: "Leave Request",
  EXPENSE_REPORT: "Expense Report",
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

export const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  CASUAL: "Casual leave",
  SICK: "Sick leave",
  EARNED: "Earned leave",
  UNPAID: "Unpaid leave",
};

export const LEAVE_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const LEAVE_REQUEST_STATUS_META: Record<LeaveRequestStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  CANCELLED: { label: "Cancelled", className: "bg-ink-100 text-ink-600 ring-ink-200" },
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

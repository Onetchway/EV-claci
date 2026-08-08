/** Shared vocabulary for the CRM. Everything selectable in the UI lives here. */

export const ROLES = ["SUPER_ADMIN", "ADMIN", "AGENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  AGENT: "Agent",
};

/** Higher number = more authority. Used for every permission check. */
export const ROLE_RANK: Record<Role, number> = {
  AGENT: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const STAGES = [
  "NEW",
  "CONTACTED",
  "INTRODUCTION",
  "EOI",
  "AGREEMENT",
  "COMMISSIONING",
  "HANDOVER",
] as const;
export type Stage = (typeof STAGES)[number];

export interface StageMeta {
  key: Stage;
  label: string;
  short: string;
  /** Default probability used for weighted pipeline value. */
  probability: number;
  hint: string;
  color: string;
  dot: string;
}

export const STAGE_META: Record<Stage, StageMeta> = {
  NEW: {
    key: "NEW", label: "New Lead", short: "New", probability: 0.05,
    hint: "Captured from a source, not yet worked.",
    color: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400",
  },
  CONTACTED: {
    key: "CONTACTED", label: "Contacted", short: "Contacted", probability: 0.15,
    hint: "First call/message done, awaiting a real conversation.",
    color: "bg-sky-100 text-sky-800 ring-sky-200", dot: "bg-sky-500",
  },
  INTRODUCTION: {
    key: "INTRODUCTION", label: "Introduction", short: "Intro", probability: 0.3,
    hint: "Business model and investment deck presented.",
    color: "bg-indigo-100 text-indigo-800 ring-indigo-200", dot: "bg-indigo-500",
  },
  EOI: {
    key: "EOI", label: "Expression of Interest", short: "EOI", probability: 0.55,
    hint: "Stage-1 token received, intent confirmed.",
    color: "bg-violet-100 text-violet-800 ring-violet-200", dot: "bg-violet-500",
  },
  AGREEMENT: {
    key: "AGREEMENT", label: "Agreement", short: "Agreement", probability: 0.75,
    hint: "Franchise agreement executed, KYC complete.",
    color: "bg-amber-100 text-amber-800 ring-amber-200", dot: "bg-amber-500",
  },
  COMMISSIONING: {
    key: "COMMISSIONING", label: "Commissioning", short: "Commissioning", probability: 0.9,
    hint: "Civil work, installation and charger energisation in progress.",
    color: "bg-orange-100 text-orange-800 ring-orange-200", dot: "bg-orange-500",
  },
  HANDOVER: {
    key: "HANDOVER", label: "Handover", short: "Handover", probability: 1,
    hint: "Station live and handed over to the franchisee.",
    color: "bg-emerald-100 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500",
  },
};

export const WON_STAGE: Stage = "HANDOVER";

export const LEAD_STATUSES = ["ACTIVE", "WON", "REJECTED", "ON_HOLD"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  ACTIVE: "Active",
  WON: "Won / Closed",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
};

export const STATUS_COLOR: Record<LeadStatus, string> = {
  ACTIVE: "bg-sky-100 text-sky-800 ring-sky-200",
  WON: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
  ON_HOLD: "bg-slate-100 text-slate-700 ring-slate-200",
};

// ---------------------------------------------------------------------------
// Lead type & sources
// ---------------------------------------------------------------------------

export const LEAD_TYPES = ["FRANCHISE", "SITE"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  FRANCHISE: "Franchise Investor",
  SITE: "Site / Location Partner",
};

export const SOURCES = [
  "LINKEDIN",
  "INSTAGRAM",
  "META_ADS",
  "NEWSPAPER",
  "DIRECT_CALL",
  "REFERRAL",
  "CHANNEL_PARTNER",
  "WEBSITE",
  "WALK_IN",
  "EXHIBITION",
  "WHATSAPP",
  "OTHER",
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  META_ADS: "Meta Ads",
  NEWSPAPER: "Newspaper",
  DIRECT_CALL: "Direct Call",
  REFERRAL: "Referral",
  CHANNEL_PARTNER: "Channel Partner",
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  EXHIBITION: "Exhibition / Event",
  WHATSAPP: "WhatsApp",
  OTHER: "Other",
};

export const REJECTION_REASONS = [
  "BUDGET_CONSTRAINT",
  "SITE_NOT_VIABLE",
  "POWER_UNAVAILABLE",
  "CHOSE_COMPETITOR",
  "NOT_INTERESTED",
  "UNREACHABLE",
  "DUPLICATE",
  "FAKE_OR_SPAM",
  "TIMELINE_MISMATCH",
  "OTHER",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_LABEL: Record<RejectionReason, string> = {
  BUDGET_CONSTRAINT: "Budget constraint",
  SITE_NOT_VIABLE: "Site not viable",
  POWER_UNAVAILABLE: "Power / load unavailable",
  CHOSE_COMPETITOR: "Went with a competitor",
  NOT_INTERESTED: "Not interested",
  UNREACHABLE: "Unreachable / no response",
  DUPLICATE: "Duplicate lead",
  FAKE_OR_SPAM: "Fake or spam",
  TIMELINE_MISMATCH: "Timeline mismatch",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Site / location leads
// ---------------------------------------------------------------------------

export const LOCATION_TYPES = [
  "HIGHWAY",
  "RING_ROAD",
  "HOTEL",
  "RESTAURANT",
  "MALL",
  "FUEL_PUMP",
  "PARKING_LOT",
  "OFFICE_COMPLEX",
  "RESIDENTIAL_SOCIETY",
  "HOSPITAL",
  "SHOWROOM",
  "INDUSTRIAL",
  "BUS_DEPOT",
  "OTHER",
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  HIGHWAY: "Highway",
  RING_ROAD: "Ring Road",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant / Dhaba",
  MALL: "Mall / Retail",
  FUEL_PUMP: "Fuel Pump",
  PARKING_LOT: "Parking Lot",
  OFFICE_COMPLEX: "Office Complex",
  RESIDENTIAL_SOCIETY: "Residential Society",
  HOSPITAL: "Hospital",
  SHOWROOM: "Showroom",
  INDUSTRIAL: "Industrial Area",
  BUS_DEPOT: "Bus / Truck Depot",
  OTHER: "Other",
};

export const OWNERSHIP_TYPES = ["OWNED", "RENTED", "LEASED", "PARTNERSHIP"] as const;
export type Ownership = (typeof OWNERSHIP_TYPES)[number];

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  OWNED: "Owned",
  RENTED: "Rented",
  LEASED: "Leased",
  PARTNERSHIP: "Partnership / JV",
};

export const POWER_LOADS = ["NONE", "SINGLE_PHASE", "THREE_PHASE", "HT_LINE"] as const;
export type PowerLoad = (typeof POWER_LOADS)[number];

export const POWER_LOAD_LABEL: Record<PowerLoad, string> = {
  NONE: "Not available",
  SINGLE_PHASE: "1-Phase",
  THREE_PHASE: "3-Phase",
  HT_LINE: "HT Line / Dedicated Transformer",
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const DOC_KINDS = [
  "AADHAAR",
  "PAN",
  "GST_CERTIFICATE",
  "CANCELLED_CHEQUE",
  "PHOTOGRAPH",
  "ELECTRICITY_BILL",
  "LOAD_SANCTION",
  "PROPERTY_PROOF",
  "LEASE_AGREEMENT",
  "SITE_PHOTO",
  "FRANCHISE_AGREEMENT",
  "EOI_FORM",
  "PAYMENT_RECEIPT",
  "OTHER",
] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  AADHAAR: "Aadhaar Card",
  PAN: "PAN Card",
  GST_CERTIFICATE: "GST Certificate",
  CANCELLED_CHEQUE: "Cancelled Cheque",
  PHOTOGRAPH: "Passport Photograph",
  ELECTRICITY_BILL: "Electricity Bill",
  LOAD_SANCTION: "Load Sanction Letter",
  PROPERTY_PROOF: "Property Ownership Proof",
  LEASE_AGREEMENT: "Lease / Rent Agreement",
  SITE_PHOTO: "Site Photograph",
  FRANCHISE_AGREEMENT: "Franchise Agreement",
  EOI_FORM: "Signed EOI Form",
  PAYMENT_RECEIPT: "Payment Receipt",
  OTHER: "Other Document",
};

/** Documents a franchise lead must have on file before Agreement stage. */
export const REQUIRED_DOCS_FRANCHISE: DocKind[] = [
  "AADHAAR",
  "PAN",
  "CANCELLED_CHEQUE",
  "PHOTOGRAPH",
];

/** Documents a site lead must have on file before Agreement stage. */
export const REQUIRED_DOCS_SITE: DocKind[] = [
  "AADHAAR",
  "PROPERTY_PROOF",
  "ELECTRICITY_BILL",
  "SITE_PHOTO",
];

export const DOC_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const PAYMENT_MILESTONES = ["EOI", "INFRA", "COMMISSIONING", "OTHER"] as const;
export type PaymentMilestone = (typeof PAYMENT_MILESTONES)[number];

export const MILESTONE_LABEL: Record<PaymentMilestone, string> = {
  EOI: "Stage 1 — Expression of Interest",
  INFRA: "Stage 2 — Infrastructure Initiation",
  COMMISSIONING: "Stage 3 — Installation & Commissioning",
  OTHER: "Other / Ad-hoc",
};

export const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CASH", "DD", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_STATUSES = ["PENDING", "RECEIVED", "VERIFIED", "BOUNCED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 ring-slate-200",
  RECEIVED: "bg-sky-100 text-sky-800 ring-sky-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  BOUNCED: "bg-rose-100 text-rose-800 ring-rose-200",
  REFUNDED: "bg-amber-100 text-amber-800 ring-amber-200",
};

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export const ACTIVITY_TYPES = [
  "CREATED",
  "UPDATED",
  "STAGE_CHANGED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "CONFIG_CHANGED",
  "NOTE",
  "CALL",
  "MEETING",
  "PAYMENT_ADDED",
  "PAYMENT_UPDATED",
  "PAYMENT_DELETED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VERIFIED",
  "DOCUMENT_DELETED",
  "REJECTED",
  "REOPENED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

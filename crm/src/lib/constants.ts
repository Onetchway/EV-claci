/** Shared vocabulary for the CRM. Everything selectable in the UI lives here. */

export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES_MANAGER",
  "AGENT",
  "FINANCE",
  "OPERATIONS",
  "FLEET_MANAGER",
  "CUSTOMER_SUPPORT",
  "SITE_OWNER",
  "VIEWER",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SALES_MANAGER: "Sales Manager",
  AGENT: "Agent",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  FLEET_MANAGER: "Fleet Manager",
  CUSTOMER_SUPPORT: "Customer Support",
  SITE_OWNER: "Site Owner",
  VIEWER: "Viewer",
};

export const ROLE_HINT: Record<Role, string> = {
  SUPER_ADMIN: "Everything, including creating other admins.",
  ADMIN: "Every lead, verify payments and documents, all reports.",
  SALES_MANAGER: "Every lead and report; can reassign, but cannot verify money.",
  AGENT: "Only their own leads.",
  FINANCE: "Every lead read-only, plus payment verification and EOI issue.",
  OPERATIONS: "Every lead read-only, plus document verification and stage moves.",
  FLEET_MANAGER: "Manages fleets, vehicles and drivers, and their EMSP users — an internal staff role standing in for a corporate/fleet customer, not an external self-service login.",
  CUSTOMER_SUPPORT: "Assists EMSP users and corporate accounts (wallet, RFID, subscriptions) — no charger, tariff, or financial-settlement access.",
  SITE_OWNER: "Read-only view of Station Management and Settlements — sees revenue-share payouts, no write access anywhere.",
  VIEWER: "Read-only across the organisation.",
};

/**
 * Higher number = more authority. This ranks the *primary* role, which is what
 * the Firestore rules read from the auth token. Finer-grained abilities are
 * decided by capability rather than rank — see permissions.ts.
 */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  SITE_OWNER: 0,
  AGENT: 1,
  OPERATIONS: 2,
  FINANCE: 2,
  FLEET_MANAGER: 2,
  CUSTOMER_SUPPORT: 1,
  SALES_MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

/**
 * Roles that grant org-wide visibility. The Firestore rules mirror this list,
 * so if you add one here, add it there too.
 */
export const ORG_WIDE_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES_MANAGER",
  "FINANCE",
  "OPERATIONS",
  "VIEWER",
];

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

/**
 * Which of the seven pipeline stages actually apply to each lead type — a
 * Franchise investor goes through a full EOI/agreement negotiation; an RWA
 * or corporate committee just needs a proposal accepted and an agreement
 * signed; a straight charger sale or EPC scope doesn't negotiate an
 * agreement at all, just a quotation; software has nothing to commission.
 * Falls back to the full sequence in the stepper if a lead's current stage
 * isn't actually in its type's list (e.g. its type changed after the fact).
 */
export const LEAD_TYPE_STAGES: Record<LeadType, Stage[]> = {
  FRANCHISE: ["NEW", "CONTACTED", "INTRODUCTION", "EOI", "AGREEMENT", "COMMISSIONING", "HANDOVER"],
  SITE: ["NEW", "CONTACTED", "INTRODUCTION", "EOI", "AGREEMENT", "COMMISSIONING", "HANDOVER"],
  RWA: ["NEW", "CONTACTED", "INTRODUCTION", "AGREEMENT", "COMMISSIONING", "HANDOVER"],
  CORPORATE: ["NEW", "CONTACTED", "INTRODUCTION", "AGREEMENT", "COMMISSIONING", "HANDOVER"],
  GOVERNMENT: ["NEW", "CONTACTED", "INTRODUCTION", "AGREEMENT", "COMMISSIONING", "HANDOVER"],
  EPC: ["NEW", "CONTACTED", "INTRODUCTION", "COMMISSIONING", "HANDOVER"],
  CHARGER_SALE: ["NEW", "CONTACTED", "INTRODUCTION", "COMMISSIONING", "HANDOVER"],
  SOFTWARE: ["NEW", "CONTACTED", "INTRODUCTION", "AGREEMENT", "HANDOVER"],
  OTHERS: ["NEW", "CONTACTED", "INTRODUCTION", "AGREEMENT", "COMMISSIONING", "HANDOVER"],
};

/**
 * The "Introduction" stage means something different once it's not leading
 * into a Franchise EOI — it's the quotation for a straight charger sale or
 * EPC scope, and the proposal for an institutional buyer.
 */
export function stageLabelFor(type: LeadType, stage: Stage): string {
  if (stage === "INTRODUCTION" && type !== "FRANCHISE" && type !== "SITE") {
    return type === "CHARGER_SALE" || type === "EPC" ? "Quotation" : "Proposal";
  }
  return STAGE_META[stage].label;
}
export function stageShortFor(type: LeadType, stage: Stage): string {
  if (stage === "INTRODUCTION" && type !== "FRANCHISE" && type !== "SITE") {
    return type === "CHARGER_SALE" || type === "EPC" ? "Quotation" : "Proposal";
  }
  return STAGE_META[stage].short;
}

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

export const LEAD_TYPES = [
  "FRANCHISE", "SITE", "RWA", "EPC", "CHARGER_SALE", "CORPORATE", "GOVERNMENT",
  "SOFTWARE", "OTHERS",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  FRANCHISE: "Franchise Investor",
  SITE: "Site / Location Partner",
  RWA: "RWA",
  EPC: "EPC (Limited Scope)",
  CHARGER_SALE: "Charger Sale Only",
  CORPORATE: "Corporate / B2B",
  GOVERNMENT: "Government",
  SOFTWARE: "Software Only",
  OTHERS: "Others",
};

/** Short prefix used in the human-readable lead code, e.g. LG-RW-000012. */
export const LEAD_TYPE_CODE: Record<LeadType, string> = {
  FRANCHISE: "FR",
  SITE: "ST",
  RWA: "RW",
  EPC: "EP",
  CHARGER_SALE: "CS",
  CORPORATE: "CO",
  GOVERNMENT: "GV",
  SOFTWARE: "SW",
  OTHERS: "OT",
};

/** Only a Franchise lead gets the franchise-investment Letter of Intent. */
export const FRANCHISE_LOI_TYPES: LeadType[] = ["FRANCHISE"];

/** Types where Livanto installs/invests and the client picks how they pay for it. */
export const COMMERCIAL_MODEL_TYPES: LeadType[] = ["RWA", "CORPORATE", "GOVERNMENT", "SOFTWARE", "OTHERS"];

/** Types grouped under the B2B nav view. */
export const B2B_LEAD_TYPES: LeadType[] = ["CORPORATE", "GOVERNMENT", "RWA", "SOFTWARE"];

/**
 * Which parts of the lead form/detail page actually apply to each type — a
 * Franchise investor takes a personal bank loan and signs an LOI; an RWA
 * committee or a government body does neither. Keeping this in one place
 * means adding a new lead type is a one-line decision, not a hunt through
 * every tab for a hardcoded "FRANCHISE" check.
 */

/** Only individual investors (Franchise/Site) take a personal loan against the purchase. */
export const TYPES_WITHOUT_FINANCING: LeadType[] = [
  "RWA", "EPC", "CHARGER_SALE", "CORPORATE", "GOVERNMENT", "SOFTWARE", "OTHERS",
];

/** Software-only deals have nothing to install — no DC charger basket, just priced line items. */
export const TYPES_WITHOUT_CHARGERS: LeadType[] = ["SOFTWARE"];

/** No KYC/site paperwork to collect — an institutional commercial decision, not an individual's. */
export const TYPES_WITHOUT_DOCUMENTS: LeadType[] = ["RWA", "CORPORATE", "SOFTWARE", "OTHERS"];

export const COMMERCIAL_MODELS = ["OPEX", "CAPEX"] as const;
export type CommercialModel = (typeof COMMERCIAL_MODELS)[number];

export const COMMERCIAL_MODEL_LABEL: Record<CommercialModel, string> = {
  OPEX: "OPEX — Livanto owns & operates, client pays usage-based",
  CAPEX: "CAPEX — client buys the installation outright",
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
  "EXPRESSWAY",
  "RING_ROAD",
  "TOLL_PLAZA",
  "FUEL_PUMP",
  "CNG_STATION",
  "HOTEL",
  "RESORT",
  "RESTAURANT",
  "MALL",
  "MARKET",
  "SHOWROOM",
  "PARKING_LOT",
  "OFFICE_COMPLEX",
  "IT_PARK",
  "RWA",
  "RESIDENTIAL_SOCIETY",
  "APARTMENT_COMPLEX",
  "EMPTY_LAND",
  "GOVERNMENT_LAND",
  "HOSPITAL",
  "SCHOOL_COLLEGE",
  "RELIGIOUS_PLACE",
  "BUS_STAND",
  "BUS_DEPOT",
  "RAILWAY_STATION",
  "METRO_STATION",
  "AIRPORT",
  "WAREHOUSE",
  "INDUSTRIAL",
  "EV_HUB",
  "FLEET_DEPOT",
  "OTHER",
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  HIGHWAY: "Highway (NH/SH)",
  EXPRESSWAY: "Expressway",
  RING_ROAD: "Ring Road",
  TOLL_PLAZA: "Toll Plaza",
  FUEL_PUMP: "Petrol / Fuel Pump",
  CNG_STATION: "CNG Station",
  HOTEL: "Hotel",
  RESORT: "Resort / Wayside Amenity",
  RESTAURANT: "Restaurant / Dhaba",
  MALL: "Mall / Retail",
  MARKET: "Market / High Street",
  SHOWROOM: "Showroom",
  PARKING_LOT: "Parking Lot",
  OFFICE_COMPLEX: "Office Complex",
  IT_PARK: "IT Park / SEZ",
  RWA: "RWA / Gated Colony",
  RESIDENTIAL_SOCIETY: "Residential Society",
  APARTMENT_COMPLEX: "Apartment Complex",
  EMPTY_LAND: "Empty / Vacant Land",
  GOVERNMENT_LAND: "Government Land",
  HOSPITAL: "Hospital",
  SCHOOL_COLLEGE: "School / College",
  RELIGIOUS_PLACE: "Temple / Religious Place",
  BUS_STAND: "Bus Stand",
  BUS_DEPOT: "Bus / Truck Depot",
  RAILWAY_STATION: "Railway Station",
  METRO_STATION: "Metro Station",
  AIRPORT: "Airport",
  WAREHOUSE: "Warehouse / Logistics Park",
  INDUSTRIAL: "Industrial Area",
  EV_HUB: "Dedicated EV Hub",
  FLEET_DEPOT: "Fleet / Aggregator Depot",
  OTHER: "Other",
};

/**
 * What kind of land it is. Distinct from who owns it — a private individual
 * can hold a plot on leased government land, and the approval path differs.
 */
export const LAND_TYPES = [
  "PRIVATE_LAND",
  "GOVERNMENT_LAND",
  "RWA_LAND",
  "MUNICIPAL_LAND",
  "NHAI_LAND",
  "PSU_LAND",
  "INDUSTRIAL_PLOT",
  "COMMERCIAL_COMPLEX",
  "AGRICULTURAL_CONVERTED",
  "LEASED_LAND",
  "OTHER",
] as const;
export type LandType = (typeof LAND_TYPES)[number];

export const LAND_TYPE_LABEL: Record<LandType, string> = {
  PRIVATE_LAND: "Private land",
  GOVERNMENT_LAND: "Government land",
  RWA_LAND: "RWA / society land",
  MUNICIPAL_LAND: "Municipal corporation land",
  NHAI_LAND: "NHAI / highway authority land",
  PSU_LAND: "PSU land (IOCL, BPCL, HPCL…)",
  INDUSTRIAL_PLOT: "Industrial plot",
  COMMERCIAL_COMPLEX: "Commercial complex",
  AGRICULTURAL_CONVERTED: "Agricultural (converted)",
  LEASED_LAND: "Leased land",
  OTHER: "Other",
};

/** The legal character of the counterparty — drives which KYC applies. */
export const OWNER_TYPES = [
  "INDIVIDUAL",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "RWA_SOCIETY",
  "TRUST_NGO",
  "GOVERNMENT_BODY",
  "PSU",
  "HUF",
  "OTHER",
] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const OWNER_TYPE_LABEL: Record<OwnerType, string> = {
  INDIVIDUAL: "Individual",
  PROPRIETORSHIP: "Sole Proprietorship",
  PARTNERSHIP: "Partnership Firm",
  LLP: "LLP",
  PRIVATE_LIMITED: "Private Limited Company",
  PUBLIC_LIMITED: "Public Limited Company",
  RWA_SOCIETY: "RWA / Co-operative Society",
  TRUST_NGO: "Trust / NGO",
  GOVERNMENT_BODY: "Government Body",
  PSU: "Public Sector Undertaking",
  HUF: "HUF",
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
  "FINANCING_UPDATED",
  "LINKED",
  "UNLINKED",
  "EOI_CREATED",
  "EOI_UPDATED",
  "EOI_ISSUED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_STAGE_CHANGED",
  "PROJECT_STATUS_CHANGED",
  "WORKSTREAM_UPDATED",
  "PROJECT_NOTE",
  "IMPORTED",
  "SETTINGS_UPDATED",
  "TRASHED",
  "RESTORED",
  "PROJECT_TRASHED",
  "PROJECT_RESTORED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Financing — how the investor is funding their participation
// ---------------------------------------------------------------------------

export const FUNDING_MODES = ["SELF", "LOAN", "PARTIAL_LOAN"] as const;
export type FundingMode = (typeof FUNDING_MODES)[number];

export const FUNDING_MODE_LABEL: Record<FundingMode, string> = {
  SELF: "Self funded (no loan)",
  LOAN: "Bank loan",
  PARTIAL_LOAN: "Part self, part loan",
};

/** Loan progress, tracked alongside — not inside — the sales pipeline. */
export const LOAN_STAGES = [
  "NOT_APPLICABLE",
  "ENQUIRY",
  "DOCUMENTS_COLLECTED",
  "APPLIED",
  "UNDER_REVIEW",
  "SANCTIONED",
  "DISBURSED",
  "REJECTED",
] as const;
export type LoanStage = (typeof LOAN_STAGES)[number];

export const LOAN_STAGE_LABEL: Record<LoanStage, string> = {
  NOT_APPLICABLE: "Not applicable",
  ENQUIRY: "Enquiry",
  DOCUMENTS_COLLECTED: "Documents collected",
  APPLIED: "Application submitted",
  UNDER_REVIEW: "Under bank review",
  SANCTIONED: "Sanctioned",
  DISBURSED: "Disbursed",
  REJECTED: "Rejected by bank",
};

export const LOAN_STAGE_COLOR: Record<LoanStage, string> = {
  NOT_APPLICABLE: "bg-slate-100 text-slate-600 ring-slate-200",
  ENQUIRY: "bg-slate-100 text-slate-700 ring-slate-200",
  DOCUMENTS_COLLECTED: "bg-sky-100 text-sky-800 ring-sky-200",
  APPLIED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 ring-amber-200",
  SANCTIONED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  DISBURSED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
};

/** Common lenders for EV infrastructure loans in India. Free text is allowed. */
export const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank",
  "Yes Bank",
  "IDFC First Bank",
  "Bajaj Finserv",
  "Tata Capital",
  "SIDBI",
  "Other / NBFC",
] as const;

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

/** Charger manufacturers. Free text is allowed for anything not listed. */
export const CHARGER_OEMS = [
  "Livanto (in-house)",
  "Delta Electronics",
  "ABB",
  "Exicom",
  "Servotech",
  "Okaya",
  "Mass-Tech",
  "Tata Power EZ",
  "Statiq",
  "Jio-bp",
  "Other",
] as const;

/**
 * GST slabs the business actually bills at. Chargers are 18%; some civil and
 * electrical materials fall in the lower slabs, which is why this is per-line
 * rather than a single global rate.
 */
export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export type GstSlab = (typeof GST_SLABS)[number];

/** Non-charger line items that commonly appear on a participation summary. */
export const EXTRA_ITEM_PRESETS = [
  { label: "Civil work & foundation", gstPct: 18 },
  { label: "Canopy / shed structure", gstPct: 18 },
  { label: "LT panel & electrical work", gstPct: 18 },
  { label: "DISCOM demand note & security deposit", gstPct: 0 },
  { label: "Transformer / HT works", gstPct: 18 },
  { label: "Cabling & earthing", gstPct: 18 },
  { label: "3.3 kW AC charger", gstPct: 18 },
  { label: "7.4 kW AC charger", gstPct: 18 },
  { label: "10 kW AC charger", gstPct: 18 },
  { label: "11 kW AC charger", gstPct: 18 },
  { label: "15 kW AC charger", gstPct: 18 },
  { label: "22 kW AC charger", gstPct: 18 },
  { label: "30 kW AC charger", gstPct: 18 },
  { label: "Signage & branding", gstPct: 12 },
  { label: "Site development / levelling", gstPct: 5 },
  { label: "Other", gstPct: 18 },
] as const;

// ---------------------------------------------------------------------------
// Hub sites — a location that carries more than one charger, of mixed types
// and capacities, rather than a single-configuration station.
// ---------------------------------------------------------------------------

/** Quick-add AC capacities offered inside a hub, beyond the DC catalogue. */
export const HUB_AC_CAPACITIES_KW = [3.3, 7.4, 10, 11, 15, 22, 30] as const;

// ---------------------------------------------------------------------------
// Channel partners — dealers, EPC contractors and referral partners who
// originate leads. Tiers and commission rates are the real terms from the
// Livanto Channel Partner Program.
// ---------------------------------------------------------------------------

export const PARTNER_CATEGORIES = [
  "DEALER", "CHANNEL_PARTNER", "EPC_PARTNER", "REFERRAL_PARTNER",
] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const PARTNER_CATEGORY_LABEL: Record<PartnerCategory, string> = {
  DEALER: "Dealer",
  CHANNEL_PARTNER: "Channel Partner",
  EPC_PARTNER: "EPC Partner",
  REFERRAL_PARTNER: "Referral Partner",
};

export const PARTNER_TIERS = ["ASSOCIATE", "AUTHORIZED", "ELITE"] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];

export const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  ASSOCIATE: "Associate",
  AUTHORIZED: "Authorized",
  ELITE: "Elite",
};

export const PARTNER_TIER_COLOR: Record<PartnerTier, string> = {
  ASSOCIATE: "bg-slate-100 text-slate-700 ring-slate-200",
  AUTHORIZED: "bg-sky-100 text-sky-800 ring-sky-200",
  ELITE: "bg-amber-100 text-amber-800 ring-amber-200",
};

/** One-time sales commission, % of station value, per the partner program. */
export const PARTNER_TIER_RATE: Record<PartnerTier, number> = {
  ASSOCIATE: 3,
  AUTHORIZED: 4,
  ELITE: 5,
};

/** Minimum stations sold in a trailing 12 months to hold each tier. */
export const PARTNER_TIER_THRESHOLD: Record<PartnerTier, number> = {
  ASSOCIATE: 1,
  AUTHORIZED: 4,
  ELITE: 9,
};

export const PARTNER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const COMMISSION_STATUSES = ["PENDING", "APPROVED", "PAID"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
};

export const COMMISSION_STATUS_COLOR: Record<CommissionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  APPROVED: "bg-sky-100 text-sky-800 ring-sky-200",
  PAID: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

// ---------------------------------------------------------------------------
// Procurement & vendors — who Livanto pays to build a station, as opposed to
// Channel Partners above, who Livanto pays for bringing a lead in.
// ---------------------------------------------------------------------------

export const VENDOR_CATEGORIES = [
  "CHARGER_OEM", "EPC_CONTRACTOR", "CIVIL_WORK", "ELECTRICAL", "TRANSPORT", "OTHER",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  CHARGER_OEM: "Charger OEM",
  EPC_CONTRACTOR: "EPC Contractor",
  CIVIL_WORK: "Civil Work",
  ELECTRICAL: "Electrical / LT Panel",
  TRANSPORT: "Transport / Logistics",
  OTHER: "Other",
};

export const VENDOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const PO_STATUSES = [
  "DRAFT", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent to vendor",
  ACKNOWLEDGED: "Acknowledged",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const PO_STATUS_COLOR: Record<PoStatus, string> = {
  DRAFT: "bg-ink-100 text-ink-700 ring-ink-200",
  SENT: "bg-sky-100 text-sky-800 ring-sky-200",
  ACKNOWLEDGED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-800 ring-amber-200",
  RECEIVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const VENDOR_PAYMENT_STATUSES = ["PENDING", "PAID"] as const;
export type VendorPaymentStatus = (typeof VENDOR_PAYMENT_STATUSES)[number];

// ----------------------------------------------------------- client quotations

export const QUOTATION_STATUSES = [
  "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent to client",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted to lead",
};

export const QUOTATION_STATUS_COLOR: Record<QuotationStatus, string> = {
  DRAFT: "bg-ink-100 text-ink-700 ring-ink-200",
  SENT: "bg-sky-100 text-sky-800 ring-sky-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
  EXPIRED: "bg-amber-100 text-amber-800 ring-amber-200",
  CONVERTED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
};

// -------------------------------------------------------- charger tickets

export const TICKET_TYPES = ["OFFLINE", "FAULT", "MANUAL"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  OFFLINE: "Offline",
  FAULT: "Fault",
  MANUAL: "Manual",
};

export const TICKET_FAULT_CLASSES = [
  "CONNECTOR", "POWER_SUPPLY", "COMMUNICATION", "PHYSICAL_DAMAGE", "SOFTWARE", "METERING", "OTHER",
] as const;
export type TicketFaultClass = (typeof TICKET_FAULT_CLASSES)[number];

export const TICKET_FAULT_CLASS_LABEL: Record<TicketFaultClass, string> = {
  CONNECTOR: "Connector / gun",
  POWER_SUPPLY: "Power supply",
  COMMUNICATION: "Communication / network",
  PHYSICAL_DAMAGE: "Physical damage",
  SOFTWARE: "Firmware / software",
  METERING: "Metering",
  OTHER: "Other",
};

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_STATUS_COLOR: Record<TicketStatus, string> = {
  OPEN: "bg-rose-100 text-rose-800 ring-rose-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 ring-amber-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-ink-100 text-ink-600 ring-ink-200",
};

// ------------------------------------------------------------- Complaints
// Customer/driver-initiated issues — separate from Tickets, which are
// charger-fault-only and opened by the OCPP server or ops staff. A
// complaint might be about billing, app behavior, or service quality with
// no charger fault involved at all.

export const COMPLAINT_CATEGORIES = ["BILLING", "CHARGER_ISSUE", "APP_ISSUE", "SERVICE_QUALITY", "OTHER"] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  BILLING: "Billing / payment",
  CHARGER_ISSUE: "Charger issue",
  APP_ISSUE: "App / website issue",
  SERVICE_QUALITY: "Service quality",
  OTHER: "Other",
};

export const COMPLAINT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const COMPLAINT_STATUS_COLOR: Record<ComplaintStatus, string> = {
  OPEN: "bg-rose-100 text-rose-800 ring-rose-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 ring-amber-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-ink-100 text-ink-600 ring-ink-200",
};

export const COMPLAINT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];

export const COMPLAINT_PRIORITY_LABEL: Record<ComplaintPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

// ------------------------------------------------------------- RFID tokens

export const RFID_TOKEN_STATUSES = ["ACTIVE", "BLOCKED"] as const;
export type RfidTokenStatus = (typeof RFID_TOKEN_STATUSES)[number];

// --------------------------------------------------- depot / scheduled charging

export const CHARGING_SCHEDULE_STATUSES = ["SCHEDULED", "TRIGGERED", "CANCELLED", "FAILED"] as const;
export type ChargingScheduleStatus = (typeof CHARGING_SCHEDULE_STATUSES)[number];

export const CHARGING_SCHEDULE_STATUS_LABEL: Record<ChargingScheduleStatus, string> = {
  SCHEDULED: "Scheduled",
  TRIGGERED: "Started",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

export const CHARGING_SCHEDULE_STATUS_COLOR: Record<ChargingScheduleStatus, string> = {
  SCHEDULED: "bg-sky-100 text-sky-800 ring-sky-200",
  TRIGGERED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-ink-100 text-ink-600 ring-ink-200",
  FAILED: "bg-rose-100 text-rose-800 ring-rose-200",
};

// ------------------------------------------------------ charging tariffs

export const TARIFF_PRICING_TYPES = ["PER_KWH", "PER_MINUTE", "PER_SESSION"] as const;
export type TariffPricingType = (typeof TARIFF_PRICING_TYPES)[number];

export const TARIFF_PRICING_TYPE_LABEL: Record<TariffPricingType, string> = {
  PER_KWH: "₹ per kWh",
  PER_MINUTE: "₹ per minute",
  PER_SESSION: "Flat per session",
};

export const TARIFF_SCOPES = [
  "ALL_CHARGERS", "STATE", "CITY", "ZONE", "FLEET", "USER", "CORPORATE", "SPECIFIC_CHARGERS", "SPECIFIC_CONNECTORS",
] as const;
export type TariffScope = (typeof TARIFF_SCOPES)[number];

export const TARIFF_SCOPE_LABEL: Record<TariffScope, string> = {
  ALL_CHARGERS: "All chargers (default)",
  STATE: "State-wise",
  CITY: "City-wise",
  ZONE: "Site / zone-wise",
  FLEET: "Fleet-wise",
  USER: "Specific user",
  CORPORATE: "Corporate account-wise",
  SPECIFIC_CHARGERS: "Specific chargers",
  SPECIFIC_CONNECTORS: "Specific connectors",
};

export const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// -------------------------------------------------------- EMSP users & fleet

export const EMSP_USER_TYPES = ["RETAIL", "CORPORATE"] as const;
export type EmspUserType = (typeof EMSP_USER_TYPES)[number];

export const EMSP_USER_TYPE_LABEL: Record<EmspUserType, string> = {
  RETAIL: "Retail",
  CORPORATE: "Corporate",
};

// ------------------------------------------------------------- invoicing

export const INVOICE_BILL_TO_TYPES = ["EMSP_USER", "CORPORATE_ACCOUNT", "MANUAL"] as const;
export type InvoiceBillToType = (typeof INVOICE_BILL_TO_TYPES)[number];

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const SITE_TYPES = ["RWA", "HOTEL", "FUEL_STATION", "HIGHWAY", "CORPORATE", "OTHER"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const SITE_TYPE_LABEL: Record<SiteType, string> = {
  RWA: "RWA",
  HOTEL: "Hotel",
  FUEL_STATION: "Fuel station",
  HIGHWAY: "Highway",
  CORPORATE: "Corporate campus",
  OTHER: "Other",
};

export const INVOICE_STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "bg-ink-100 text-ink-700 ring-ink-200",
  ISSUED: "bg-sky-100 text-sky-800 ring-sky-200",
  PAID: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 ring-rose-200",
};

// ---------------------------------------------------------------------------
// Asset register & depreciation — chargers and equipment become tracked
// assets once a purchase order is received. This is an internal management
// tool, not a substitute for the company's statutory depreciation ledger —
// confirm useful life / method with your CA before relying on it for filing.
// ---------------------------------------------------------------------------

export const ASSET_CATEGORIES = [
  "CHARGER", "TRANSFORMER", "PANEL", "CANOPY", "VEHICLE", "IT_EQUIPMENT", "OTHER",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  CHARGER: "EV Charger",
  TRANSFORMER: "Transformer / HT Equipment",
  PANEL: "LT Panel / Electrical",
  CANOPY: "Canopy / Structure",
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
  IN_SERVICE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-800 ring-amber-200",
  DECOMMISSIONED: "bg-ink-100 text-ink-600 ring-ink-200",
  DISPOSED: "bg-rose-100 text-rose-800 ring-rose-200",
};

/** Straight-line: equal expense every year. WDV: a fixed % of the *remaining* book value every year (the method Indian tax law generally expects for plant & machinery). */
export const DEPRECIATION_METHODS = ["STRAIGHT_LINE", "WDV"] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

export const DEPRECIATION_METHOD_LABEL: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE: "Straight-line",
  WDV: "Written Down Value (WDV)",
};

// ---------------------------------------------------------------------------
// Lead scoring — a deterministic 0-100 signal of how likely a lead is to
// close, shown as Hot/Warm/Cold. Not machine-learned: a transparent sum of
// factors the sales team already tracks, so it's explainable on request.
// ---------------------------------------------------------------------------

export const SCORE_BANDS = [
  { min: 80, key: "HOT", label: "Hot", color: "bg-rose-100 text-rose-800 ring-rose-200" },
  { min: 50, key: "WARM", label: "Warm", color: "bg-amber-100 text-amber-800 ring-amber-200" },
  { min: 0, key: "COLD", label: "Cold", color: "bg-sky-100 text-sky-700 ring-sky-200" },
] as const;

// ---------------------------------------------------------------------------
// Follow-up task engine — scheduled, owned, due-dated work against a lead,
// distinct from the append-only activity log (which records what already
// happened). A task is what's supposed to happen next.
// ---------------------------------------------------------------------------

export const FOLLOWUP_TYPES = [
  "CALL", "WHATSAPP", "EMAIL", "MEETING", "SITE_VISIT", "SITE_SURVEY",
  "PAYMENT_FOLLOWUP", "DOCUMENT_FOLLOWUP", "PROPOSAL_FOLLOWUP",
] as const;
export type FollowupType = (typeof FOLLOWUP_TYPES)[number];

export const FOLLOWUP_TYPE_LABEL: Record<FollowupType, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  SITE_VISIT: "Site visit",
  SITE_SURVEY: "Site survey",
  PAYMENT_FOLLOWUP: "Payment follow-up",
  DOCUMENT_FOLLOWUP: "Document follow-up",
  PROPOSAL_FOLLOWUP: "Proposal follow-up",
};

export const FOLLOWUP_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type FollowupPriority = (typeof FOLLOWUP_PRIORITIES)[number];

export const FOLLOWUP_PRIORITY_LABEL: Record<FollowupPriority, string> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High",
};

export const FOLLOWUP_PRIORITY_COLOR: Record<FollowupPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 ring-slate-200",
  MEDIUM: "bg-amber-100 text-amber-800 ring-amber-200",
  HIGH: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const FOLLOWUP_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const FOLLOWUP_STATUS_LABEL: Record<FollowupStatus, string> = {
  OPEN: "Open", DONE: "Done", CANCELLED: "Cancelled",
};

// ---------------------------------------------------------------------------
// EOI / Letter of Intent
// ---------------------------------------------------------------------------

export const EOI_STATUSES = ["DRAFT", "ISSUED", "ACCEPTED", "DECLINED", "SUPERSEDED"] as const;
export type EoiStatus = (typeof EOI_STATUSES)[number];

export const EOI_STATUS_LABEL: Record<EoiStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued to client",
  ACCEPTED: "Accepted & signed",
  DECLINED: "Declined",
  SUPERSEDED: "Superseded",
};

export const EOI_STATUS_COLOR: Record<EoiStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  ISSUED: "bg-sky-100 text-sky-800 ring-sky-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  DECLINED: "bg-rose-100 text-rose-800 ring-rose-200",
  SUPERSEDED: "bg-amber-100 text-amber-800 ring-amber-200",
};

/**
 * Issuing entity. Appears on every generated Letter of Intent. These are the
 * compiled defaults a fresh project starts with — Settings → Company can
 * override every field without a redeploy.
 */
export const COMPANY = {
  legalName: "Livanto Green Infra Private Limited",
  shortName: "Livanto",
  model: "Franchise-Owned, Company-Operated (“FOCO”)",
  signatory: "Team Livanto",
  address: "413 Millennium Palace, Sushant Golf City, Lucknow, Uttar Pradesh, 226030",
  gstin: "09AAGCL4761J1Z4",
  cin: "U35100UP2025PTC232160",
  email: "info@livantogreen.com",
  phone: "",
  website: "www.livantogreen.com",
  logoUrl: "/logo.png",
  bank: {
    accountName: "Livanto Green Infra Private Limited",
    bankName: "Kotak Mahindra Bank",
    accountNumber: "0051558154",
    ifsc: "KKBK0005328",
  },
  arbitrationSeat: "Lucknow, Uttar Pradesh",
  jurisdiction: "Lucknow",
};

export const DEFAULT_SCOPE_ITEMS = [
  "Location scouting, site feasibility assessment and EV demand evaluation",
  "Canopy structure installation, electrical infrastructure preparation and the DISCOM connection process",
  "Procurement, installation and commissioning of the DC charging equipment",
  "Charging software (CMS/OCPP) and payment gateway integration",
  "Operation and management of the Charging Station for the entire Tenure",
];

export const DEFAULT_TENURE_YEARS = 10;
export const DEFAULT_PAYOUT_MONTHS = 24;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

// ---------------------------------------------------------------------------
// Projects — execution after a deal closes
// ---------------------------------------------------------------------------

/**
 * Who owns the station. A franchise project is funded by an investor and
 * converted from a won lead; a COCO project is funded by Livanto itself.
 * Everything downstream — civil work, DISCOM, commissioning — is identical,
 * which is why they are one module with two ownership types rather than two
 * parallel codebases that would drift apart.
 */
export const PROJECT_OWNERSHIPS = ["FRANCHISE", "COCO"] as const;
export type ProjectOwnership = (typeof PROJECT_OWNERSHIPS)[number];

export const PROJECT_OWNERSHIP_LABEL: Record<ProjectOwnership, string> = {
  FRANCHISE: "Franchise (FOCO)",
  COCO: "Company Owned, Company Operated",
};

export const PROJECT_OWNERSHIP_COLOR: Record<ProjectOwnership, string> = {
  FRANCHISE: "bg-violet-100 text-violet-800 ring-violet-200",
  COCO: "bg-teal-100 text-teal-800 ring-teal-200",
};

export const PROJECT_STAGES = [
  "PLANNING",
  "SITE_SURVEY",
  "AGREEMENT_SIGNED",
  "CIVIL_WORK",
  "ELECTRICAL_WORK",
  "DISCOM_SANCTION",
  "CHARGER_INSTALLATION",
  "TESTING_COMMISSIONING",
  "LIVE",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export interface ProjectStageMeta {
  key: ProjectStage;
  label: string;
  short: string;
  hint: string;
  color: string;
  dot: string;
}

export const PROJECT_STAGE_META: Record<ProjectStage, ProjectStageMeta> = {
  PLANNING: {
    key: "PLANNING", label: "Planning", short: "Planning",
    hint: "Project created, scope and budget being finalised.",
    color: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400",
  },
  SITE_SURVEY: {
    key: "SITE_SURVEY", label: "Site Survey", short: "Survey",
    hint: "Feasibility, load assessment and layout drawing.",
    color: "bg-sky-100 text-sky-800 ring-sky-200", dot: "bg-sky-500",
  },
  AGREEMENT_SIGNED: {
    key: "AGREEMENT_SIGNED", label: "Agreement Signed", short: "Agreement",
    hint: "Site/tripartite agreement executed; work can begin.",
    color: "bg-indigo-100 text-indigo-800 ring-indigo-200", dot: "bg-indigo-500",
  },
  CIVIL_WORK: {
    key: "CIVIL_WORK", label: "Civil Work", short: "Civil",
    hint: "Foundation, canopy, flooring and site development.",
    color: "bg-amber-100 text-amber-800 ring-amber-200", dot: "bg-amber-500",
  },
  ELECTRICAL_WORK: {
    key: "ELECTRICAL_WORK", label: "Electrical Work", short: "Electrical",
    hint: "LT panel, cabling, earthing and metering.",
    color: "bg-orange-100 text-orange-800 ring-orange-200", dot: "bg-orange-500",
  },
  DISCOM_SANCTION: {
    key: "DISCOM_SANCTION", label: "DISCOM & Electrification", short: "DISCOM",
    hint: "Load application, demand note, meter and energisation.",
    color: "bg-yellow-100 text-yellow-800 ring-yellow-200", dot: "bg-yellow-500",
  },
  CHARGER_INSTALLATION: {
    key: "CHARGER_INSTALLATION", label: "Charger Installation", short: "Install",
    hint: "Charger delivered, mounted and wired.",
    color: "bg-lime-100 text-lime-800 ring-lime-200", dot: "bg-lime-500",
  },
  TESTING_COMMISSIONING: {
    key: "TESTING_COMMISSIONING", label: "Testing & Commissioning", short: "Testing",
    hint: "CMS/OCPP onboarding, test charge and sign-off.",
    color: "bg-cyan-100 text-cyan-800 ring-cyan-200", dot: "bg-cyan-500",
  },
  LIVE: {
    key: "LIVE", label: "Live", short: "Live",
    hint: "Station commissioned and open to the public.",
    color: "bg-emerald-100 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500",
  },
};

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "LIVE", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "In progress",
  ON_HOLD: "On hold",
  LIVE: "Live",
  CANCELLED: "Cancelled",
};

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  ACTIVE: "bg-sky-100 text-sky-800 ring-sky-200",
  ON_HOLD: "bg-amber-100 text-amber-800 ring-amber-200",
  LIVE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 ring-rose-200",
};

/**
 * Workstreams run in parallel, not in sequence — civil can be finished while
 * DISCOM is still pending, and that is exactly the situation a single overall
 * stage would hide. Each carries its own status, dates, vendor and progress.
 */
export const WORKSTREAMS = [
  "SITE_READINESS",
  "CIVIL",
  "ELECTRICAL",
  "DISCOM",
  "CHARGER",
  "NETWORK",
  "BRANDING",
  "SAFETY",
] as const;
export type Workstream = (typeof WORKSTREAMS)[number];

export const WORKSTREAM_LABEL: Record<Workstream, string> = {
  SITE_READINESS: "Site readiness & survey",
  CIVIL: "Civil work",
  ELECTRICAL: "Electrical work",
  DISCOM: "DISCOM / electrification",
  CHARGER: "Charger supply & installation",
  NETWORK: "CMS / OCPP & connectivity",
  BRANDING: "Signage & branding",
  SAFETY: "Safety, earthing & compliance",
};

export const WORKSTREAM_HINT: Record<Workstream, string> = {
  SITE_READINESS: "Feasibility, layout drawing, land levelling and access.",
  CIVIL: "Foundation, canopy/shed, flooring, drainage.",
  ELECTRICAL: "LT panel, cabling, earthing pits, metering panel.",
  DISCOM: "Load application, demand note payment, meter and energisation.",
  CHARGER: "Dispatch, delivery, mounting and wiring of the charger.",
  NETWORK: "SIM/network, CMS onboarding, payment gateway, test transaction.",
  BRANDING: "Canopy branding, totem, signage and floor marking.",
  SAFETY: "Earthing values, fire extinguisher, safety signage, inspection.",
};

export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "NOT_APPLICABLE",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  NOT_APPLICABLE: "Not applicable",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 ring-slate-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 ring-sky-200",
  BLOCKED: "bg-rose-100 text-rose-800 ring-rose-200",
  DONE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  NOT_APPLICABLE: "bg-ink-100 text-ink-500 ring-ink-200",
};

/** DISCOM connection progress — the usual long pole on an EV project. */
export const DISCOM_STAGES = [
  "NOT_APPLIED",
  "APPLIED",
  "SITE_INSPECTION",
  "DEMAND_NOTE",
  "DEMAND_NOTE_PAID",
  "METER_INSTALLED",
  "ENERGISED",
  "REJECTED",
] as const;
export type DiscomStage = (typeof DISCOM_STAGES)[number];

export const DISCOM_STAGE_LABEL: Record<DiscomStage, string> = {
  NOT_APPLIED: "Not applied",
  APPLIED: "Application submitted",
  SITE_INSPECTION: "Site inspection done",
  DEMAND_NOTE: "Demand note received",
  DEMAND_NOTE_PAID: "Demand note paid",
  METER_INSTALLED: "Meter installed",
  ENERGISED: "Energised",
  REJECTED: "Rejected",
};

export const CONNECTION_TYPES = ["LT_3_PHASE", "LT_COMMERCIAL", "HT", "SOLAR_HYBRID"] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export const CONNECTION_TYPE_LABEL: Record<ConnectionType, string> = {
  LT_3_PHASE: "LT — 3 Phase",
  LT_COMMERCIAL: "LT — Commercial",
  HT: "HT with transformer",
  SOLAR_HYBRID: "Solar hybrid",
};

/** Who is doing the work on the ground. */
export const VENDOR_KINDS = [
  "CIVIL_CONTRACTOR",
  "ELECTRICAL_CONTRACTOR",
  "DISCOM_LIAISON",
  "CHARGER_OEM",
  "LOGISTICS",
  "BRANDING",
  "OTHER",
] as const;
export type VendorKind = (typeof VENDOR_KINDS)[number];

export const VENDOR_KIND_LABEL: Record<VendorKind, string> = {
  CIVIL_CONTRACTOR: "Civil contractor",
  ELECTRICAL_CONTRACTOR: "Electrical contractor",
  DISCOM_LIAISON: "DISCOM liaison",
  CHARGER_OEM: "Charger OEM",
  LOGISTICS: "Logistics / transport",
  BRANDING: "Branding & signage",
  OTHER: "Other",
};

export const WEBHOOK_EVENTS = [
  "session.ended", "ticket.opened", "ticket.sla_breached",
  "charger.online", "charger.offline",
  "payment.success", "payment.failed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];


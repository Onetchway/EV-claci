import type { Timestamp } from "firebase/firestore";
import type {
  ActivityType, AssetCategory, AssetStatus, CommercialModel, CommissionStatus,
  ConnectionType, DepreciationMethod, DiscomStage, DocKind, DocStatus, EoiStatus,
  FollowupPriority, FollowupStatus, FollowupType, FundingMode, LandType,
  LeadStatus, LeadType, LoanStage, LocationType, Ownership, OwnerType,
  PartnerCategory, PartnerStatus, PartnerTier, PaymentMilestone, PaymentMode,
  PaymentStatus, PoStatus, PowerLoad, ProjectOwnership, ProjectStage,
  ProjectStatus, RejectionReason, Role, Source, Stage, TaskStatus,
  VendorCategory, VendorPaymentStatus, VendorStatus, Workstream,
} from "./constants";
import type { ConfigItem, ExtraItem, Quote } from "./pricing";

/** Firestore returns Timestamp; freshly-written local docs may hold null. */
export type TS = Timestamp | null;

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  phone?: string;
  /**
   * Primary role — the highest-ranked of `roles`. This is what gets written to
   * the Firebase Auth custom claim and what the Firestore rules read, so it is
   * kept as a single value even though a user may hold several roles.
   */
  role: Role;
  /** Every role this user holds. Capabilities are the union across them. */
  roles?: Role[];
  /** Admin this agent reports to. */
  managerId?: string | null;
  region?: string | null;
  active: boolean;
  photoURL?: string | null;
  createdAt: TS;
  createdBy?: string | null;
  lastLoginAt?: TS;
}

/** Bank funding, tracked alongside the sales pipeline rather than inside it. */
export interface FinancingInfo {
  mode: FundingMode;
  bank?: string;
  branch?: string;
  /** Amount the investor is seeking or has been sanctioned. */
  requestedAmount?: number | null;
  sanctionedAmount?: number | null;
  disbursedAmount?: number | null;
  interestRate?: number | null;
  tenureYears?: number | null;
  emi?: number | null;
  applicationNo?: string;
  stage: LoanStage;
  relationshipManager?: string;
  rmPhone?: string;
  appliedAt?: TS;
  sanctionedAt?: TS;
  disbursedAt?: TS;
  note?: string;
  /**
   * Recorded manually by the team from a bureau pull done elsewhere (bank,
   * NBFC, or a bureau's own portal) — there is no live CIBIL/bureau API wired
   * up, so this is a record, not a check.
   */
  cibilScore?: number | null;
  cibilCheckedAt?: TS;
}

/** A single row of the LOI's Participation Summary — fully editable. */
export interface EoiScheduleRow {
  id: string;
  description: string;
  /** Amount as it should print. GST may be included or shown separately. */
  amount: number;
}

/**
 * The Letter of Intent cum Expression of Interest. Generated from the lead's
 * quotation, then editable — the real letters vary in tranche count, whether
 * GST is broken out, and what equipment is bundled.
 */
export interface EoiDoc {
  number: string;
  status: EoiStatus;
  issuedDate: TS;
  /** Salutation title: Mr., Ms., M/s. */
  salutation: string;
  investorName: string;
  investorAddress: string;
  siteName: string;
  capacityLabel: string;
  extraEquipment?: string;
  subject: string;
  intro: string;
  schedule: EoiScheduleRow[];
  /** Shown under the schedule; normally the GST-inclusive grand total. */
  totalAmount: number;
  gstShownSeparately: boolean;
  scopeItems: string[];
  tenureYears: number;
  payoutMonths: number;
  minMonthlyPayout: number;
  maxAggregateSupport: number;
  /** Clause bodies after placeholder substitution, so an issued letter is frozen. */
  clauses: { key: string; heading: string; body: string }[];
  closing: string;
  signatory: string;
  createdAt: TS;
  createdBy?: Actor;
  updatedAt?: TS;
  updatedBy?: Actor;
  issuedBy?: Actor | null;
  acceptedAt?: TS;
}

export interface Actor {
  uid: string;
  name: string;
  role: Role;
}

export interface ClientInfo {
  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  company?: string;
  city: string;
  state?: string;
  address?: string;
  pan?: string;
  aadhaarLast4?: string;
  gstin?: string;
}

export interface SiteInfo {
  locationName?: string;
  mapsLink?: string;
  lat?: number | null;
  lng?: number | null;
  locationTypes?: LocationType[];
  /** What kind of land it is — private, government, RWA and so on. */
  landType?: LandType | null;
  /** The legal character of the counterparty, which decides which KYC applies. */
  ownerType?: OwnerType | null;
  ownership?: Ownership | null;
  commercialModelInterested?: boolean;
  powerLoad?: PowerLoad | null;
  sanctionedLoadKva?: number | null;
  spaceAvailableSqft?: number | null;
  frontageMeters?: number | null;
  nearbyLandmark?: string;
  remarks?: string;
  /** A multi-charger hub rather than a single-configuration station. */
  isHub?: boolean;
}

export interface RejectionInfo {
  reason: RejectionReason;
  note?: string;
  at: TS;
  by: Actor;
}

export interface LinkedLeadRef {
  id: string;
  code: string;
  name: string;
}

export interface Lead {
  id: string;
  /** Human-friendly reference, e.g. LG-FR-000142. */
  code: string;
  type: LeadType;
  stage: Stage;
  status: LeadStatus;
  client: ClientInfo;
  source: Source;
  sourceDetail?: string;
  /** Charger basket the client is interested in. */
  config: ConfigItem[];
  /** Civil work, LT panel, DISCOM deposit and other non-charger lines. */
  extras?: ExtraItem[];
  discount?: number;
  /** Default charger manufacturer; individual lines may override it. */
  oem?: string | null;
  /** Denormalised quote snapshot so lists/reports never recompute. */
  quote?:
    | Pick<Quote, "subtotal" | "discount" | "gst" | "grandTotal" | "totalKw" | "unitCount" | "effectiveGstPct">
    | null;
  /** Grand total incl. GST — the single number reports sort and sum on. */
  value: number;
  financing?: FinancingInfo;
  /** The generated Letter of Intent, once one exists. */
  eoi?: EoiDoc | null;
  /**
   * Site ↔ franchise pairing, many-to-many. An investor can back several
   * franchises over time, and a landowner can offer several sites; every link
   * is recorded on both sides, so either record reaches all its counterparts.
   */
  linkedLeads?: LinkedLeadRef[];
  /** Set once a won lead has been converted into a delivery project. */
  projectId?: string | null;
  projectCode?: string | null;
  /** Channel partner who originated this lead, if any. */
  partnerId?: string | null;
  partnerName?: string | null;
  /** How the client pays, for lead types where Livanto installs/invests (RWA, Corporate, Government, Software, Others). */
  commercialModel?: CommercialModel | null;
  /** Soft-deleted leads are hidden from normal views but recoverable from Trash. */
  deletedAt?: TS | null;
  deletedBy?: Actor | null;
  site?: SiteInfo;
  ownerId: string;
  ownerName: string;
  tags?: string[];
  nextFollowUpAt?: TS;
  expectedCloseAt?: TS;
  rejection?: RejectionInfo | null;
  /** Rolling totals maintained when payments change. */
  paidAmount?: number;
  dueAmount?: number;
  docCount?: number;
  lastActivityAt?: TS;
  lastActivityBy?: string;
  createdAt: TS;
  createdBy: Actor;
  updatedAt: TS;
  updatedBy?: Actor;
  /** Lowercased tokens for prefix search on name / phone / code / city. */
  search?: string[];
}

export interface Payment {
  id: string;
  leadId: string;
  milestone: PaymentMilestone;
  /** Amount excluding GST. */
  baseAmount: number;
  /** GST rate applied, as a fraction (0.18 = 18%). Defaults to 18% on older entries that predate this field. */
  gstPct?: number;
  gstAmount: number;
  totalAmount: number;
  mode: PaymentMode;
  reference?: string;
  status: PaymentStatus;
  paidAt: TS;
  dueAt?: TS;
  note?: string;
  receiptDocId?: string | null;
  createdAt: TS;
  createdBy: Actor;
  updatedAt?: TS;
  updatedBy?: Actor;
  verifiedBy?: Actor | null;
}

export interface LeadDocument {
  id: string;
  leadId: string;
  kind: DocKind;
  fileName: string;
  storagePath: string;
  url: string;
  contentType: string;
  size: number;
  status: DocStatus;
  note?: string;
  /** Document number, e.g. PAN or Aadhaar reference. */
  refNumber?: string;
  expiresAt?: TS;
  uploadedAt: TS;
  uploadedBy: Actor;
  reviewedAt?: TS;
  reviewedBy?: Actor | null;
}

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface Activity {
  id: string;
  leadId: string;
  leadCode?: string;
  leadName?: string;
  type: ActivityType;
  message: string;
  changes?: FieldChange[];
  actor: Actor;
  at: TS;
  /** Set on manual follow-up entries. */
  followUpAt?: TS;
  /** UIDs of teammates @mentioned in `message`. */
  mentions?: string[];
}

export interface Partner {
  id: string;
  /** Human-friendly reference, e.g. LG-CP-0004. */
  code: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  category: PartnerCategory;
  tier: PartnerTier;
  status: PartnerStatus;
  /** Stations sold in the trailing 12 months — drives the tier. */
  stationsTrailing12mo: number;
  totalCommissionEarned: number;
  totalCommissionPaid: number;
  notes?: string;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export interface PartnerCommission {
  id: string;
  partnerId: string;
  partnerName: string;
  leadId: string;
  leadCode: string;
  leadName?: string;
  stationValue: number;
  tier: PartnerTier;
  ratePct: number;
  amount: number;
  status: CommissionStatus;
  accruedAt: TS;
  paidAt?: TS | null;
}

export interface Vendor {
  id: string;
  /** Human-friendly reference, e.g. LG-VN-0004. */
  code: string;
  name: string;
  category: VendorCategory;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  paymentTerms?: string;
  status: VendorStatus;
  notes?: string;
  totalOrdered: number;
  totalPaid: number;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export interface PoItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  gstPct: number;
}

export interface PurchaseOrder {
  id: string;
  /** Human-friendly reference, e.g. LG-PO-000012. */
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: PoStatus;
  items: PoItem[];
  subtotal: number;
  gst: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  /** Which project/station this procurement is for, if any. */
  linkedProjectId?: string | null;
  linkedProjectCode?: string | null;
  expectedDeliveryAt?: TS;
  receivedAt?: TS | null;
  notes?: string;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export interface VendorPayment {
  id: string;
  poId: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
  status: VendorPaymentStatus;
  paidAt: TS;
  note?: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

export interface Asset {
  id: string;
  /** Human-friendly reference, e.g. LG-AS-000012. */
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber?: string;
  status: AssetStatus;
  /** Purchase cost, excl. GST — the depreciable base. */
  cost: number;
  purchaseDate: TS;
  method: DepreciationMethod;
  /** Straight-line: years to fully depreciate. WDV: % of remaining book value written off each year. */
  usefulLifeYears?: number;
  wdvRatePct?: number;
  salvageValue: number;
  vendorId?: string | null;
  vendorName?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  linkedProjectId?: string | null;
  linkedProjectCode?: string | null;
  warrantyUntil?: TS;
  notes?: string;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export interface AppNotification {
  id: string;
  uid: string;
  title: string;
  body: string;
  leadId?: string | null;
  read: boolean;
  createdAt: TS;
}

export interface FollowupTask {
  id: string;
  leadId: string;
  leadCode: string;
  leadName?: string;
  type: FollowupType;
  title: string;
  notes?: string;
  ownerId: string;
  ownerName: string;
  priority: FollowupPriority;
  status: FollowupStatus;
  dueAt: TS;
  outcome?: string;
  completedAt?: TS | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

export interface SequenceStep {
  dayOffset: number;
  type: FollowupType;
  title: string;
  notes?: string;
}

export interface FollowupSequence {
  id: string;
  name: string;
  active: boolean;
  steps: SequenceStep[];
  createdAt: TS;
  createdBy?: Actor | null;
}

export interface DashboardStat {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative" | "warn";
}


// ---------------------------------------------------------------------------
// Projects — execution after a deal closes
// ---------------------------------------------------------------------------

export interface ProjectClient {
  name: string;
  phone: string;
  email?: string;
  company?: string;
}

export interface ProjectSite {
  locationName: string;
  address?: string;
  city: string;
  state?: string;
  mapsLink?: string;
  lat?: number | null;
  lng?: number | null;
  locationTypes?: LocationType[];
  landType?: LandType | null;
  ownerType?: OwnerType | null;
  spaceAvailableSqft?: number | null;
}

/**
 * One parallel strand of delivery. Civil can be finished while DISCOM is still
 * pending, so each carries its own status, dates, vendor and progress rather
 * than collapsing into a single project stage.
 */
export interface ProjectWorkstream {
  key: Workstream;
  label: string;
  status: TaskStatus;
  progressPct: number;
  vendor?: string;
  vendorPhone?: string;
  plannedStart?: TS;
  plannedEnd?: TS;
  actualStart?: TS;
  actualEnd?: TS;
  cost?: number | null;
  note?: string;
}

/** The electricity connection — usually the long pole on an EV project. */
export interface DiscomInfo {
  stage: DiscomStage;
  connectionType?: ConnectionType | null;
  sanctionedLoadKva?: number | null;
  consumerNumber?: string;
  applicationNo?: string;
  demandNoteAmount?: number | null;
  discomName?: string;
  note?: string;
  appliedAt?: TS;
  energisedAt?: TS;
}

export interface Project {
  id: string;
  code: string;
  ownership: ProjectOwnership;
  name: string;
  stage: ProjectStage;
  status: ProjectStatus;
  /** Absent on company-owned projects — there is no franchisee. */
  client?: ProjectClient | null;
  site: ProjectSite;
  config: ConfigItem[];
  extras?: ExtraItem[];
  discount?: number;
  /** Investment for a franchise; capital outlay for a COCO station. */
  value: number;
  totalKw: number;
  unitCount: number;
  capexBudget?: number | null;
  capexSpent?: number | null;
  workstreams: Record<Workstream, ProjectWorkstream>;
  discom: DiscomInfo;
  managerId: string;
  managerName: string;
  /** The won lead this was converted from, when there is one. */
  sourceLeadId?: string | null;
  sourceLeadCode?: string | null;
  targetLiveAt?: TS;
  liveAt?: TS;
  note?: string;
  createdAt: TS;
  createdBy: Actor;
  updatedAt: TS;
  updatedBy?: Actor;
  search?: string[];
  /** Soft-deleted projects are hidden from normal views but recoverable from Trash. */
  deletedAt?: TS | null;
  deletedBy?: Actor | null;
}

// ---------------------------------------------------------------------------
// Application settings
// ---------------------------------------------------------------------------

/**
 * Everything an admin can change without a developer. Stored as a single
 * document so one read gives the whole configuration.
 */
export interface AppSettings {
  company: {
    legalName: string;
    shortName: string;
    address: string;
    gstin: string;
    cin: string;
    email: string;
    phone: string;
    website: string;
    logoUrl: string;
  };
  bank: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
  };
  loi: {
    tenureYears: number;
    payoutMonths: number;
    signatory: string;
    arbitrationSeat: string;
    jurisdiction: string;
    scopeItems: string[];
    closing: string;
  };
  finance: {
    defaultGstPct: number;
    loanToValue: number;
    defaultInterestRate: number;
    defaultTenureYears: number;
  };
  /** Extra options appended to the built-in dropdowns. */
  lists: {
    chargerOems: string[];
    banks: string[];
    discoms: string[];
    vendors: string[];
  };
  updatedAt?: TS;
  updatedBy?: Actor;
}

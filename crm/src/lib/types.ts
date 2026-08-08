import type { Timestamp } from "firebase/firestore";
import type {
  ActivityType, DocKind, DocStatus, EoiStatus, FundingMode, LeadStatus, LeadType,
  LoanStage, LocationType, Ownership, PaymentMilestone, PaymentMode, PaymentStatus,
  PowerLoad, RejectionReason, Role, Source, Stage,
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
  ownership?: Ownership | null;
  commercialModelInterested?: boolean;
  powerLoad?: PowerLoad | null;
  sanctionedLoadKva?: number | null;
  spaceAvailableSqft?: number | null;
  frontageMeters?: number | null;
  nearbyLandmark?: string;
  remarks?: string;
}

export interface RejectionInfo {
  reason: RejectionReason;
  note?: string;
  at: TS;
  by: Actor;
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
   * Site ↔ franchise pairing. A landowner's site enquiry can be matched to the
   * investor who will fund it, and vice versa, so both sides of a deal are
   * reachable from either record.
   */
  linkedLeadId?: string | null;
  linkedLeadCode?: string | null;
  linkedLeadName?: string | null;
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
}

export interface DashboardStat {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative" | "warn";
}

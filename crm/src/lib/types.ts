import type { Timestamp } from "firebase/firestore";
import type {
  ActivityType, DocKind, DocStatus, LeadStatus, LeadType, LocationType,
  Ownership, PaymentMilestone, PaymentMode, PaymentStatus, PowerLoad,
  RejectionReason, Role, Source, Stage,
} from "./constants";
import type { ConfigItem, Quote } from "./pricing";

/** Firestore returns Timestamp; freshly-written local docs may hold null. */
export type TS = Timestamp | null;

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  /** Admin this agent reports to. */
  managerId?: string | null;
  region?: string | null;
  active: boolean;
  photoURL?: string | null;
  createdAt: TS;
  createdBy?: string | null;
  lastLoginAt?: TS;
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
  discount?: number;
  /** Denormalised quote snapshot so lists/reports never recompute. */
  quote?: Pick<Quote, "subtotal" | "discount" | "gst" | "grandTotal" | "totalKw" | "unitCount"> | null;
  /** Grand total incl. GST — the single number reports sort and sum on. */
  value: number;
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

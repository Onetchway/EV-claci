import type { Timestamp } from "firebase/firestore";
import type { AgreementClause } from "./agreement-template";
import type {
  ActivityType, AgreementPaymentModel, AgreementScheduleKey, AgreementSiteHolder, AgreementStatus, AssetCategory, AssetStatus, ChargingScheduleStatus,
  CommercialModel, CommissionStatus,
  ComplaintCategory, ComplaintPriority, ComplaintStatus,
  ConnectionType, DepreciationMethod, DiscomStage, DocKind, DocStatus, EoiStatus,
  FollowupPriority, FollowupStatus, FollowupType, FundingMode, GstType, LandType,
  LeadStatus, LeadType, LoanStage, LocationType, Ownership, OwnerType,
  PartnerCategory, PartnerStatus, PartnerTier, PaymentMilestone, PaymentMode,
  EmspUserType, InvoiceBillToType, InvoiceStatus, PaymentStatus, PoStatus, PowerLoad,
  PayslipStatus, ProformaInvoiceStatus, ProjectOwnership, ProjectStage, ProjectStatus, QuotationStatus, RejectionReason,
  RfidTokenStatus, Role, SiteType, Source, Stage, TariffPricingType, TariffScope,
  TaskStatus, TicketFaultClass, TicketStatus, TicketType, VendorCategory, VendorPaymentStatus, VendorStatus,
  WebhookEvent, WeekDay, Workstream,
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
  /** Job title, e.g. "Sales Manager - North" — free text, set from HRMS → Employees. */
  designation?: string;
  /** Which Department doc (see the `departments` collection) this person belongs to — set from HRMS → Employees. */
  departmentId?: string | null;
  /** Which OfficeLocation (see `officeLocations`, also used for attendance geofencing) this person is based at — set from HRMS → Employees. */
  officeLocationId?: string | null;
  region?: string | null;
  active: boolean;
  photoURL?: string | null;
  /** No orgId = the default (Livanto's own) organisation. Set only for a white-label tenant's team members. */
  orgId?: string | null;
  /** Per-user page-access override, keyed by page path — takes priority over the role-based default from roleAccessPolicy. true = always allow this page for this user regardless of role; false = always deny even if their role would normally allow it. A path absent here just falls through to the role policy. Super Admin only, set from Team & Roles. */
  pageAccessOverrides?: Record<string, boolean>;
  /** Exempt from the office geofence on attendance check-in/out — Admin/Super Admin always are regardless of this flag; set here for anyone else who needs to check in from anywhere (a field sales lead, a traveling manager). */
  bypassGeofence?: boolean;
  /** HR access to HRMS (attendance/roster/leave) org-wide, same reach as Admin there, without granting the ADMIN role itself. Sales Managers can already approve/mark/edit for their own direct reports (see managerId) — this is for someone whose job is HR specifically, across every team. */
  hrmsAdmin?: boolean;
  /** Whether this person is expected to check in/out at all — off by default is wrong for a normal employee, so undefined means required. Turn off for someone HRMS genuinely doesn't apply to (a channel partner contact, a board member with CRM access, etc.); they drop out of the header check-in control and the Team/Roster/leave-quota views. */
  attendanceRequired?: boolean;
  /** HR-assigned employee code, e.g. "LG-EMP-001" — free text, set by hand from Employees, the same way PAN/UAN/PF numbers are set from the Salary form. Printed on the payslip as "Employee ID"; snapshotted onto each Payslip at generation time (see Payslip.employeeCode). */
  employeeCode?: string | null;
  /** Set when this account was deleted (DELETE /api/users/[uid]) — the Firebase Auth credential is gone, but the profile row is kept so historical leads/activity still show a real owner name. Hidden from Team & Roles' main list by default. */
  deletedAt?: TS | null;
  createdAt: TS;
  createdBy?: string | null;
  lastLoginAt?: TS;
}

/**
 * A white-label tenant — the foundation for reselling this CRM under
 * another company's branding. Deliberately additive-only for now: nothing
 * else in the schema is scoped by orgId yet (no data isolation between
 * organisations), so every existing lead/charger/etc. is implicitly
 * shared/visible regardless of which org a user belongs to. Real
 * multi-tenant data isolation — every collection scoped and rule-enforced
 * per orgId — is a separate, larger migration, not done here.
 */
export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColorHex?: string;
  /** Stored for future DNS/routing setup — not yet actively used to route traffic. */
  customDomain?: string;
  /** Charger quota for this tenant, by power type — undefined/0 = unlimited. Enforced at registration (registerCharger), counting this org's own active chargers of that type. The default (non-white-label) organisation is never quota-checked. */
  acLicenseTotal?: number;
  dcLicenseTotal?: number;
  /**
   * This tenant's own Razorpay account — set to receive wallet top-ups
   * (see api/payments/razorpay/order and /verify) directly into their own
   * account instead of the platform's, for an EMSP user/corporate account
   * whose orgId matches. keyId is safe to expose to any signed-in reader
   * (it's what Razorpay's own client-side Checkout widget requires
   * publicly) — deliberately NOT where the secret lives. The matching
   * key SECRET is stored in the separate organizationPaymentSecrets
   * collection, which the client SDK can never read (see firestore.rules)
   * — setting it goes through api/organizations/[id]/payment-secret, a
   * write-only endpoint that never returns the existing value back.
   * Unset keyId = this tenant's payments run on the platform's own
   * Razorpay account, same as before this existed.
   */
  razorpayKeyId?: string;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
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
  /** A government/scheme subsidy reducing the investor's own contribution — independent of any bank loan. */
  subsidyEnabled?: boolean;
  subsidyAmount?: number | null;
  subsidyPct?: number | null;
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
  /** Site facts pulled from the lead's Site details tab at generation time, so the letter reflects exactly what was configured — not re-typed by hand. */
  siteLocationProvider?: string;
  siteMapsLink?: string;
  siteCompensation?: string;
  siteLandType?: string;
  /** True when the lead's Funding tab has a loan mode other than SELF. */
  loanOpted?: boolean;
  /** Amount to be bank-financed, from the lead's Funding tab. 0 if self-funded or not yet financed. */
  amountFinanced?: number;
  /** What the investor pays out of pocket once the bank's share (and any subsidy) is netted out. Only meaningful when loanOpted. */
  clientPayment?: number;
  /** Set only when the lead's Funding tab has a subsidy enabled. */
  subsidyAmount?: number;
  subsidyPct?: number;
  /** Per-unit earning assumptions from the site's tariff fields — set only where the lead has them. */
  sellingRatePerKwh?: number;
  discomRatePerKwh?: number;
  siteOwnerSharePerKwh?: number;
  livantoEarningPerKwh?: number;
  franchiseEarningPerKwh?: number;
  b2bRatePerKwh?: number;
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
  /** Whether the Tenure is extendable by mutual written agreement — defaults true, sourced from the lead's site details at generation time. */
  tenureExtendable: boolean;
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
  /** Set only when the investor accepted it themselves from the portal (see api/portal/[leadId]/eoi-accept) — absent when acceptedAt was set some other way (e.g. staff moving the status by hand from the panel). */
  acceptedBy?: PortalAcceptance;
}

/** A superseded LOI, archived to leads/{id}/eoiVersions the moment it's replaced by a regenerated one — so a letter a signatory already saw stays retrievable and reprintable even after the client's details or the config change and a fresh one is issued. */
export interface EoiVersion extends EoiDoc {
  id: string;
  archivedAt: TS;
  archivedBy: Actor;
}

/** One priced line on the Agreement's Schedule II, Part A (Charging Station) or Part B (Infrastructure Works) — auto-seeded from the lead's own quotation (which already splits each charger into an Equipment line and an Electrical & Civil Work line), then freely editable. */
export interface AgreementBomRow {
  id: string;
  description: string;
  /** Make/model/serial number — blank at draft time; filled in at delivery, same as the source template's own [Serial No.] placeholder. */
  serialNo: string;
  qty: number;
  /** GST-exclusive. */
  value: number;
  gstPct: number;
}

/**
 * The Franchise and Operation Agreement. The 27 clause bodies and recitals
 * are the fixed legal language of the standard template
 * (src/lib/agreement-template.ts), seeded as an editable per-lead copy;
 * Schedule I (site/commercial particulars) and Schedule II (the Bill of
 * Material and Total Consideration) vary deal to deal. Schedules III and IV
 * (AMC/O&M scope and warranty terms) are fixed boilerplate, never edited per
 * lead, so they aren't modelled as data here — see AGREEMENT_SCHEDULE_III /
 * AGREEMENT_SCHEDULE_IV in agreement-template.ts.
 */
export interface AgreementDoc {
  number: string;
  status: AgreementStatus;
  issuedDate: TS;
  /** Schedule I, Part A's Site Holder tick-box — who owns/leases/controls the Site. Governs Clauses 2.3, 5.6, 7.1, 7.6, 8.1, 18.2, 19.2, 19.3 and 21.9, all of which are drafted to read correctly under either value without needing per-scenario clause text. */
  siteHolder: AgreementSiteHolder;
  /** Schedule I, Part C's Selected Payment Model tick-box — Model A (Fixed Payment, Clause 9.3 only), Model B (Revenue Share, Clause 9.4, with Clause 9.5 if a Minimum Assured Amount is set) or Model C (Fixed Payment then Revenue Share, both clauses in sequence). */
  paymentModel: AgreementPaymentModel;
  /** Recitals and clause text, seeded from the standard template at draft time but editable per lead thereafter — falls back to the compiled template (agreement-template.ts) when unset, for agreements drafted before this existed. */
  recitals?: string[];
  clauses?: AgreementClause[];
  scheduleI: Partial<Record<AgreementScheduleKey, string>>;
  /** Schedule II, Part A — the Charging Station (charger equipment) items. */
  chargingStationItems: AgreementBomRow[];
  /** Schedule II, Part B — the Infrastructure Works items (civil, electrical, DISCOM, installation, statutory, signage), funded by and belonging to the Franchisee. */
  infrastructureItems: AgreementBomRow[];
  createdAt: TS;
  createdBy?: Actor;
  updatedAt?: TS;
  updatedBy?: Actor;
  issuedBy?: Actor | null;
  /** Set only when the investor accepted it themselves from the portal (see api/portal/[leadId]/agreement-accept) — distinct from SIGNED, which is staff later recording that the fully executed document was collected. */
  acceptedAt?: TS;
  acceptedBy?: PortalAcceptance;
}

/** A superseded Agreement, archived to leads/{id}/agreementVersions the moment it's replaced by a regenerated one — same reasoning as EoiVersion. */
export interface AgreementVersion extends AgreementDoc {
  id: string;
  archivedAt: TS;
  archivedBy: Actor;
}

export interface Actor {
  uid: string;
  name: string;
  role: Role;
}

/**
 * Who accepted an EOI/Agreement from the investor portal — deliberately not
 * an `Actor`: that type's `role` field is a CRM `Role`, which doesn't fit a
 * phone/OTP-authenticated investor (see lib/portal-auth.tsx — this
 * principal never holds a CRM role at all). Set only by the trusted
 * server-side accept route (api/portal/[leadId]/eoi-accept,
 * .../agreement-accept), never written by the investor's client directly.
 */
export interface PortalAcceptance {
  name: string;
  /** +91XXXXXXXXXX, from the investor's verified phone-auth session. */
  phone: string;
}

/** A delivery address distinct from the billed party — set only when shipToEnabled is true on the document. */
export interface ShipToInfo {
  name?: string;
  address?: string;
  gstin?: string;
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
  /** Individual investors have no company/PAN/GST to collect; a Firm does. Unset (older leads) is treated as Individual. */
  entityType?: "INDIVIDUAL" | "FIRM";
  /** Title used on generated letters (Mr./Ms./Mrs.) — never guessed from the name, since that's unreliable. Unset defaults to Mr. */
  salutation?: "Mr." | "Ms." | "Mrs." | null;
}

export interface SiteInfo {
  locationName?: string;
  /** Full postal address of the site — distinct from locationName (a short name/label) and separate from the client's own address, since the charger installs at the site, not necessarily where the client lives/registers. Used as-is when the Letter of Intent is (re)generated. */
  address?: string;
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
  /** Who provides the site: the investor's own premises, or one Livanto sources/arranges. */
  locationProvider?: "SELF" | "LIVANTO" | null;
  /** How the site host is compensated for hosting — a flat monthly rental, or a cut of session revenue. */
  compensationType?: "RENTAL" | "REVENUE_SHARE" | null;
  /** ₹/month if compensationType is RENTAL, a percentage if REVENUE_SHARE. */
  compensationAmount?: number | null;
  /** What this site pays its DISCOM per kWh — varies state to state and DISCOM to DISCOM, so it's negotiated per site rather than assumed from the catalogue. */
  electricityRatePerKwh?: number | null;
  /** What the customer is charged per kWh at this site (retail rate — the separate B2B rate below is a different pricing track). */
  sellingRatePerKwh?: number | null;
  /** The site host's cut, ₹/kWh — separate from any flat rental/revenue-share compensation above. */
  siteOwnerSharePerKwh?: number | null;
  /** Livanto's own margin, ₹/kWh. */
  livantoEarningPerKwh?: number | null;
  /** Bulk/B2B customer rate, ₹/kWh — priced separately from the retail selling rate above. */
  b2bRatePerKwh?: number | null;
  /** Lease/hosting agreement tenure, in years. */
  tenureYears?: number | null;
  /** Manually agreed payout period, in months from Commercial Commissioning — overrides the pricing engine's own assured-payout figures on both the EOI and the Agreement when set. */
  payoutMonths?: number | null;
  /** Manually agreed minimum assured monthly amount (₹) — overrides the pricing engine's computed figure on both the EOI and the Agreement when set. */
  minMonthlyPayout?: number | null;
  /** Whether the Tenure is extendable by mutual written agreement — feeds the phrasing on both the EOI and the Agreement's Schedule I. Unset defaults to true (the long-standing behaviour). */
  tenureExtendable?: boolean | null;
}

/**
 * One location offered by a Site Partner — same shape as a Franchise
 * lead's own `site` field, so mapping a location onto a lead is a
 * straight copy. A partner (an individual, or a company like BSES)
 * commonly offers several locations at once, so these live as an array
 * on the partner doc rather than one-lead-per-location.
 */
export interface SiteLocation extends SiteInfo {
  id: string;
  /** AVAILABLE until a Franchise lead is actually built on it. */
  status: "AVAILABLE" | "MAPPED" | "REJECTED";
  linkedLeadId?: string | null;
  linkedLeadCode?: string | null;
  createdAt: TS;
}

/**
 * A person or company offering one or more locations for a charging
 * station — separate from the Leads pipeline (Site Enquiries used to be
 * a filtered view of type=SITE leads; a partner offering many locations
 * at once no longer means creating a lead per location).
 */
export interface SitePartner {
  id: string;
  /** Human-friendly reference, e.g. LG-SP-000012. */
  code: string;
  contactName: string;
  phone: string;
  email?: string;
  /** e.g. "BSES" when one company is offering many locations at once. */
  company?: string;
  city?: string;
  state?: string;
  address?: string;
  source: Source;
  sourceDetail?: string;
  notes?: string;
  status: "ACTIVE" | "INACTIVE";
  ownerId: string;
  ownerName: string;
  locations: SiteLocation[];
  tags?: string[];
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
  deletedAt?: TS | null;
  deletedBy?: Actor | null;
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

/** One lead folded into another via mergeLeads() — kept so the surviving lead's detail page can still read the merged-in lead's payments/documents/EOI history/activity trail, which stay physically on that lead's own subcollections (moving them would spoof who actually created/verified/archived each one). */
export interface MergedLeadRef {
  id: string;
  code: string;
  name: string;
  ownerId: string;
}

/**
 * Bank account the investor gives us for a refund — submitted by them
 * directly from the portal (leads/{leadId}/investorBankDetails, one doc,
 * id "current"), never something CRM staff type in on their behalf. Kept
 * as its own small subcollection rather than fields on Lead so the
 * Firestore write rule granting the investor a narrow, validated write can
 * stay completely separate from (and can't accidentally widen) the main
 * lead document's much more permissive staff-only update rule.
 */
export interface InvestorBankDetails {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch?: string;
  chequeUrl?: string;
  chequeStoragePath?: string;
  submittedAt: TS;
}

/** A contact/support request an investor raises from the portal (see /portal) — routed to that lead's own sales owner, who gets an in-app notification and a card on both the lead page and the CRM Dashboard. */
export interface PortalSupportRequest {
  id: string;
  leadId: string;
  leadCode: string;
  ownerId: string;
  ownerName: string;
  investorName: string;
  investorPhone: string;
  subject: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  reply?: string;
  createdAt: TS;
  resolvedAt?: TS | null;
  resolvedBy?: Actor | null;
}

export interface Lead {
  id: string;
  /** Human-friendly reference, e.g. LG-FR-000142. */
  code: string;
  type: LeadType;
  stage: Stage;
  status: LeadStatus;
  client: ClientInfo;
  /** `client.phone` in +91 E.164 form — kept in sync automatically (see createLead/updateLead) so the phone/OTP investor portal can match a signed-in Firebase Phone Auth user against their own lead(s) without re-deriving the format at read time. */
  investorPhoneE164?: string | null;
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
  /** The generated Franchise Agreement, once one exists. */
  agreement?: AgreementDoc | null;
  /**
   * Site ↔ franchise pairing, many-to-many. An investor can back several
   * franchises over time, and a landowner can offer several sites; every link
   * is recorded on both sides, so either record reaches all its counterparts.
   */
  linkedLeads?: LinkedLeadRef[];
  /** Other leads whose data was folded into this one via a duplicate merge. */
  mergedFrom?: MergedLeadRef[];
  /** Set on the losing side of a merge — the surviving lead. This lead is also trashed (deletedAt/deletedBy set) at the same time. */
  mergedInto?: { leadId: string; leadCode: string; at: TS; by: Actor } | null;
  /**
   * Set when staff have confirmed this lead sharing a phone/email/GSTIN/PAN
   * with another lead is a real, separate case (e.g. the same investor
   * buying a second franchise later) rather than an accidental duplicate
   * entry — excludes it from duplicate detection entirely.
   */
  duplicateOverride?: { note?: string; by: Actor; at: TS } | null;
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
  /** Set once a legacy type=SITE lead has been imported into the Site Partners module, so re-running the import doesn't duplicate it. */
  migratedToSitePartnerId?: string | null;
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

export interface PaymentAttachment {
  fileName: string;
  storagePath: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: TS;
  uploadedBy: Actor;
}

export interface Payment {
  id: string;
  leadId: string;
  milestone: PaymentMilestone;
  /** Amount excluding GST. */
  baseAmount: number;
  /** GST rate applied, as a fraction (0.05 = 5%). Defaults to the charger GST rate on older entries that predate this field. */
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
  /** Proof of payment — screenshots, UTR slips, cheque photos — attached after the fact. */
  attachments?: PaymentAttachment[];
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
  deletedAt?: TS | null;
  deletedBy?: Actor | null;
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
  /** Bank details for paying this vendor — printed on the PO so payment can be made straight from it. */
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  paymentTerms?: string;
  status: VendorStatus;
  notes?: string;
  totalOrdered: number;
  totalPaid: number;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
  deletedAt?: TS | null;
  deletedBy?: Actor | null;
}

export interface PoItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  gstPct: number;
  /** HSN (goods) or SAC (services) code — optional free text, since the applicable code is a call for the vendor/accountant, not something this app should assert. */
  hsnCode?: string;
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
  /** Freeform terms & conditions printed on the order — payment terms, warranty, delivery conditions, etc. */
  terms?: string;
  /** IGST (inter-state) or CGST+SGST (intra-state) — same total tax, different breakdown on the printed order. Defaults to IGST when unset (pre-existing orders). */
  gstType?: GstType;
  shipToEnabled?: boolean;
  shipTo?: ShipToInfo | null;
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

/**
 * A client-facing quotation — hardware (chargers, priced via the same
 * catalogue/pricing engine as a lead's quote) and/or EPC service lines
 * (civil work, electrical installation, O&M...). Optionally linked to a
 * lead, but stands alone for a walk-in enquiry that isn't a lead yet — the
 * client details are a snapshot at creation, editable independently
 * thereafter, the same way a PO snapshots vendorName off the vendor record.
 */
export interface Quotation {
  id: string;
  /** Human-friendly reference, e.g. LG-QT-000012. */
  quoteNumber: string;
  status: QuotationStatus;
  leadId?: string | null;
  leadCode?: string | null;
  client: ClientInfo;
  items: ConfigItem[];
  extras: ExtraItem[];
  discount: number;
  /** Snapshot of the computed totals at last save — the printed document's source of truth. */
  totals: Pick<Quote, "subtotal" | "discount" | "taxableValue" | "gst" | "grandTotal" | "effectiveGstPct" | "totalKw" | "unitCount">;
  validUntil?: TS;
  notes?: string;
  /** IGST (inter-state) or CGST+SGST (intra-state) — same total tax, different breakdown on the printed document. Defaults to IGST when unset (pre-existing quotations). */
  gstType?: GstType;
  shipToEnabled?: boolean;
  shipTo?: ShipToInfo | null;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

/**
 * A Proforma Invoice — a formal pre-sale bill sent before the actual tax
 * Invoice, so a client can arrange payment/import approvals against fixed
 * numbers. Same shape as a Quotation (same pricing engine, same client
 * snapshot) but with its own numbering series and status lifecycle since
 * it's a distinct document with its own paper trail, not just a quotation
 * relabeled.
 */
export interface ProformaInvoice {
  id: string;
  /** Human-friendly reference, e.g. LG-PI-000012. */
  piNumber: string;
  status: ProformaInvoiceStatus;
  leadId?: string | null;
  leadCode?: string | null;
  quotationId?: string | null;
  quoteNumber?: string | null;
  client: ClientInfo;
  items: ConfigItem[];
  extras: ExtraItem[];
  discount: number;
  /** Snapshot of the computed totals at last save — the printed document's source of truth. */
  totals: Pick<Quote, "subtotal" | "discount" | "taxableValue" | "gst" | "grandTotal" | "effectiveGstPct" | "totalKw" | "unitCount">;
  validUntil?: TS;
  notes?: string;
  /** IGST (inter-state) or CGST+SGST (intra-state) — same total tax, different breakdown on the printed document. Defaults to IGST when unset (pre-existing proforma invoices). */
  gstType?: GstType;
  shipToEnabled?: boolean;
  shipTo?: ShipToInfo | null;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

/**
 * Opened by the OCPP server itself (offline sweep, Faulted status) or
 * manually by a team member. The server's writes bypass Firestore rules
 * via the Admin SDK — everything from here on (assignment, status, SLA
 * tracking) is normal CRM territory.
 */
export interface TicketPart {
  name: string;
  costInr: number;
}

export interface Ticket {
  id: string;
  chargePointId: string;
  type: TicketType;
  status: TicketStatus;
  description: string;
  /** A finer fault taxonomy than `type` — set by whoever investigates, not auto-detected. */
  faultClass?: TicketFaultClass | null;
  /** Set when ocpp-server tried a non-disruptive Reset(OnIdle) before opening this FAULT ticket — lets a technician know a basic recovery was already ruled out. */
  autoRecoveryAttempted?: boolean;
  assignedTo?: Actor | null;
  openedAt: TS;
  slaDueAt?: TS;
  /** Set once by the SLA-breach sweep (workflow automation) — a SUPER_ADMIN escalation notification/webhook only fires once per breach. */
  slaEscalatedAt?: TS | null;
  photoUrls?: string[];
  parts?: TicketPart[];
  /** Labour/misc repair cost, excluding parts (parts total is derived from `parts`). */
  repairCostInr?: number;
  /** Set when a technician re-checks the charger is actually working before closing — distinct from just marking RESOLVED. */
  verifiedAt?: TS | null;
  verifiedBy?: Actor | null;
  resolvedAt?: TS | null;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

/** A customer/driver-initiated complaint — billing, app behavior, service quality — distinct from a charger-fault Ticket, which is opened automatically or by ops staff against a specific charger. */
export interface Complaint {
  id: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  subject: string;
  description: string;
  /** Free text if the complainant isn't a registered EMSP user (e.g. phoned in). */
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  /** Set when the complainant is a registered driver — matched by phone/email against emspUsers at log time — links back to their wallet/session history. */
  emspUserId?: string | null;
  relatedChargerId?: string | null;
  /** Denormalized from the charger's zone at log time, so complaints can be filtered/reported on by city without a join. */
  city?: string | null;
  relatedSessionId?: string | null;
  assignedTo?: Actor | null;
  /** Staff tagged for visibility/help beyond the single assignee — each gets an email notification when tagged. */
  taggedTo?: Actor[];
  resolutionNotes?: string;
  resolvedAt?: TS | null;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
}

/** An RFID/tag the OCPP server's Authorize handler will accept. */
export type RfidActivationScope = "GLOBAL" | "ZONE" | "CHARGER";

export interface RfidToken {
  id: string;
  idToken: string;
  label: string;
  status: RfidTokenStatus;
  /** Where this card is valid to Authorize at — GLOBAL (default, matches prior behavior), a specific site (ZONE), or specific chargers (CHARGER). */
  activationScope?: RfidActivationScope;
  scopeZoneId?: string | null;
  scopeChargerIds?: string[];
  description?: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** A future-dated RequestStartTransaction — depot/fleet charging scheduled ahead of time (e.g. overnight) instead of a walk-up tap. The OCPP server sweeps for due schedules and fires the remote start itself; the CRM only ever creates/cancels. */
export interface ChargingSchedule {
  id: string;
  chargerId: string;
  evseId: number;
  vehicleId?: string | null;
  vehicleRegNumber?: string | null;
  fleetId?: string | null;
  /** Resolved once at creation time, not re-looked-up at trigger time — a card reassigned after scheduling shouldn't silently change who this session bills to. */
  idToken: string;
  idTokenLabel?: string;
  scheduledStartAt: TS;
  status: ChargingScheduleStatus;
  triggeredAt?: TS | null;
  failReason?: string | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** Local-time-of-day window a tariff applies in, e.g. peak/off-peak. Minutes are minutes-from-midnight, server local time. */
export interface TariffTimeWindow {
  /** 0=Sunday..6=Saturday. Empty = every day. */
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
}

/**
 * A charging-session pricing rule. Resolved by chargePointId + time at
 * session-end by the OCPP server (ocpp-server/src/tariff.ts mirrors this
 * resolution logic — no shared package between the two repos, so keep them
 * in sync deliberately when editing either).
 */
export interface Tariff {
  id: string;
  name: string;
  scope: TariffScope;
  /** Only used when scope === "SPECIFIC_CHARGERS". */
  chargerIds: string[];
  /** Only used when scope === "SPECIFIC_CONNECTORS" — each entry is "chargerId#connectorId". */
  connectorKeys: string[];
  /** Only used when scope === "ZONE". */
  zoneIds: string[];
  /** Only used when scope === "CITY" — matches a charger's zone.city. */
  cities: string[];
  /** Only used when scope === "STATE". */
  states: string[];
  /** Only used when scope === "FLEET" — matches the vehicle's fleetId (traced via the session's id token → its RFID card → the vehicle it's assigned to). */
  fleetIds: string[];
  /** Only used when scope === "USER" — matches the session's id token → its RFID card → the EMSP user it's assigned to. */
  emspUserIds: string[];
  /** Only used when scope === "CORPORATE" — matches that EMSP user's corporateAccountId. */
  corporateAccountIds: string[];
  pricingType: TariffPricingType;
  /** ₹ per kWh / per minute / flat per session, excl. GST. */
  rate: number;
  gstPct: number;
  /** Flat ₹ added to every session this tariff prices, excl. GST. */
  platformFeeInr: number;
  /** Flat ₹ charged once a session has any idle time recorded (connected but not drawing charge, past the grace window) — an "overstay" fee, distinct from the per-minute idle fee below. */
  parkingFeeInr?: number;
  /** ₹ per minute spent idle (OCPP chargingState other than "Charging") beyond idleGraceMinutes. */
  idleFeeInrPerMin?: number;
  /** Minutes of idle time forgiven before idleFeeInrPerMin starts accruing. Defaults to 0 if idleFeeInrPerMin is set. */
  idleGraceMinutes?: number;
  timeWindow?: TariffTimeWindow | null;
  /** Tiebreaker when two active rules match with equal specificity — higher wins. */
  priority: number;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

/**
 * A logical grouping of chargers (a site, a building, a feeder) with a
 * sanctioned load cap. Phase 4 scope is monitoring, not control: the OCPP
 * server doesn't yet send SetChargingProfile/ChangeConfiguration to
 * actually throttle a charger, so "load balancing" here means the CRM
 * flags a zone approaching or over its cap — an operator still has to act
 * on it manually (or via the existing remote "Set unavailable" command).
 */
export interface Zone {
  id: string;
  name: string;
  maxLoadKw: number;
  siteType?: SiteType;
  address?: string;
  city?: string;
  pincode?: string;
  state?: string;
  /** Site host's point of contact — the person Settlements/electricity-bill questions actually go to. */
  pocName?: string;
  pocPhone?: string;
  /** The staff user (SITE_OWNER role) who should see only this site — scopes Station Management and Settlements to zones they own. Unset means no SITE_OWNER account is tied to this site yet. */
  ownerUid?: string | null;
  discomName?: string;
  /** Overrides the OCPP server's flat default fault-ticket SLA (FAULT_SLA_HOURS) for chargers in this zone. */
  slaHours?: number;
  /** Whether — and how — each session's total (post-GST) revenue is shared with this site's host/owner. Unset type = no revenue share, nothing accrues. */
  revenueShareType?: RevenueShareType;
  /** % (0-100) for PERCENT/PROFIT_SHARE, flat ₹ per session for FIXED, flat ₹ per session as the guaranteed floor for TIERED_HYBRID, ₹ per kWh delivered for PER_KWH. */
  revenueShareValue?: number;
  /** Only used when revenueShareType is PROFIT_SHARE or TIERED_HYBRID — subtracted (× kWh delivered) from a session's total before the share is computed, so the host is paid on margin, not raw revenue. Unset/0 = no deduction. */
  electricityCostPerKwh?: number;
  /** Only used when revenueShareType is TIERED_HYBRID — the % of session profit (total − electricity cost − the flat floor in revenueShareValue) paid on top of that floor. */
  revenueShareHybridPct?: number;
  /** Guaranteed minimum ₹ the site host receives per calendar month — if the month's accrued share (across all session-level entries, whatever type) falls short, a top-up entry closes the gap. Distinct from TIERED_HYBRID above: this operates monthly in arrears, TIERED_HYBRID computes its floor+upside per session as it happens. */
  revenueShareMinGuaranteeInr?: number;
  /** Which calendar month (YYYY-MM) the guarantee sweep last topped up, so it never double-tops-up the same month. */
  revenueShareGuaranteeMonth?: string;
  /** Other parties who also get a cut of the same session (e.g. a CPO partner, an equipment financier) — on top of the primary site-host share above. */
  additionalRevenueShares?: AdditionalRevenueShare[];
  /** Where a settlement payout to this site actually goes — shown on Settlements, never validated against a real bank. */
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankAccountName?: string;
  bankName?: string;
  /**
   * Cached RazorpayX Contact/Fund Account ids for this site's bank
   * details, created once on the first payout (api/payouts/create) and
   * reused after — avoids re-registering the same beneficiary with
   * Razorpay on every payout run. razorpayFundAccountBankKey is a
   * fingerprint of the bank details that produced these ids
   * (`accountNumber|ifsc`); the payout route recreates the Fund Account
   * whenever the zone's current bank details no longer match it, so
   * editing the bank fields above safely invalidates the cache instead of
   * silently paying out to stale details.
   */
  razorpayContactId?: string;
  razorpayFundAccountId?: string;
  razorpayFundAccountBankKey?: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

/**
 * PROFIT_SHARE: % of (session total − electricity cost), not raw revenue.
 * TIERED_HYBRID: a flat ₹ floor (revenueShareValue) plus revenueShareHybridPct%
 * of whatever profit remains after that floor and electricity cost — a
 * guaranteed-minimum-plus-upside deal computed per session, distinct from
 * the monthly revenueShareMinGuaranteeInr top-up on Zone.
 * PER_KWH: a flat ₹ amount (revenueShareValue) × kWh delivered — a per-unit
 * lease/royalty rate rather than a cut of revenue or profit.
 */
export type RevenueShareType = "PERCENT" | "FIXED" | "PROFIT_SHARE" | "TIERED_HYBRID" | "PER_KWH";
export type RevenueShareStatus = "PENDING" | "PAID";

export interface AdditionalRevenueShare {
  /** Who this cut goes to — e.g. "CPO partner", "Equipment financier". Free text, shown on Settlements to tell recipients apart. */
  name: string;
  type: RevenueShareType;
  value: number;
}

export type RevenueShareKind = "SESSION" | "GUARANTEE_TOPUP";

/**
 * One accrued payout owed to a site host or another revenue-share
 * recipient — written by ocpp-server at the same time a session is billed
 * (see billSession() in registry.ts) for kind "SESSION", or by the
 * monthly guarantee sweep for kind "GUARANTEE_TOPUP". This is the ledger
 * Settlement works off of — CRM never computes the amount itself, only
 * reviews and marks these paid.
 */
export interface SiteRevenueShare {
  id: string;
  zoneId: string;
  zoneName: string;
  /** Which recipient this entry is for — "Site host" for the primary revenueShareType/Value, or an additionalRevenueShares entry's name. */
  recipientName: string;
  kind: RevenueShareKind;
  /** Absent for a GUARANTEE_TOPUP entry (it isn't tied to one session). */
  sessionId?: string;
  chargePointId?: string;
  grossAmountInr: number;
  shareType: RevenueShareType;
  /** The rate that produced shareAmountInr — a % if shareType is PERCENT, the flat ₹ amount itself if FIXED. */
  shareRate: number;
  shareAmountInr: number;
  status: RevenueShareStatus;
  createdAt: TS;
  paidAt?: TS | null;
  /** Set only when paid via the automated RazorpayX payout route, not the manual "mark paid" button. */
  payoutId?: string | null;
  payoutMode?: "AUTO" | "MANUAL";
  paidBy?: string;
}

/** Logged from the Razorpay `payment.failed` webhook — a checkout attempt that never became a wallet top-up, so it's otherwise invisible. */
export interface FailedPayment {
  id: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  amountInr: number;
  errorCode?: string | null;
  errorDescription?: string | null;
  contact?: string | null;
  email?: string | null;
  createdAt: TS;
}

/**
 * A manually-entered DISCOM electricity bill for a site, for the Station
 * Profit figure on Business Insights — there's no meter/utility
 * integration, so this is bookkeeping input, not an automatic pull.
 */
export interface ElectricityBill {
  id: string;
  zoneId: string;
  zoneName: string;
  amountInr: number;
  periodStart: TS;
  periodEnd: TS;
  notes?: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** A corporate customer paying for employee/fleet charging under one account. */
export interface CorporateAccount {
  id: string;
  name: string;
  gstin?: string;
  billingEmail?: string;
  walletBalanceInr?: number;
  /** Which white-label tenant this account belongs to, if any — see Organization.razorpayKeyId. Unset = the platform's own (non-white-label) account. */
  orgId?: string | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** An EMSP (driver-facing) user — distinct from AppUser, which is CRM team login. */
export interface EmspUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: EmspUserType;
  /** Only set when type === "CORPORATE". */
  corporateAccountId?: string | null;
  rfidTokenId?: string | null;
  /** Registered address city/state — the only honest "where is this user" signal available at wallet top-up time (there's no charger/session involved yet), used for city/state-restricted coupons. */
  city?: string | null;
  state?: string | null;
  /** Which white-label tenant this user belongs to, if any — see Organization.razorpayKeyId. Unset = the platform's own (non-white-label) account. */
  orgId?: string | null;
  walletBalanceInr?: number;
  /** Corporate benefit cap — this employee's own session spend, resettable-by-calendar-month, is blocked at the charger (Authorize → NoCredit) once it reaches this. Only meaningful when corporateAccountId is set. */
  monthlyCapInr?: number;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** A staff-created plan an EMSP user can be put on — a monthly wallet debit in exchange for a session discount. */
export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPriceInr: number;
  /** % off every wallet-billed session's total while an active subscription to this plan is in effect. */
  discountPct: number;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
}

export type UserSubscriptionStatus = "ACTIVE" | "CANCELLED";

/**
 * One EMSP user's subscription to a plan. Renewal is automatic (ocpp-server
 * sweeps past-due renewsAt dates and re-debits the wallet, same postpaid
 * philosophy as session billing — see sweepSubscriptionRenewals) unless
 * cancelled first.
 */
export interface UserSubscription {
  id: string;
  emspUserId: string;
  emspUserName: string;
  planId: string;
  planName: string;
  monthlyPriceInr: number;
  discountPct: number;
  status: UserSubscriptionStatus;
  startedAt: TS;
  renewsAt: TS;
  cancelledAt?: TS | null;
  createdBy?: Actor | null;
}

export type WalletOwnerType = "EMSP_USER" | "CORPORATE_ACCOUNT";

/** A logged top-up or debit against an EmspUser's or CorporateAccount's wallet balance. */
export interface WalletTransaction {
  id: string;
  ownerType: WalletOwnerType;
  ownerId: string;
  amountInr: number;
  type: "TOPUP" | "DEBIT" | "REFUND";
  /** The individual EMSP user this debit is attributed to — set on DEBIT rows, may differ from ownerId when a corporate wallet is shared. What monthlyCapInr is measured against. */
  emspUserId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  /** Set on a TOPUP that redeemed a coupon. */
  couponCode?: string;
  /** Bonus credited on top of amountInr from the coupon — amountInr already includes it, this is just for display. */
  couponBonusInr?: number;
  /** Free-text context for a DEBIT that isn't a charging session — e.g. a subscription renewal. */
  note?: string;
  /** Set on a TOPUP once its full amount has been refunded (possibly across multiple partial refunds) — each refund itself is a separate REFUND row referencing this one via refundOfId. */
  refunded?: boolean;
  /** Cumulative amount refunded so far on a TOPUP — supports partial + repeated refunds up to amountInr. */
  refundedAmountInr?: number;
  /** Set on a REFUND row — the id of the TOPUP it refunds. */
  refundOfId?: string;
  razorpayRefundId?: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

export type CampaignAudience = "ALL_EMSP" | "ALL_CORPORATE" | "ALL";

/**
 * A marketing push — an email/in-app-notification blast, a banner shown on
 * driver-facing surfaces, or both. There's no mobile driver app in this
 * codebase yet, so "banner in app" today means the one driver-facing
 * surface that exists: the app-less QR charging page
 * (api/public/banners is what it reads from) — a future driver app would
 * read the same public endpoint.
 */
export interface Campaign {
  id: string;
  name: string;
  audience: CampaignAudience;
  /** Email subject / notification title. */
  subject: string;
  /** Plain-text body — kept simple rather than a rich-text/HTML editor. */
  message: string;
  showAsBanner: boolean;
  bannerImageUrl?: string | null;
  bannerLinkUrl?: string | null;
  startAt?: TS | null;
  endAt?: TS | null;
  active: boolean;
  sentAt?: TS | null;
  sentCount?: number;
  createdAt: TS;
  createdBy?: Actor | null;
}

export type CouponType = "PERCENT" | "FLAT";

/** A wallet top-up promo code — validated and redeemed server-side in /api/payments/razorpay/verify, never trusted from the client. */
export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  /** % (0-100) if type is PERCENT, flat ₹ bonus if type is FLAT. */
  value: number;
  active: boolean;
  maxUses?: number;
  usedCount: number;
  expiresAt?: TS | null;
  /** Restricts redemption to one specific wallet owner ("client-wise") — a targeted promo code rather than a public one. Absent means anyone can redeem it. */
  restrictedToOwnerType?: "EMSP_USER" | "CORPORATE_ACCOUNT" | null;
  restrictedToOwnerId?: string | null;
  restrictedToOwnerName?: string | null;
  /**
   * City/state restriction, checked against the redeeming EMSP user's own
   * registered city/state (EmspUser.city/state) — the only honest location
   * signal a wallet top-up has, since no charger/session is involved.
   * Case-insensitive exact match. A corporate-account top-up has no
   * personal city, so a city/state-restricted coupon can't be redeemed
   * against one.
   */
  restrictedToCity?: string | null;
  restrictedToState?: string | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

export type DiagnosticSeverity = "INFO" | "WARNING" | "CRITICAL";

/** A searchable OEM error-code reference so NOC/support staff can look up what a fault code means and how to resolve it, without waiting on a vendor callback. */
export interface DiagnosticCode {
  id: string;
  code: string;
  vendor: string;
  title: string;
  description?: string;
  likelyCause?: string;
  recommendedAction?: string;
  severity: DiagnosticSeverity;
  createdAt: TS;
  createdBy?: Actor | null;
}

export interface Fleet {
  id: string;
  name: string;
  corporateAccountId?: string | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

export interface Driver {
  id: string;
  fleetId: string;
  name: string;
  phone: string;
  licenseNumber?: string;
  emspUserId?: string | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

export interface Vehicle {
  id: string;
  /** Unset for a vehicle registered directly by an EMSP user (see emspUserId) rather than owned by a fleet. */
  fleetId?: string | null;
  /** Set when this vehicle belongs to an individual (non-fleet) EMSP user who registered it themselves — mutually exclusive with fleetId in practice, though nothing enforces that at the type level. */
  emspUserId?: string | null;
  regNumber: string;
  /** References ev-cars.ts's EV_CAR_CATALOG, or OTHER_CAR_ID for a manual entry. */
  carId: string;
  carLabel: string;
  batteryKwh?: number;
  assignedDriverId?: string | null;
  /** The RFID card that lives in this vehicle — lets the OCPP server attribute a charging session back to a specific vehicle. */
  rfidTokenId?: string | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** A manually logged odometer reading — no telematics integration, so this is the only way to get km driven against a vehicle's charging spend. Cost-per-km is derived (total session cost since the earliest reading ÷ km driven since then), not stored. */
export interface OdometerReading {
  id: string;
  vehicleId: string;
  odometerKm: number;
  readingDate: TS;
  notes?: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

/**
 * A GST invoice covering a set of billed charging sessions. Sessions
 * aren't yet automatically attributed to an EMSP user/corporate account
 * (that needs an RFID-token-to-user link this build doesn't have yet), so
 * an invoice is built by hand-picking which billed sessions in a date
 * range belong to the bill-to party — honest given today's data model,
 * not a fabricated auto-reconciliation.
 */
export interface Invoice {
  id: string;
  /** Human-friendly reference, e.g. LG-INV-000012. */
  invoiceNumber: string;
  status: InvoiceStatus;
  billToType: InvoiceBillToType;
  billToId?: string | null;
  /** Optional white-label tenant this invoice is issued under — when set, the printed invoice uses that Organization's logo instead of the platform's own. */
  organizationId?: string | null;
  billToName: string;
  billToGstin?: string;
  periodStart: TS;
  periodEnd: TS;
  /** chargeSessions doc IDs this invoice covers. */
  sessionIds: string[];
  subtotalInr: number;
  gstInr: number;
  totalInr: number;
  /** HSN (goods) or SAC (services) code shown on the printed invoice — free text, since the applicable code is a call for the customer's CA/accountant, not something this app should assert. */
  hsnSac?: string;
  /** % the bill-to party will deduct as TDS before paying (common for B2B/corporate accounts) — informational, doesn't change totalInr, just what's actually expected to be received. */
  tdsPct?: number;
  tdsInr?: number;
  notes?: string;
  /** IGST (inter-state) or CGST+SGST (intra-state) — same total tax, different breakdown on the printed invoice. Defaults to IGST when unset (pre-existing invoices). */
  gstType?: GstType;
  shipToEnabled?: boolean;
  shipTo?: ShipToInfo | null;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export type CreditDebitNoteKind = "CREDIT" | "DEBIT";

/** A correction against an already-issued invoice — e.g. a billing dispute resolved after the fact — without editing the original invoice's figures. */
export interface CreditDebitNote {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  noteNumber: string;
  kind: CreditDebitNoteKind;
  amountInr: number;
  gstInr: number;
  reason: string;
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
  deletedAt?: TS | null;
  deletedBy?: Actor | null;
}

export interface AppNotification {
  id: string;
  uid: string;
  title: string;
  body: string;
  leadId?: string | null;
  /** Generic link for non-lead notifications (e.g. a ticket) — leadId takes precedence when both are absent-checked. */
  href?: string | null;
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

/** A site-progress photo the project team uploads as work happens — visible to CRM staff and, read-only, to the investor portal for that project's own franchisee. */
export interface ProjectPhoto {
  id: string;
  projectId: string;
  storagePath: string;
  url: string;
  contentType: string;
  size: number;
  caption?: string;
  /** Which workstream/stage this photo documents, if tagged. */
  workstream?: Workstream | null;
  uploadedAt: TS;
  uploadedBy: Actor;
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
    /** Building No: G08-B, Loni Bhopura Road, Ghaziabad, Uttar Pradesh, 201005 — the CIN's registered office. */
    registeredAddress: string;
    /** 8th Floor, Infinity Techno Park, C56A/16, Block-C, Sector 62, Noida, Uttar Pradesh, 201309 — where the team actually works. */
    officeAddress: string;
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
  /** The standalone OCPP central system (ocpp-server/), a separate Cloud Run service. */
  ocpp: {
    /** Host only, no scheme — e.g. "livanto-ocpp-35nnljms4q-as.a.run.app". */
    serverHost: string;
  };
  updatedAt?: TS;
  updatedBy?: Actor;
}

/**
 * A read-only API key for external integrations under /api/v1/*. The raw
 * key is shown once at creation and never stored — only a SHA-256 hash, so
 * this collection is safe to read from the CRM even though it names every
 * key (compare ocpiParties, which hides its bearer tokens entirely).
 */
export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  /** First 8 chars of the raw key, kept for the admin to recognise which key is which without re-showing the secret. */
  prefix: string;
  active: boolean;
  /** Requests/minute this key is capped at — see api/v1/_lib/apikey.ts's checkRateLimit. Defaults to 60 when unset. */
  rateLimitPerMinute?: number;
  /** Optional hard expiry — an expired key is rejected the same as a revoked one, but distinguished in the error message so an integration owner knows to rotate rather than assume they did something wrong. */
  expiresAt?: TS | null;
  lastUsedAt?: TS | null;
  requestCount?: number;
  revokedAt?: TS | null;
  revokedBy?: Actor | null;
  createdAt: TS;
  createdBy?: Actor | null;
}

/**
 * A developer-registered URL that gets a signed POST when one of `events`
 * happens. Dispatched from ocpp-server (the only thing that knows about
 * both events) — see ocpp-server/src/webhooks.ts. Fire-and-forget: a
 * failed delivery is logged, not retried, in this phase.
 */
export interface WebhookSubscription {
  id: string;
  url: string;
  /** Shown once at creation — used to HMAC-sign each delivery (X-Livanto-Signature) so the receiver can verify it came from here. */
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
}

/**
 * A driver's post-charge rating/review, submitted from the app-less QR
 * charging page (see app/charge/[chargerId]/page.tsx) once their own
 * session has ended — never open to anyone who just knows a chargerId, so
 * a review always ties back to a real qrChargeSessions doc. Public read
 * (the QR landing page shows the aggregate + recent comments, same as any
 * consumer charging app), write only via the Admin-SDK-backed
 * api/public/qr-charge/review route.
 */
export interface ChargerReview {
  id: string;
  chargerId: string;
  sessionId: string;
  rating: number;
  comment?: string;
  createdAt: TS;
}

// ---------------------------------------------------------------------------
// HRMS — attendance, geofencing, roster, holidays, leave
// ---------------------------------------------------------------------------

/** A managed department/team an employee can be assigned to (HRMS → Employees), kept as its own small collection rather than free text so it stays a consistent, filterable list. */
export interface Department {
  id: string;
  name: string;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** An office/site an employee can geofence check in/out from. There can be several — different teams sit at different locations. */
export interface OfficeLocation {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  /** Allowed check-in radius around this point, in metres. */
  radiusMeters: number;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "WEEK_OFF" | "HOLIDAY" | "WORK_FROM_HOME";

export interface AttendancePunch {
  at: TS;
  lat: number | null;
  lng: number | null;
  /** The nearest configured office at the time of the punch, whether or not it was actually in range. */
  officeId?: string | null;
  officeName?: string | null;
  distanceMeters?: number | null;
  withinGeofence: boolean;
}

/** One per employee per calendar day — doc id is `${uid}_${yyyy-mm-dd}`. */
export interface AttendanceRecord {
  id: string;
  uid: string;
  userName: string;
  /** yyyy-mm-dd, the employee's local calendar day. */
  date: string;
  status: AttendanceStatus;
  checkIn?: AttendancePunch | null;
  checkOut?: AttendancePunch | null;
  /** Set when an admin/manager marked this record by hand instead of the employee punching in themselves. */
  markedBy?: Actor | null;
  note?: string;
  createdAt: TS;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export interface Holiday {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  name: string;
  createdAt: TS;
  createdBy?: Actor | null;
}

/** One employee's working/week-off pattern for one Monday-starting week — doc id is `${uid}_${weekStart}`. */
export interface RosterWeek {
  id: string;
  uid: string;
  userName: string;
  /** yyyy-mm-dd of that week's Monday. */
  weekStart: string;
  days: Record<WeekDay, "WORKING" | "WEEK_OFF">;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

export interface LeaveType {
  id: string;
  code: string;
  label: string;
  /** Days per calendar year. */
  annualQuota: number;
  active: boolean;
  createdAt: TS;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  uid: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeLabel: string;
  /** yyyy-mm-dd, inclusive. */
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  appliedAt: TS;
  appliedBy?: Actor | null;
  decidedAt?: TS | null;
  decidedBy?: Actor | null;
  decisionNote?: string;
}

/**
 * Shared request+approval shape for two employee-facing exceptions to their
 * attendance record, distinguished by `kind`:
 *  - "WFH": today only (fromDate === toDate === today), asks to be marked
 *    WORK_FROM_HOME instead of needing a geofenced check-in.
 *  - "REGULARIZATION": a date range within last-calendar-month..today, asks
 *    for a correction (e.g. a forgotten punch) with an optional desired
 *    status and backfilled check-in/check-out times.
 * On approval, a manager/admin decision is applied via markAttendance (see
 * db/attendance.ts) once per date in [fromDate, toDate] — this doc itself
 * never writes attendance records directly. Mirrors LeaveRequest's lifecycle
 * shape exactly (see db/leave.ts).
 */
export type AttendanceRequestKind = "WFH" | "REGULARIZATION";
export type AttendanceRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface AttendanceRequest {
  id: string;
  uid: string;
  userName: string;
  kind: AttendanceRequestKind;
  /** yyyy-mm-dd, inclusive. For WFH always equal to toDate and to today. */
  fromDate: string;
  toDate: string;
  reason?: string;
  /** Status to apply on approval — defaults to PRESENT (WFH requests always resolve to WORK_FROM_HOME regardless of this field). */
  desiredStatus?: AttendanceStatus;
  /** "HH:MM", regularization only — optionally backfills a punch time on approval. */
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  status: AttendanceRequestStatus;
  appliedAt: TS;
  appliedBy?: Actor | null;
  decidedAt?: TS | null;
  decidedBy?: Actor | null;
  decisionNote?: string;
}

// ---------------------------------------------------------------------------
// Payroll — salary structure per employee, and the monthly payslips
// generated from it. Kept in its own collection (payrollProfiles) rather than
// bloated onto AppUser, same reasoning as InvestorBankDetails: sensitive
// money/bank data belongs in its own doc with its own access rule, not
// mixed into a record every signed-in user can read.
// ---------------------------------------------------------------------------

/**
 * One per employee — doc id is the employee's uid. Everything a monthly
 * payslip run needs: salary structure, statutory numbers, bank details and
 * the deduction/employer-contribution settings. `ctc` is the HR-entered
 * target figure (shown for reference on the profile editor); the CTC printed
 * on an actual payslip is computed from that month's gross earning plus the
 * employer-side additions, so the two can drift slightly — see
 * computePayslip in db/payroll.ts.
 */
export interface PayrollProfile {
  id: string;
  uid: string;
  panNo?: string;
  uanNo?: string;
  pfNo?: string;
  esiNo?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  dateOfJoining?: TS | null;
  /** HR-entered target CTC (ANNUAL) — reference only, feeds the "Auto-fill from CTC" split/TDS estimate; see the doc comment above. */
  ctc: number;
  basic: number;
  hra: number;
  ta: number;
  others: number;
  misc?: number;
  /** Employee-side EPF deduction %, applied to basic capped at the ₹15,000 PF wage ceiling. Defaults to 12 when unset. */
  epfEmployeePct?: number;
  /** Employer-side EPF contribution (₹/month, informational — "Additional (ER)" on the payslip). Defaults to matching the employee contribution when unset. */
  epfEmployerAmount?: number;
  /** Employee-side ESIC deduction %, applied to gross earning. Unset/0 = not ESIC-applicable (typical once gross crosses the ESIC wage threshold). */
  esicEmployeePct?: number;
  esicEmployerAmount?: number;
  /** Monthly TDS to prefill on a new payslip. The Salary form's "Auto-fill from CTC" button computes this from India's New Tax Regime slabs (see lib/payroll-tax.ts) off the CTC field — a one-way convenience fill, always a plain manually editable number afterward, per payslip, before it's finalized. */
  tdsMonthly?: number;
  gratuityMonthly?: number;
  bonusMonthly?: number;
  healthMonthly?: number;
  active: boolean;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
}

/**
 * One employee's payslip for one calendar month — doc id is auto-generated,
 * `number` is the human-friendly LG-PS-000001 reference. Employee identity
 * and bank/statutory details are snapshotted at generation time (mirrors
 * buildEoiFromLead/buildAgreementFromLead's snapshot-at-draft-time pattern)
 * so a later edit to the employee's PayrollProfile never rewrites an
 * already-issued payslip.
 */
export interface Payslip {
  id: string;
  /** e.g. LG-PS-000001 */
  number: string;
  uid: string;
  employeeName: string;
  /** Snapshotted from AppUser.employeeCode at generation time — see that field's doc comment. Printed on the payslip as "Employee ID". */
  employeeCode?: string | null;
  designation?: string;
  departmentName?: string;
  panNo?: string;
  uanNo?: string;
  pfNo?: string;
  esiNo?: string;
  bankAccountNo?: string;
  /** 1-12 */
  month: number;
  year: number;
  monthDays: number;
  /** Derived display value: monthDays − absentDays − halfDays×0.5 — see computeAttendanceBreakdown in db/attendance.ts. Not an independent input; edit absentDays/halfDays instead. */
  paidDays: number;
  /** Full-absent days this month, editable by an operator before finalizing. Drives the lossOfPay deduction — see computeLossOfPay in db/payroll.ts. */
  absentDays: number;
  /** Half-days this month (each counts as 0.5 of a paid day), editable before finalizing. */
  halfDays: number;
  basic: number;
  hra: number;
  ta: number;
  others: number;
  misc: number;
  /** Full monthly salary structure total (not prorated) — days not worked are deducted explicitly via lossOfPay instead, see computePayslipMoney in db/payroll.ts. */
  grossEarning: number;
  epfEmployee: number;
  esicEmployee: number;
  tds: number;
  otherDeduction: number;
  miscDeduction: number;
  /** Loss-of-Pay for absentDays/halfDays, itemized as its own deduction line — computed by default (computeLossOfPay) but directly overridable, same as tds/otherDeduction/miscDeduction. */
  lossOfPay: number;
  totalDeductions: number;
  netPay: number;
  /** "Additional (ER)" block — employer contributions, informational, not netted against pay. */
  epfEmployer: number;
  esicEmployer: number;
  gratuity: number;
  bonus: number;
  health: number;
  /** Computed as grossEarning + the employer-additions block above — see the PayrollProfile.ctc doc comment. */
  ctc: number;
  status: PayslipStatus;
  createdAt: TS;
  createdBy?: Actor | null;
  updatedAt?: TS;
  updatedBy?: Actor | null;
  finalizedAt?: TS | null;
  finalizedBy?: Actor | null;
  paidAt?: TS | null;
  paidBy?: Actor | null;
}

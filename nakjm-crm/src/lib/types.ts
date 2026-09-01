import type { Timestamp } from "firebase/firestore";

import type {
  ActivityAction, ActivityEntityType, AssetCategory, AssetStatus, AttendanceStatus, BoqCategory, BoqStatus,
  ClientType, Department, DepreciationMethod, DocumentCategory, DrawingDiscipline, DrawingStatus, EmploymentType,
  HandoverStage, InspectionResult, IssuePriority, IssueStatus, LeaveRequestStatus, LeaveType, NcrStatus,
  PaymentMode, PiStatus, PoStatus, ProjectStatus, ProjectType, PunchItemStatus, QuotationStatus, RfiStatus,
  RfqStatus, Role, RollStatus, SiteReportType, StageStatus, TaskStatus, TenderStatus, VendorCategory,
} from "./constants";

type TS = Timestamp | null;

export interface Actor {
  uid: string;
  name: string;
  role: Role;
}

export interface Payroll {
  monthlySalary?: number;
  panNumber?: string;
  pfApplicable?: boolean;
  pfNumber?: string;
  uanNumber?: string;
  esiApplicable?: boolean;
  esiNumber?: string;
  tdsPercent?: number;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
}

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  roles?: Role[];
  active: boolean;
  photoURL?: string | null;
  designation?: string;
  department?: Department | null;
  officeLocation?: string;
  managerId?: string | null;
  managerName?: string | null;
  employmentType?: EmploymentType | null;
  rollStatus?: RollStatus | null;
  payroll?: Payroll;
  createdAt: TS;
  updatedAt: TS;
  lastLoginAt?: TS;
}

// ---------------------------------------------------------------------------
// Clients & vendors
// ---------------------------------------------------------------------------

export interface ClientGstRegistration {
  gstin: string;
  state: string;
}

export interface Client {
  id: string;
  name: string;
  clientType: ClientType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  /** One entry per state the client is GST-registered in. gstin/state above stay in sync with the first entry for anything reading the old singular fields. */
  gstRegistrations?: ClientGstRegistration[];
  active: boolean;
  notes?: string;
  search: string[];
  createdAt: TS;
  updatedAt: TS;
  createdBy?: Actor;
}

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  gstin?: string;
  paymentTerms?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
  rating?: number;
  active: boolean;
  notes?: string;
  search: string[];
  createdAt: TS;
  updatedAt: TS;
}

export interface VendorRating {
  id: string;
  vendorId: string;
  vendorName: string;
  projectId?: string | null;
  projectName?: string | null;
  score: number;
  notes?: string;
  ratedBy: Actor;
  createdAt: TS;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  department: Department;
  joinedDate?: TS;
  active: boolean;
  search: string[];
  createdAt: TS;
  updatedAt: TS;
}

// ---------------------------------------------------------------------------
// Tenders
// ---------------------------------------------------------------------------

export interface Tender {
  id: string;
  tenderCode: string;
  tenderNumber?: string;
  title: string;
  clientId: string;
  clientName: string;
  department?: string;
  authority?: string;
  location?: string;
  tenderValue?: number;
  emdAmount?: number;
  tenderFee?: number;
  submissionDate?: TS;
  openingDate?: TS;
  status: TenderStatus;
  notes?: string;
  linkedProjectId?: string | null;
  deletedAt?: TS;
  deletedBy?: Actor | null;
  search: string[];
  createdAt: TS;
  updatedAt: TS;
  createdBy?: Actor;
}

// ---------------------------------------------------------------------------
// RFQs — a client's Request for Quotation, upstream of the priced Quotation
// itself. Distinct from a Tender (a public/institutional bid process): an
// RFQ is a direct ask from an existing or prospective client.
// ---------------------------------------------------------------------------

export interface Rfq {
  id: string;
  rfqNo: string;
  clientId: string;
  clientName: string;
  projectId?: string | null;
  projectName?: string;
  subject: string;
  receivedDate?: TS;
  dueDate?: TS;
  status: RfqStatus;
  notes?: string;
  sourceDocumentId?: string | null;
  convertedQuotationId?: string | null;
  createdAt: TS;
  updatedAt: TS;
  createdBy?: Actor;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectSite {
  address?: string;
  city?: string;
  state?: string;
}

export interface ProjectTeamAssignment {
  teamMemberId: string;
  name: string;
  designation?: string;
  projectRole?: string;
  assignedAt: TS;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  clientId: string;
  clientName: string;
  projectManagerId?: string | null;
  projectManagerName?: string | null;
  projectType: ProjectType;
  site: ProjectSite;
  capacityKw?: number | null;
  status: ProjectStatus;
  startDate?: TS;
  targetEndDate?: TS;
  actualEndDate?: TS;
  budgetAmount: number;
  contractValue: number;
  pocName?: string;
  pocPhone?: string;
  pocEmail?: string;
  notes?: string;
  clientRequirements?: string;
  /** Which of the client's (possibly several, state-wise) GST registrations this project bills under -- PO/PI/Quotation created for it inherit this. */
  billingGstin?: string | null;
  billingState?: string | null;
  team: ProjectTeamAssignment[];
  sourceDocumentId?: string | null;
  tenderId?: string | null;
  parentProjectId?: string | null;
  parentProjectCode?: string | null;
  deletedAt?: TS;
  deletedBy?: Actor | null;
  search: string[];
  createdAt: TS;
  updatedAt: TS;
  createdBy?: Actor;
  updatedBy?: Actor;
}

// ---------------------------------------------------------------------------
// Line items shared by quotations / BOQ / PO / PI
// ---------------------------------------------------------------------------

export interface LineItem {
  srNo: number;
  description: string;
  unit?: string;
  qty: number;
  rate: number;
  amount: number;
  hsnCode?: string;
  gstPercent?: number;
}

export interface BoqLineItem extends LineItem {
  section?: string;
  makeOem?: string;
  supplyRate?: number;
  installationRate?: number;
  category: BoqCategory;
  remarks?: string;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  projectId: string;
  projectName: string;
  clientId: string;
  version: number;
  status: QuotationStatus;
  quotationDate: TS;
  validUntil?: TS;
  items: LineItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  gstType?: "IGST" | "CGST_SGST";
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  shipToDifferent?: boolean;
  shipToAddress?: string;
  totalAmount: number;
  terms?: string;
  notes?: string;
  sourceBoqId?: string | null;
  /** A typed-name sign-off, not a cryptographic signature -- lightweight internal approval, matching the record's own status flow. */
  approval?: { approvedBy: Actor; approvedAt: TS; signatureName: string; note?: string } | null;
  /** Revision lineage: rootQuotationId is the same across every version of one quotation (the first version's own id); revisedFrom is the immediate prior version's id. Absent on quotations created before this existed. */
  rootQuotationId?: string | null;
  revisedFrom?: string | null;
  createdAt: TS;
  updatedAt: TS;
}

export interface Boq {
  id: string;
  boqNo: string;
  projectId: string;
  projectName: string;
  quotationId?: string | null;
  siteName?: string;
  version: number;
  status: BoqStatus;
  boqDate: TS;
  items: BoqLineItem[];
  totalAmount: number;
  terms?: string;
  notes?: string;
  sourceDocumentId?: string | null;
  /** Revision lineage: rootBoqId is the same across every version of one BOQ (the first version's own id); revisedFrom is the immediate prior version's id. Absent on BOQs created before this existed. */
  rootBoqId?: string | null;
  revisedFrom?: string | null;
  /** A typed-name sign-off, not a cryptographic signature -- required before a BOQ moves to APPROVED. */
  approval?: { approvedBy: Actor; approvedAt: TS; signatureName: string; note?: string } | null;
  createdAt: TS;
  updatedAt: TS;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  projectId: string;
  projectName: string;
  vendorId: string;
  vendorName: string;
  poDate: TS;
  deliveryDate?: TS;
  status: PoStatus;
  items: LineItem[];
  subtotal: number;
  taxAmount: number;
  gstType?: "IGST" | "CGST_SGST";
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  shipToDifferent?: boolean;
  shipToAddress?: string;
  totalAmount: number;
  paidAmount: number;
  terms?: string;
  notes?: string;
  sourceBoqId?: string | null;
  /** A typed-name sign-off, not a cryptographic signature -- required before a PO moves from DRAFT to ISSUED. */
  approval?: { approvedBy: Actor; approvedAt: TS; signatureName: string; note?: string } | null;
  createdAt: TS;
  updatedAt: TS;
}

export interface ProformaInvoice {
  id: string;
  piNo: string;
  projectId: string;
  projectName: string;
  clientId: string;
  quotationId?: string | null;
  clientPoNumber?: string;
  piDate: TS;
  dueDate?: TS;
  status: PiStatus;
  milestone?: string;
  items: LineItem[];
  subtotal: number;
  taxAmount: number;
  gstType?: "IGST" | "CGST_SGST";
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  shipToDifferent?: boolean;
  shipToAddress?: string;
  totalAmount: number;
  paidAmount: number;
  terms?: string;
  notes?: string;
  sourceDocumentId?: string | null;
  createdAt: TS;
  updatedAt: TS;
}

export interface ClientPayment {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  piId?: string | null;
  paymentDate: TS;
  amount: number;
  mode: PaymentMode;
  referenceNo?: string;
  milestone?: string;
  notes?: string;
  createdAt: TS;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  poId?: string | null;
  paymentDate: TS;
  amount: number;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
  createdAt: TS;
}

export interface ProjectStage {
  id: string;
  projectId: string;
  name: string;
  sequence: number;
  status: StageStatus;
  plannedStart?: TS;
  plannedEnd?: TS;
  actualStart?: TS;
  actualEnd?: TS;
  progressPct: number;
  notes?: string;
  createdAt: TS;
  updatedAt: TS;
}

/** A dated site photo filed against one stage — a name/caption and details, alongside the image itself. */
export interface StageProgressPhoto {
  id: string;
  projectId: string;
  projectName: string;
  stageId: string;
  stageName: string;
  title: string;
  details?: string;
  photoUrl: string;
  storagePath: string;
  mimeType: string;
  uploadedBy: Actor;
  createdAt: TS;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  stageId: string;
  stageName: string;
  title: string;
  status: TaskStatus;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: TS;
  completedAt?: TS;
  notes?: string;
  createdAt: TS;
  updatedAt: TS;
}

/** One row per BOQ line item — executed quantity recorded against the planned BOQ quantity. */
export interface Measurement {
  id: string;
  projectId: string;
  boqId: string;
  itemSrNo: number;
  description: string;
  unit?: string;
  boqQty: number;
  executedQty: number;
  updatedAt: TS;
  updatedById?: string | null;
  updatedByName?: string;
}

export interface RfiResponse {
  byId: string;
  byName: string;
  message: string;
  at: TS;
}

export interface Rfi {
  id: string;
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  subject: string;
  question: string;
  status: RfiStatus;
  raisedById?: string | null;
  raisedByName?: string;
  assignedToId?: string | null;
  assignedToName?: string;
  responses: RfiResponse[];
  createdAt: TS;
  updatedAt: TS;
}

/**
 * One doc per revision — drawingNumber groups them, revision distinguishes
 * them (R0, R1, R2…). Never deleted; superseded revisions just get their
 * status flipped to SUPERSEDED when a newer one is uploaded.
 */
export interface Drawing {
  id: string;
  projectId: string;
  projectName: string;
  drawingNumber: string;
  title: string;
  discipline: DrawingDiscipline;
  revision: string;
  status: DrawingStatus;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: Actor;
  createdAt: TS;
  updatedAt: TS;
}

export interface PunchItem {
  id: string;
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  description: string;
  photoUrl?: string;
  assignedToId?: string | null;
  assignedToName?: string;
  dueDate?: TS;
  status: PunchItemStatus;
  resolution?: string;
  clientAccepted: boolean;
  createdAt: TS;
  updatedAt: TS;
}

export interface HandoverStageEntry {
  stage: HandoverStage;
  at: TS;
  byId?: string | null;
  byName?: string;
}

/** One doc per project — the close-out workflow's current state and history. */
export interface Handover {
  id: string;
  projectId: string;
  projectName: string;
  stage: HandoverStage;
  history: HandoverStageEntry[];
  completionDocumentIds: string[];
  notes?: string;
  handoverDate?: TS;
  createdAt: TS;
  updatedAt: TS;
}

export interface Inspection {
  id: string;
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  checklist: string;
  result: InspectionResult;
  remarks?: string;
  inspectedById?: string | null;
  inspectedByName?: string;
  inspectedAt: TS;
  createdAt: TS;
}

export interface Ncr {
  id: string;
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  issue: string;
  location?: string;
  responsiblePersonId?: string | null;
  responsiblePersonName?: string;
  correctiveAction?: string;
  status: NcrStatus;
  closureDate?: TS;
  createdAt: TS;
  updatedAt: TS;
}

export interface Issue {
  id: string;
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  title: string;
  description?: string;
  priority: IssuePriority;
  status: IssueStatus;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: TS;
  raisedById?: string | null;
  raisedByName?: string;
  resolution?: string;
  createdAt: TS;
  updatedAt: TS;
}

export interface SiteReport {
  id: string;
  projectId: string;
  projectName: string;
  reportedById?: string | null;
  reportedByName?: string;
  reportDate: TS;
  reportType: SiteReportType;
  progressPct: number;
  workDone?: string;
  issues?: string;
  manpowerCount?: number;
  weather?: string;
  visibleToClient: boolean;
  createdAt: TS;
}

export interface Activity {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  action: ActivityAction;
  message: string;
  actor: Actor;
  projectId?: string | null;
  at: TS;
}

export interface NakjmDocument {
  id: string;
  projectId?: string | null;
  /** When set, this document is filed against a specific BOQ/PO/Quotation/PI rather than just the project. */
  linkedEntityType?: "BOQ" | "PURCHASE_ORDER" | "QUOTATION" | "PROFORMA_INVOICE" | "RFQ" | null;
  linkedEntityId?: string | null;
  docType: DocumentCategory;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  notes?: string;
  uploadedBy?: Actor;
  createdAt: TS;
}

// ---------------------------------------------------------------------------
// Asset register
// ---------------------------------------------------------------------------

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber?: string;
  status: AssetStatus;
  cost: number;
  purchaseDate: TS;
  method: DepreciationMethod;
  usefulLifeYears?: number;
  wdvRatePct?: number;
  salvageValue?: number;
  vendorId?: string | null;
  vendorName?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  linkedProjectId?: string | null;
  linkedProjectCode?: string | null;
  warrantyUntil?: TS;
  notes?: string;
  deletedAt?: TS;
  deletedBy?: Actor | null;
  createdAt: TS;
  createdBy?: Actor;
  updatedAt: TS;
  updatedBy?: Actor;
}

// ---------------------------------------------------------------------------
// HRMS — attendance & roster
// ---------------------------------------------------------------------------

export interface AttendancePunch {
  lat: number | null;
  lng: number | null;
  at: TS;
}

export interface AttendanceRecord {
  id: string;
  uid: string;
  userName: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: AttendancePunch | null;
  checkOut?: AttendancePunch | null;
  note?: string;
  markedBy?: Actor;
  createdAt: TS;
  updatedAt: TS;
  updatedBy?: Actor;
}

export interface LeaveRequest {
  id: string;
  uid: string;
  userName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: TS;
  decidedBy?: Actor | null;
  decidedAt?: TS | null;
  decisionNote?: string;
}


export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: TS;
  createdBy?: Actor;
}

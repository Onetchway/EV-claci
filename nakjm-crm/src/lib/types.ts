import type { Timestamp } from "firebase/firestore";

import type {
  ActivityAction, ActivityEntityType, AssetCategory, AssetStatus, AttendanceStatus, BoqCategory, BoqStatus,
  ClientType, Department, DepreciationMethod, PaymentMode, PiStatus,
  PoStatus, ProjectStatus, ProjectType, QuotationStatus, Role, SiteReportType,
  VendorCategory,
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
  payroll?: Payroll;
  createdAt: TS;
  updatedAt: TS;
  lastLoginAt?: TS;
}

// ---------------------------------------------------------------------------
// Clients & vendors
// ---------------------------------------------------------------------------

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
  team: ProjectTeamAssignment[];
  sourceDocumentId?: string | null;
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
  totalAmount: number;
  terms?: string;
  notes?: string;
  sourceBoqId?: string | null;
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
  notes?: string;
  sourceDocumentId?: string | null;
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
  totalAmount: number;
  paidAmount: number;
  terms?: string;
  notes?: string;
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
  piDate: TS;
  dueDate?: TS;
  status: PiStatus;
  milestone?: string;
  items: LineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
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
  docType: "CLIENT_PO" | "WORK_ORDER" | "BOQ_UPLOAD" | "QUOTATION_UPLOAD" | "OTHER";
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


export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: TS;
  createdBy?: Actor;
}

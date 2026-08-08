"use client";

/** Column definitions shared by every export and import in the app. */

import {
  DISCOM_STAGE_LABEL, FUNDING_MODE_LABEL, LAND_TYPE_LABEL, LOAN_STAGE_LABEL,
  LOCATION_TYPE_LABEL, OWNER_TYPE_LABEL, OWNERSHIP_LABEL, POWER_LOAD_LABEL,
  PROJECT_OWNERSHIP_LABEL, PROJECT_STAGE_META, PROJECT_STATUS_LABEL,
  REJECTION_LABEL, SOURCE_LABEL, STAGE_META, STATUS_LABEL, TASK_STATUS_LABEL,
  WORKSTREAMS, WORKSTREAM_LABEL,
} from "./constants";
import { describeConfig } from "./pricing";
import type { Column } from "./spreadsheet";
import type { Lead, Project } from "./types";
import { formatDate } from "./utils";

const d = (v: unknown) => (v ? formatDate(v as never) : "");

export const LEAD_COLUMNS: Column<Lead>[] = [
  { header: "Lead Code", value: (l) => l.code, aliases: ["code", "lead id", "id"] },
  { header: "Type", value: (l) => l.type, aliases: ["lead type"] },
  { header: "Client Name", value: (l) => l.client?.name ?? "", aliases: ["name", "customer name", "client"] },
  { header: "Phone", value: (l) => l.client?.phone ?? "", aliases: ["phone number", "mobile", "contact", "contact no"] },
  { header: "Alternate Phone", value: (l) => l.client?.altPhone ?? "", aliases: ["alt phone", "phone 2"] },
  { header: "Email", value: (l) => l.client?.email ?? "", aliases: ["email id", "e-mail"] },
  { header: "Company", value: (l) => l.client?.company ?? "", aliases: ["firm", "company name"] },
  { header: "City", value: (l) => l.client?.city ?? "", aliases: ["town"] },
  { header: "State", value: (l) => l.client?.state ?? "" },
  { header: "Address", value: (l) => l.client?.address ?? "" },
  { header: "PAN", value: (l) => l.client?.pan ?? "" },
  { header: "GSTIN", value: (l) => l.client?.gstin ?? "" },
  { header: "Source", value: (l) => SOURCE_LABEL[l.source] ?? l.source, aliases: ["lead source"] },
  { header: "Source Detail", value: (l) => l.sourceDetail ?? "", aliases: ["campaign"] },
  { header: "Stage", value: (l) => STAGE_META[l.stage]?.label ?? l.stage },
  { header: "Status", value: (l) => STATUS_LABEL[l.status] ?? l.status },
  { header: "Configuration", value: (l) => describeConfig(l.config), aliases: ["chargers"] },
  { header: "Charger OEM", value: (l) => l.oem ?? "", aliases: ["oem", "make"] },
  { header: "Total Value (incl GST)", value: (l) => l.value ?? 0, aliases: ["value", "amount", "total"] },
  { header: "Collected", value: (l) => l.paidAmount ?? 0, aliases: ["paid"] },
  { header: "Balance", value: (l) => Math.max(0, (l.value ?? 0) - (l.paidAmount ?? 0)), aliases: ["due"] },
  { header: "Funding Mode", value: (l) => (l.financing ? FUNDING_MODE_LABEL[l.financing.mode] : ""), aliases: ["funding"] },
  { header: "Bank", value: (l) => l.financing?.bank ?? "", aliases: ["lender"] },
  { header: "Loan Stage", value: (l) => (l.financing ? LOAN_STAGE_LABEL[l.financing.stage] : "") },
  { header: "Loan Sanctioned", value: (l) => l.financing?.sanctionedAmount ?? "" },
  { header: "Loan Disbursed", value: (l) => l.financing?.disbursedAmount ?? "" },
  { header: "Location Name", value: (l) => l.site?.locationName ?? "", aliases: ["site name", "location"] },
  { header: "Google Maps Link", value: (l) => l.site?.mapsLink ?? "", aliases: ["maps link", "map", "google map"] },
  {
    header: "Location Type",
    value: (l) => (l.site?.locationTypes ?? []).map((t) => LOCATION_TYPE_LABEL[t] ?? t).join(", "),
    aliases: ["site type"],
  },
  { header: "Land Type", value: (l) => (l.site?.landType ? LAND_TYPE_LABEL[l.site.landType] : "") },
  { header: "Owner Type", value: (l) => (l.site?.ownerType ? OWNER_TYPE_LABEL[l.site.ownerType] : "") },
  { header: "Property Owner", value: (l) => (l.site?.ownership ? OWNERSHIP_LABEL[l.site.ownership] : ""), aliases: ["ownership"] },
  { header: "Commercial Model", value: (l) => (l.site?.commercialModelInterested ? "Yes" : "No") },
  { header: "Power Load", value: (l) => (l.site?.powerLoad ? POWER_LOAD_LABEL[l.site.powerLoad] : ""), aliases: ["power", "load"] },
  { header: "Sanctioned Load (kVA)", value: (l) => l.site?.sanctionedLoadKva ?? "" },
  { header: "Space (sq.ft)", value: (l) => l.site?.spaceAvailableSqft ?? "" },
  { header: "Remarks", value: (l) => l.site?.remarks ?? "", aliases: ["notes", "remark", "comment"] },
  { header: "Agent", value: (l) => l.ownerName, aliases: ["owner", "assigned to"] },
  { header: "Next Follow-up", value: (l) => d(l.nextFollowUpAt), aliases: ["follow up", "next followup"] },
  { header: "Expected Close", value: (l) => d(l.expectedCloseAt) },
  { header: "Rejection Reason", value: (l) => (l.rejection ? REJECTION_LABEL[l.rejection.reason] : "") },
  { header: "LOI Number", value: (l) => l.eoi?.number ?? "" },
  { header: "LOI Status", value: (l) => l.eoi?.status ?? "" },
  { header: "Created", value: (l) => d(l.createdAt) },
  { header: "Last Updated", value: (l) => d(l.updatedAt) },
];

/** The subset an importer is expected to provide. */
export const LEAD_IMPORT_COLUMNS: Column<Lead>[] = LEAD_COLUMNS.filter((c) =>
  [
    "Type", "Client Name", "Phone", "Alternate Phone", "Email", "Company", "City",
    "State", "Address", "PAN", "GSTIN", "Source", "Source Detail", "Location Name",
    "Google Maps Link", "Location Type", "Land Type", "Owner Type", "Property Owner",
    "Power Load", "Sanctioned Load (kVA)", "Space (sq.ft)", "Remarks",
    "Next Follow-up", "Funding Mode", "Bank",
  ].includes(c.header),
);

export const PROJECT_COLUMNS: Column<Project>[] = [
  { header: "Project Code", value: (p) => p.code },
  { header: "Name", value: (p) => p.name },
  { header: "Ownership", value: (p) => PROJECT_OWNERSHIP_LABEL[p.ownership] },
  { header: "Stage", value: (p) => PROJECT_STAGE_META[p.stage]?.label ?? p.stage },
  { header: "Status", value: (p) => PROJECT_STATUS_LABEL[p.status] },
  { header: "Client", value: (p) => p.client?.name ?? "" },
  { header: "Client Phone", value: (p) => p.client?.phone ?? "" },
  { header: "Location", value: (p) => p.site?.locationName ?? "" },
  { header: "City", value: (p) => p.site?.city ?? "" },
  { header: "State", value: (p) => p.site?.state ?? "" },
  {
    header: "Location Type",
    value: (p) => (p.site?.locationTypes ?? []).map((t) => LOCATION_TYPE_LABEL[t] ?? t).join(", "),
  },
  { header: "Land Type", value: (p) => (p.site?.landType ? LAND_TYPE_LABEL[p.site.landType] : "") },
  { header: "Owner Type", value: (p) => (p.site?.ownerType ? OWNER_TYPE_LABEL[p.site.ownerType] : "") },
  { header: "Configuration", value: (p) => describeConfig(p.config) },
  { header: "Capacity (kW)", value: (p) => p.totalKw },
  { header: "Units", value: (p) => p.unitCount },
  { header: "Value (incl GST)", value: (p) => p.value },
  { header: "CAPEX Budget", value: (p) => p.capexBudget ?? "" },
  { header: "CAPEX Spent", value: (p) => p.capexSpent ?? "" },
  { header: "DISCOM Stage", value: (p) => DISCOM_STAGE_LABEL[p.discom?.stage ?? "NOT_APPLIED"] },
  { header: "Consumer Number", value: (p) => p.discom?.consumerNumber ?? "" },
  ...WORKSTREAMS.map<Column<Project>>((w) => ({
    header: WORKSTREAM_LABEL[w],
    value: (p) => {
      const ws = p.workstreams?.[w];
      if (!ws) return "";
      return `${TASK_STATUS_LABEL[ws.status]} (${ws.progressPct ?? 0}%)`;
    },
  })),
  { header: "Manager", value: (p) => p.managerName },
  { header: "Source Lead", value: (p) => p.sourceLeadCode ?? "" },
  { header: "Target Live", value: (p) => d(p.targetLiveAt) },
  { header: "Live On", value: (p) => d(p.liveAt) },
  { header: "Created", value: (p) => d(p.createdAt) },
];

/** Loan book export — one row per financed lead. */
export const LOAN_COLUMNS: Column<Lead>[] = [
  { header: "Lead Code", value: (l) => l.code },
  { header: "Client Name", value: (l) => l.client?.name ?? "" },
  { header: "Phone", value: (l) => l.client?.phone ?? "" },
  { header: "City", value: (l) => l.client?.city ?? "" },
  { header: "Agent", value: (l) => l.ownerName },
  { header: "Funding Mode", value: (l) => (l.financing ? FUNDING_MODE_LABEL[l.financing.mode] : "") },
  { header: "Bank", value: (l) => l.financing?.bank ?? "" },
  { header: "Branch", value: (l) => l.financing?.branch ?? "" },
  { header: "Application No", value: (l) => l.financing?.applicationNo ?? "" },
  { header: "Loan Stage", value: (l) => (l.financing ? LOAN_STAGE_LABEL[l.financing.stage] : "") },
  { header: "Requested", value: (l) => l.financing?.requestedAmount ?? "" },
  { header: "Sanctioned", value: (l) => l.financing?.sanctionedAmount ?? "" },
  { header: "Disbursed", value: (l) => l.financing?.disbursedAmount ?? "" },
  { header: "Interest %", value: (l) => l.financing?.interestRate ?? "" },
  { header: "Tenure (yrs)", value: (l) => l.financing?.tenureYears ?? "" },
  { header: "Deal Value", value: (l) => l.value ?? 0 },
  { header: "Relationship Manager", value: (l) => l.financing?.relationshipManager ?? "" },
  { header: "RM Phone", value: (l) => l.financing?.rmPhone ?? "" },
  { header: "Applied", value: (l) => d(l.financing?.appliedAt) },
  { header: "Sanctioned On", value: (l) => d(l.financing?.sanctionedAt) },
  { header: "Disbursed On", value: (l) => d(l.financing?.disbursedAt) },
  { header: "Notes", value: (l) => l.financing?.note ?? "" },
];

/** Agent leaderboard export. Typed loosely so analytics stays UI-independent. */
export interface AgentRow {
  ownerName: string;
  total: number;
  active: number;
  won: number;
  rejected: number;
  conversionPct: number;
  pipelineValue: number;
  wonValue: number;
  collected: number;
  overdue: number;
  avgCycleDays: number | null;
}

export const AGENT_COLUMNS: Column<AgentRow>[] = [
  { header: "Agent", value: (a) => a.ownerName },
  { header: "Total leads", value: (a) => a.total },
  { header: "Active", value: (a) => a.active },
  { header: "Won", value: (a) => a.won },
  { header: "Rejected", value: (a) => a.rejected },
  { header: "Conversion %", value: (a) => a.conversionPct },
  { header: "Pipeline value", value: (a) => a.pipelineValue },
  { header: "Closed value", value: (a) => a.wonValue },
  { header: "Collected", value: (a) => a.collected },
  { header: "Overdue follow-ups", value: (a) => a.overdue },
  { header: "Avg cycle (days)", value: (a) => a.avgCycleDays ?? "" },
];

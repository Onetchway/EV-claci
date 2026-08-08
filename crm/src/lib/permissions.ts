import { ROLE_RANK, type Role } from "./constants";
import type { Lead } from "./types";

export interface Viewer {
  uid: string;
  role: Role;
}

export const isAdmin = (role: Role) => ROLE_RANK[role] >= ROLE_RANK.ADMIN;
export const isSuperAdmin = (role: Role) => role === "SUPER_ADMIN";

/** Agents only ever see their own book; admins see everything. */
export const canSeeAllLeads = (role: Role) => isAdmin(role);

export function canViewLead(viewer: Viewer, lead: Pick<Lead, "ownerId">): boolean {
  return canSeeAllLeads(viewer.role) || lead.ownerId === viewer.uid;
}

export function canEditLead(viewer: Viewer, lead: Pick<Lead, "ownerId" | "status">): boolean {
  if (isAdmin(viewer.role)) return true;
  // An agent can work their own lead, but a rejected one is frozen until an
  // admin reopens it — otherwise rejection stats can be quietly rewritten.
  return lead.ownerId === viewer.uid && lead.status !== "REJECTED";
}

/** Reassigning a lead to a different agent is an admin action. */
export const canReassign = (viewer: Viewer) => isAdmin(viewer.role);

/** Only admins confirm money actually landed. */
export const canVerifyPayment = (viewer: Viewer) => isAdmin(viewer.role);

export const canDeletePayment = (viewer: Viewer) => isAdmin(viewer.role);

export const canVerifyDocument = (viewer: Viewer) => isAdmin(viewer.role);

export function canDeleteDocument(viewer: Viewer, doc: { uploadedBy: { uid: string }; status: string }): boolean {
  if (isAdmin(viewer.role)) return true;
  return doc.uploadedBy.uid === viewer.uid && doc.status === "PENDING";
}

export const canManageUsers = (viewer: Viewer) => isAdmin(viewer.role);

/** Only a super admin may create or demote another admin. */
export function canAssignRole(viewer: Viewer, target: Role): boolean {
  if (isSuperAdmin(viewer.role)) return true;
  return viewer.role === "ADMIN" && target === "AGENT";
}

export const canViewAuditLog = (viewer: Viewer) => isAdmin(viewer.role);

export const canExport = (viewer: Viewer) => isAdmin(viewer.role);

export const canApplyDiscount = (viewer: Viewer) => isAdmin(viewer.role);

/** Reopening a rejected lead restores it to the pipeline. Admins only. */
export const canReopenLead = (viewer: Viewer) => isAdmin(viewer.role);

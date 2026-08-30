import { expandRole, ORG_WIDE_ROLES, ROLE_RANK, type Role } from "./constants";

/**
 * Capability-based access control. A user may hold several roles; their
 * abilities are the union across all of them. Rank exists only for the two
 * genuinely hierarchical things: who may grant a role, and who Firestore
 * rules treat as an admin.
 */

export interface Viewer {
  uid: string;
  role: Role;
  roles?: Role[];
}

export function rolesOf(viewer: Viewer): Role[] {
  const list = viewer.roles?.length ? viewer.roles : [viewer.role];
  return list.filter(Boolean).flatMap(expandRole);
}

export function hasRole(viewer: Viewer, ...roles: Role[]): boolean {
  const mine = rolesOf(viewer);
  return roles.some((r) => mine.includes(r));
}

export function topRank(viewer: Viewer): number {
  return Math.max(...rolesOf(viewer).map((r) => ROLE_RANK[r] ?? 0));
}

export const isAdmin = (role: Role) => ROLE_RANK[role] >= ROLE_RANK.ADMIN;
export const viewerIsAdmin = (viewer: Viewer) => hasRole(viewer, "ADMIN", "SUPER_ADMIN");

export function canSeeAllProjects(roleOrViewer: Role | Viewer): boolean {
  if (typeof roleOrViewer === "string") return ORG_WIDE_ROLES.includes(roleOrViewer);
  return rolesOf(roleOrViewer).some((r) => ORG_WIDE_ROLES.includes(r));
}

const WRITE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "OPERATIONS"];

export const canManageClients = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);
export const canManageVendors = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);
export const canManageTenders = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);
export const canManageTeam = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER");
export const canManageProjects = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);

/** Stages are a project-planning decision; site engineers execute tasks but don't define the workstream. */
export const canManageStages = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES);

/** Site engineers update task status/progress day to day, not just office roles. */
export const canManageTasks = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES, "SITE_ENGINEER");

/** Anyone executing site work can raise/manage an issue, not just office roles. */
export const canManageIssues = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES, "SITE_ENGINEER");

/** Drafting quotations/BOQ/POs/PIs is a pricing decision. */
export const canManageProcurement = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "OPERATIONS");

/** Recording money moving is Finance's job, with Admin oversight. */
export const canManagePayments = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "FINANCE");

export const canSubmitSiteReports = (viewer: Viewer) =>
  hasRole(viewer, "SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "OPERATIONS", "SITE_ENGINEER");

export const canManageUsers = (viewer: Viewer) => viewerIsAdmin(viewer);

export function canAssignRole(viewer: Viewer, target: Role): boolean {
  if (hasRole(viewer, "SUPER_ADMIN")) return true;
  if (!hasRole(viewer, "ADMIN")) return false;
  return ROLE_RANK[target] < ROLE_RANK.ADMIN;
}

export const canTrash = (viewer: Viewer) => viewerIsAdmin(viewer);
export const canPermanentlyDelete = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN");

export const canManageAssets = (viewer: Viewer) => hasRole(viewer, ...WRITE_ROLES, "FINANCE");

/** HR record management — designation, department, manager, attendance corrections. */
export const canManageHrms = (viewer: Viewer) => hasRole(viewer, "SUPER_ADMIN", "ADMIN");

/** Everyone sees their own attendance/roster; only admins see the whole org's. */
export const canSeeAllHrms = (viewer: Viewer) => viewerIsAdmin(viewer);

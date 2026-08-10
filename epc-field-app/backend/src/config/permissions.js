/**
 * Central RBAC definitions — the single source of truth for what permissions exist, which
 * roles exist, and which roles get which permissions by default. Seeded into the database
 * (RoleDef/PermissionDef/RolePermission) by prisma/seed.js so an admin UI can eventually edit
 * the matrix without a code change; this file is only the *initial* seed data.
 *
 * Two kinds of role, matching how EPC orgs actually work:
 *  - "Global" roles (SUPER_ADMIN, MANAGEMENT, OPERATIONS_MANAGER) act everywhere — their
 *    permissions apply org-wide via User.roleId.
 *  - "Project-scoped" roles (PROJECT_MANAGER, FIELD_ENGINEER, ...) only grant their permissions
 *    for the specific project(s) the user is added to via ProjectMember — a Field Engineer
 *    might be a Project Manager for one project and just an engineer on another.
 * See src/middleware/permissions.js for how these two are combined at request time.
 */

const PERMISSIONS = {
  USERS_MANAGE: { key: 'users.manage', description: 'Create/edit/deactivate user accounts' },
  ROLES_MANAGE: { key: 'roles.manage', description: 'View/edit roles and permission matrix' },
  CLIENTS_MANAGE: { key: 'clients.manage', description: 'Create/edit clients and stage templates' },
  PROJECTS_VIEW_ALL: { key: 'projects.viewAll', description: 'See all projects, not just assigned ones' },
  PROJECTS_CREATE: { key: 'projects.create', description: 'Create new projects' },
  PROJECTS_MANAGE: { key: 'projects.manage', description: 'Edit project details' },
  PROJECTS_ASSIGN_MEMBERS: { key: 'projects.assignMembers', description: 'Add/remove project team members' },
  STAGES_APPROVE: { key: 'stages.approve', description: 'Approve or reject stage submissions' },
  SUBMISSIONS_CREATE: { key: 'submissions.create', description: 'Fill in and submit stage reports' },
  SUBMISSIONS_MANAGE: { key: 'submissions.manage', description: 'Regenerate PDFs, manage submissions beyond own work' },
  AUDIT_VIEW: { key: 'audit.view', description: 'View the audit log' },
};

const PERMISSION_LIST = Object.values(PERMISSIONS);

const ALL_PERMISSION_KEYS = PERMISSION_LIST.map((p) => p.key);

/** key -> { name, legacyRole?, permissions: string[] } — legacyRole maps to the old User.role enum. */
const ROLES = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    legacyRole: 'ADMIN',
    permissions: ALL_PERMISSION_KEYS,
  },
  MANAGEMENT: {
    name: 'Management',
    permissions: [PERMISSIONS.PROJECTS_VIEW_ALL.key, PERMISSIONS.AUDIT_VIEW.key],
  },
  OPERATIONS_MANAGER: {
    name: 'Operations Manager',
    permissions: [
      PERMISSIONS.PROJECTS_VIEW_ALL.key,
      PERMISSIONS.PROJECTS_CREATE.key,
      PERMISSIONS.PROJECTS_MANAGE.key,
      PERMISSIONS.PROJECTS_ASSIGN_MEMBERS.key,
      PERMISSIONS.STAGES_APPROVE.key,
      PERMISSIONS.SUBMISSIONS_MANAGE.key,
      PERMISSIONS.AUDIT_VIEW.key,
    ],
  },
  // Project-scoped roles: these permissions only apply on projects the user is a ProjectMember
  // of with this role — see hasProjectPermission in middleware/permissions.js.
  PROJECT_MANAGER: {
    name: 'Project Manager',
    permissions: [PERMISSIONS.PROJECTS_MANAGE.key, PERMISSIONS.PROJECTS_ASSIGN_MEMBERS.key, PERMISSIONS.STAGES_APPROVE.key],
  },
  FIELD_ENGINEER: {
    name: 'Field Engineer',
    legacyRole: 'ENGINEER',
    permissions: [PERMISSIONS.SUBMISSIONS_CREATE.key],
  },
  // Reserved for later phases (QA/Safety/Procurement/Finance/Client Portal) — seeded now so
  // they exist as assignable roles, but intentionally granted no permissions until those
  // phases build the modules that use them.
  QA_MANAGER: { name: 'QA Manager', permissions: [] },
  SAFETY_MANAGER: { name: 'Safety Manager', permissions: [] },
  PROCUREMENT: { name: 'Procurement', permissions: [] },
  FINANCE: { name: 'Finance', permissions: [] },
  CLIENT_ADMIN: { name: 'Client Admin', permissions: [] },
  CLIENT_ENGINEER: { name: 'Client Engineer', permissions: [] },
  VENDOR_CONTRACTOR: { name: 'Vendor / Contractor', permissions: [] },
};

module.exports = { PERMISSIONS, PERMISSION_LIST, ALL_PERMISSION_KEYS, ROLES };

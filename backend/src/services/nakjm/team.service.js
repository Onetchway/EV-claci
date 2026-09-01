'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../../middleware/tenantScope');

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.status)     { conditions.push(`status = $${idx++}`);     params.push(filters.status); }
  if (filters.department) { conditions.push(`department = $${idx++}`); params.push(filters.department); }
  if (filters.search)     { conditions.push(`name ILIKE $${idx++}`);   params.push(`%${filters.search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_team_members ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT t.*,
      (SELECT COUNT(*) FROM nakjm_project_team pt WHERE pt.team_member_id = t.id) AS active_project_count
     FROM nakjm_team_members t ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(`SELECT * FROM nakjm_team_members WHERE ${conditions.join(' AND ')}`, params);
  if (!res.rows[0]) { const e = new Error('Team member not found'); e.status = 404; throw e; }

  const projectsRes = await query(
    `SELECT p.id, p.project_code, p.name, p.status, pt.project_role, pt.assigned_date
     FROM nakjm_project_team pt JOIN nakjm_projects p ON p.id = pt.project_id
     WHERE pt.team_member_id = $1 ORDER BY pt.assigned_date DESC`,
    [id]
  );

  return { ...res.rows[0], projects: projectsRes.rows };
};

const create = async (data, req) => {
  const {
    name, email = null, phone = null, designation = null, department = 'site',
    joined_date = null, status = 'active',
  } = data;
  if (!name) { const e = new Error('name is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_team_members (id, tenant_id, name, email, phone, designation, department, joined_date, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), name, email, phone, designation, department, joined_date, status]
  );
  return res.rows[0];
};

const update = async (id, data, req) => {
  const allowed = ['name', 'email', 'phone', 'designation', 'department', 'joined_date', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE nakjm_team_members SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Team member not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM nakjm_team_members WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Team member not found'); e.status = 404; throw e; }
};

// ── Project assignment ──────────────────────────────────────────────────
const assignToProject = async (projectId, data, req) => {
  const { team_member_id, project_role = null, assigned_date = null } = data;
  if (!team_member_id) { const e = new Error('team_member_id is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_project_team (id, tenant_id, project_id, team_member_id, project_role, assigned_date, created_at)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),NOW())
     ON CONFLICT (project_id, team_member_id) DO UPDATE SET project_role = EXCLUDED.project_role
     RETURNING *`,
    [id, tenantIdForInsert(req), projectId, team_member_id, project_role, assigned_date]
  );
  return res.rows[0];
};

const unassignFromProject = async (projectId, teamMemberId, req) => {
  let sql = 'DELETE FROM nakjm_project_team WHERE project_id = $1 AND team_member_id = $2';
  const params = [projectId, teamMemberId];
  const tenant = tenantWhere(req, 3);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Assignment not found'); e.status = 404; throw e; }
};

const listByProject = async (projectId, req) => {
  const conditions = ['pt.project_id = $1'];
  const params = [projectId];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'pt.tenant_id')); params.push(...tenant.params); }
  const res = await query(
    `SELECT t.*, pt.project_role, pt.assigned_date FROM nakjm_project_team pt
     JOIN nakjm_team_members t ON t.id = pt.team_member_id
     WHERE ${conditions.join(' AND ')} ORDER BY pt.assigned_date DESC`,
    params
  );
  return res.rows;
};

module.exports = { list, getOne, create, update, remove, assignToProject, unassignFromProject, listByProject };

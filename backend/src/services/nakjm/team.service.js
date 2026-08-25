'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

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

const getOne = async (id) => {
  const res = await query('SELECT * FROM nakjm_team_members WHERE id = $1', [id]);
  if (!res.rows[0]) { const e = new Error('Team member not found'); e.status = 404; throw e; }

  const projectsRes = await query(
    `SELECT p.id, p.project_code, p.name, p.status, pt.project_role, pt.assigned_date
     FROM nakjm_project_team pt JOIN nakjm_projects p ON p.id = pt.project_id
     WHERE pt.team_member_id = $1 ORDER BY pt.assigned_date DESC`,
    [id]
  );

  return { ...res.rows[0], projects: projectsRes.rows };
};

const create = async (data) => {
  const {
    name, email = null, phone = null, designation = null, department = 'site',
    joined_date = null, status = 'active',
  } = data;
  if (!name) { const e = new Error('name is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_team_members (id, name, email, phone, designation, department, joined_date, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING *`,
    [id, name, email, phone, designation, department, joined_date, status]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['name', 'email', 'phone', 'designation', 'department', 'joined_date', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE nakjm_team_members SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Team member not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM nakjm_team_members WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Team member not found'); e.status = 404; throw e; }
};

// ── Project assignment ──────────────────────────────────────────────────
const assignToProject = async (projectId, data) => {
  const { team_member_id, project_role = null, assigned_date = null } = data;
  if (!team_member_id) { const e = new Error('team_member_id is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_project_team (id, project_id, team_member_id, project_role, assigned_date, created_at)
     VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE),NOW())
     ON CONFLICT (project_id, team_member_id) DO UPDATE SET project_role = EXCLUDED.project_role
     RETURNING *`,
    [id, projectId, team_member_id, project_role, assigned_date]
  );
  return res.rows[0];
};

const unassignFromProject = async (projectId, teamMemberId) => {
  const res = await query(
    'DELETE FROM nakjm_project_team WHERE project_id = $1 AND team_member_id = $2 RETURNING id',
    [projectId, teamMemberId]
  );
  if (!res.rows[0]) { const e = new Error('Assignment not found'); e.status = 404; throw e; }
};

const listByProject = async (projectId) => {
  const res = await query(
    `SELECT t.*, pt.project_role, pt.assigned_date FROM nakjm_project_team pt
     JOIN nakjm_team_members t ON t.id = pt.team_member_id
     WHERE pt.project_id = $1 ORDER BY pt.assigned_date DESC`,
    [projectId]
  );
  return res.rows;
};

module.exports = { list, getOne, create, update, remove, assignToProject, unassignFromProject, listByProject };

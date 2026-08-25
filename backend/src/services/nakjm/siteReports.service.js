'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.project_id)   { conditions.push(`sr.project_id = $${idx++}`);   params.push(filters.project_id); }
  if (filters.report_type)  { conditions.push(`sr.report_type = $${idx++}`);  params.push(filters.report_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*) FROM nakjm_site_reports sr ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT sr.*, p.name AS project_name, tm.name AS reported_by_name
     FROM nakjm_site_reports sr
     LEFT JOIN nakjm_projects p ON p.id = sr.project_id
     LEFT JOIN nakjm_team_members tm ON tm.id = sr.reported_by
     ${where} ORDER BY sr.report_date DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );
  return paginatedResponse(dataRes.rows, total, page, limit);
};

const create = async (data) => {
  const {
    project_id, reported_by = null, report_date = null, report_type = 'daily',
    progress_percent = 0, work_done = null, issues = null, manpower_count = 0,
    weather = null, visible_to_client = false,
  } = data;
  if (!project_id) { const e = new Error('project_id is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_site_reports (id, project_id, reported_by, report_date, report_type, progress_percent, work_done, issues, manpower_count, weather, visible_to_client, created_at)
     VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
    [id, project_id, reported_by, report_date, report_type, progress_percent, work_done, issues, manpower_count, weather, visible_to_client]
  );
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM nakjm_site_reports WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Site report not found'); e.status = 404; throw e; }
};

module.exports = { list, create, remove };

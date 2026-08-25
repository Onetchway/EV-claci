'use strict';

const { query } = require('../../config/database');

const overview = async () => {
  const [
    clientsRes, vendorsRes, teamRes,
    projectsByStatusRes, contractRes,
    clientCollectedRes, clientInvoicedRes,
    vendorCommittedRes, vendorPaidRes,
    upcomingRes, recentReportsRes,
  ] = await Promise.all([
    query(`SELECT COUNT(*) FROM nakjm_clients WHERE status = 'active'`),
    query(`SELECT COUNT(*) FROM nakjm_vendors WHERE status = 'active'`),
    query(`SELECT COUNT(*) FROM nakjm_team_members WHERE status = 'active'`),
    query(`SELECT status, COUNT(*) AS count FROM nakjm_projects GROUP BY status`),
    query(`SELECT COALESCE(SUM(contract_value),0) AS total, COALESCE(SUM(budget_amount),0) AS budget FROM nakjm_projects WHERE status NOT IN ('cancelled')`),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM nakjm_client_payments`),
    query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM nakjm_proforma_invoices WHERE status != 'cancelled'`),
    query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM nakjm_purchase_orders WHERE status != 'cancelled'`),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM nakjm_vendor_payments`),
    query(
      `SELECT id, project_code, name, status, target_end_date FROM nakjm_projects
       WHERE target_end_date IS NOT NULL AND status IN ('approved','in_progress')
       ORDER BY target_end_date ASC LIMIT 8`
    ),
    query(
      `SELECT sr.id, sr.report_date, sr.progress_percent, sr.report_type, p.name AS project_name
       FROM nakjm_site_reports sr LEFT JOIN nakjm_projects p ON p.id = sr.project_id
       ORDER BY sr.created_at DESC LIMIT 8`
    ),
  ]);

  const collected = parseFloat(clientCollectedRes.rows[0].total);
  const invoiced = parseFloat(clientInvoicedRes.rows[0].total);
  const committed = parseFloat(vendorCommittedRes.rows[0].total);
  const paidToVendors = parseFloat(vendorPaidRes.rows[0].total);
  const contractValue = parseFloat(contractRes.rows[0].total);
  const budget = parseFloat(contractRes.rows[0].budget);

  return {
    active_clients: parseInt(clientsRes.rows[0].count, 10),
    active_vendors: parseInt(vendorsRes.rows[0].count, 10),
    active_team_members: parseInt(teamRes.rows[0].count, 10),
    projects_by_status: projectsByStatusRes.rows.map(r => ({ status: r.status, count: parseInt(r.count, 10) })),
    total_contract_value: contractValue,
    total_budget: budget,
    client_invoiced: invoiced,
    client_collected: collected,
    client_collection_pending: Math.max(invoiced - collected, 0),
    client_collection_percent: contractValue > 0 ? parseFloat(((collected / contractValue) * 100).toFixed(2)) : 0,
    vendor_committed: committed,
    vendor_paid: paidToVendors,
    vendor_outstanding: Math.max(committed - paidToVendors, 0),
    estimated_margin: contractValue - committed,
    upcoming_deadlines: upcomingRes.rows,
    recent_site_reports: recentReportsRes.rows,
  };
};

module.exports = { overview };

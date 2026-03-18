'use strict';

const { query } = require('../config/database');

const adminDashboard = async () => {
  const now = new Date();
  const mtdStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    stationsRes,
    chargerStatusRes,
    activeSessionsRes,
    usersRes,
    revenueMtdRes,
    energyMtdRes,
    topStationsRes,
    recentSessionsRes,
  ] = await Promise.all([
    query(`SELECT status, COUNT(*) AS count FROM stations GROUP BY status`),
    query(`SELECT status, COUNT(*) AS count FROM chargers GROUP BY status`),
    query(`SELECT COUNT(*) AS count FROM charging_sessions WHERE status = 'active'`),
    query(`SELECT COUNT(*) AS count FROM users`),
    query(
      `SELECT COALESCE(SUM(total_revenue),0) AS total, COALESCE(SUM(charging_revenue),0) AS charging,
              COALESCE(SUM(bss_swap_revenue),0) AS bss_swap, COALESCE(SUM(bss_rental_revenue),0) AS bss_rental,
              COALESCE(SUM(gross_margin),0) AS gross_margin
       FROM revenues WHERE date >= $1`,
      [mtdStart]
    ),
    query(
      `SELECT COALESCE(SUM(energy_consumed),0) AS total FROM revenues WHERE date >= $1`,
      [mtdStart]
    ),
    query(
      `SELECT r.station_id, s.name, s.city, SUM(r.total_revenue) AS revenue
       FROM revenues r JOIN stations s ON s.id = r.station_id
       WHERE r.date >= $1
       GROUP BY r.station_id, s.name, s.city
       ORDER BY revenue DESC LIMIT 5`,
      [mtdStart]
    ),
    query(
      `SELECT cs.id, cs.start_time, cs.end_time, cs.energy_kwh, cs.revenue, cs.status,
              s.name AS station_name, c.connector_type
       FROM charging_sessions cs
       LEFT JOIN stations s ON s.id = cs.station_id
       LEFT JOIN chargers c ON c.id = cs.charger_id
       ORDER BY cs.created_at DESC LIMIT 10`
    ),
  ]);

  const stationStatusBreakdown = {};
  let totalStations = 0;
  for (const row of stationsRes.rows) {
    stationStatusBreakdown[row.status] = parseInt(row.count);
    totalStations += parseInt(row.count);
  }

  const chargerStatusBreakdown = {};
  let totalChargers = 0;
  let activeChargers = 0;
  for (const row of chargerStatusRes.rows) {
    chargerStatusBreakdown[row.status] = parseInt(row.count);
    totalChargers += parseInt(row.count);
    if (row.status === 'available' || row.status === 'charging') {
      activeChargers += parseInt(row.count);
    }
  }

  return {
    success: true,
    data: {
      total_stations: totalStations,
      active_chargers: activeChargers,
      total_chargers: totalChargers,
      total_bss: 0, // computed below
      total_users: parseInt(usersRes.rows[0].count),
      total_revenue_mtd: parseFloat(revenueMtdRes.rows[0].total),
      total_energy_mtd: parseFloat(energyMtdRes.rows[0].total),
      active_sessions: parseInt(activeSessionsRes.rows[0].count),
      station_status_breakdown: stationStatusBreakdown,
      charger_status_breakdown: chargerStatusBreakdown,
      top_stations_by_revenue: topStationsRes.rows,
      recent_sessions: recentSessionsRes.rows,
      revenue_breakdown_mtd: {
        charging: parseFloat(revenueMtdRes.rows[0].charging),
        bss_swap: parseFloat(revenueMtdRes.rows[0].bss_swap),
        bss_rental: parseFloat(revenueMtdRes.rows[0].bss_rental),
        gross_margin: parseFloat(revenueMtdRes.rows[0].gross_margin),
      },
    },
    message: 'Admin dashboard retrieved successfully',
  };
};

// Fetch total_bss and merge into adminDashboard
const adminDashboardFull = async () => {
  const [dashboard, bssRes] = await Promise.all([
    adminDashboard(),
    query('SELECT COUNT(*) AS count FROM bss_stations'),
  ]);
  dashboard.data.total_bss = parseInt(bssRes.rows[0].count);
  return dashboard;
};

const stationDashboard = async (stationId) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const mtdStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    stationRes,
    chargerStatusRes,
    activeSessionsRes,
    todayRevRes,
    mtdRevRes,
    mtdEnergyRes,
    recentSessionsRes,
    recentSwapsRes,
  ] = await Promise.all([
    query('SELECT * FROM stations WHERE id = $1', [stationId]),
    query(`SELECT status, COUNT(*) AS count FROM chargers WHERE station_id=$1 GROUP BY status`, [stationId]),
    query(`SELECT COUNT(*) AS count FROM charging_sessions WHERE station_id=$1 AND status='active'`, [stationId]),
    query(
      `SELECT COALESCE(SUM(total_revenue),0) AS total, COALESCE(SUM(gross_margin),0) AS margin
       FROM revenues WHERE station_id=$1 AND date=$2`,
      [stationId, today]
    ),
    query(
      `SELECT COALESCE(SUM(total_revenue),0) AS total, COALESCE(SUM(gross_margin),0) AS margin
       FROM revenues WHERE station_id=$1 AND date >= $2`,
      [stationId, mtdStart]
    ),
    query(
      `SELECT COALESCE(SUM(energy_consumed),0) AS total FROM revenues WHERE station_id=$1 AND date >= $2`,
      [stationId, mtdStart]
    ),
    query(
      `SELECT cs.*, c.connector_type FROM charging_sessions cs
       LEFT JOIN chargers c ON c.id = cs.charger_id
       WHERE cs.station_id=$1 ORDER BY cs.created_at DESC LIMIT 5`,
      [stationId]
    ),
    query(
      `SELECT bs.*, b.battery_type FROM bss_swaps bs
       LEFT JOIN bss_stations b ON b.id = bs.bss_station_id
       WHERE bs.station_id=$1 ORDER BY bs.created_at DESC LIMIT 5`,
      [stationId]
    ),
  ]);

  if (!stationRes.rows[0]) {
    const e = new Error('Station not found'); e.status = 404; throw e;
  }

  const chargerStatus = {};
  let totalChargers = 0;
  let activeChargers = 0;
  for (const row of chargerStatusRes.rows) {
    chargerStatus[row.status] = parseInt(row.count);
    totalChargers += parseInt(row.count);
    if (row.status === 'available' || row.status === 'charging') activeChargers += parseInt(row.count);
  }

  const utilization = totalChargers > 0
    ? parseFloat(((chargerStatus['charging'] || 0) / totalChargers * 100).toFixed(1))
    : 0;

  return {
    success: true,
    data: {
      station: stationRes.rows[0],
      charger_statuses: chargerStatus,
      total_chargers: totalChargers,
      active_chargers: activeChargers,
      utilization_percent: utilization,
      active_sessions: parseInt(activeSessionsRes.rows[0].count),
      revenue_today: parseFloat(todayRevRes.rows[0].total),
      margin_today: parseFloat(todayRevRes.rows[0].margin),
      revenue_mtd: parseFloat(mtdRevRes.rows[0].total),
      margin_mtd: parseFloat(mtdRevRes.rows[0].margin),
      energy_mtd_kwh: parseFloat(mtdEnergyRes.rows[0].total),
      recent_sessions: recentSessionsRes.rows,
      recent_swaps: recentSwapsRes.rows,
    },
    message: 'Station dashboard retrieved successfully',
  };
};

const franchiseDashboard = async (franchiseId) => {
  const frRes = await query('SELECT * FROM franchises WHERE id = $1', [franchiseId]);
  if (!frRes.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  const franchise = frRes.rows[0];

  const [assetsRes, settlementsRes] = await Promise.all([
    query(
      `SELECT a.*, s.name AS station_name, s.city FROM assets a
       LEFT JOIN stations s ON s.id = a.station_id
       WHERE a.franchise_id = $1`,
      [franchiseId]
    ),
    query(
      `SELECT * FROM settlements WHERE franchise_id = $1 ORDER BY created_at DESC`,
      [franchiseId]
    ),
  ]);

  const assets = assetsRes.rows;
  const settlements = settlementsRes.rows;
  const stationIds = [...new Set(assets.map(a => a.station_id).filter(Boolean))];

  let totalRevenue = 0;
  if (stationIds.length > 0) {
    const placeholders = stationIds.map((_, i) => `$${i + 1}`).join(',');
    const revRes = await query(
      `SELECT COALESCE(SUM(total_revenue),0) AS total FROM revenues WHERE station_id IN (${placeholders})`,
      stationIds
    );
    totalRevenue = parseFloat(revRes.rows[0].total);
  }

  const totalEarned = settlements
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + parseFloat(s.franchise_share || 0), 0);

  const pendingSettlements = settlements.filter(s => s.status === 'pending');

  const roi = parseFloat(franchise.investment_amount) > 0
    ? parseFloat(((totalEarned / parseFloat(franchise.investment_amount)) * 100).toFixed(2))
    : 0;

  return {
    success: true,
    data: {
      franchise,
      total_investment: parseFloat(franchise.investment_amount),
      total_earnings: totalEarned,
      roi_percent: roi,
      assets_list: assets,
      pending_settlements: pendingSettlements,
      recent_settlements: settlements.slice(0, 6),
      projected_share: parseFloat((totalRevenue * parseFloat(franchise.revenue_share_percent) / 100).toFixed(2)),
    },
    message: 'Franchise dashboard retrieved successfully',
  };
};

module.exports = { adminDashboard: adminDashboardFull, stationDashboard, franchiseDashboard };

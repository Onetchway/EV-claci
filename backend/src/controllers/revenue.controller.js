'use strict';

const svc = require('../services/revenue.service');
const { sendCsv } = require('../utils/csvExport');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list(req.query)); } catch (e) { next(e); }
};

exports.byStation = async (req, res, next) => {
  try {
    const data = await svc.byStation(req.params.stationId, req.query);
    res.json({ success: true, data, message: 'Station revenue retrieved successfully' });
  } catch (e) { next(e); }
};

exports.computeRevenue = async (req, res, next) => {
  try {
    const { stationId, station_id, date } = req.body;
    const data = await svc.computeRevenue(stationId || station_id, date);
    res.json({ success: true, data, message: 'Revenue computed successfully' });
  } catch (e) { next(e); }
};

exports.summary = async (req, res, next) => {
  try {
    const data = await svc.summary(req.query);
    res.json({ success: true, data, message: 'Revenue summary retrieved successfully' });
  } catch (e) { next(e); }
};

exports.pnl = async (req, res, next) => {
  try {
    const stId = req.params.stationId || req.query.station_id || req.query.stationId;
    const data = await svc.getPnL(stId, req.query);
    res.json({ success: true, data, message: 'P&L retrieved successfully' });
  } catch (e) { next(e); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const rows = await svc.exportForCsv(req.query);
    const csvRows = rows.map(r => ({
      Date: r.date,
      'Station Name': r.station_name,
      City: r.city,
      'Charging Revenue': r.charging_revenue,
      'BSS Swap Revenue': r.bss_swap_revenue,
      'BSS Rental Revenue': r.bss_rental_revenue,
      'Total Revenue': r.total_revenue,
      'Electricity Cost': r.electricity_cost,
      'Gross Margin': r.gross_margin,
      'Energy Consumed (kWh)': r.energy_consumed,
      'Session Count': r.session_count,
    }));
    sendCsv(res, csvRows, `revenue-export-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { next(e); }
};

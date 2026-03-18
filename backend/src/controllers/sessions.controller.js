'use strict';

const svc = require('../services/sessions.service');
const { sendCsv } = require('../utils/csvExport');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list(req.query)); } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try {
    const data = await svc.getOne(req.params.id);
    res.json({ success: true, data, message: 'Session retrieved successfully' });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const data = await svc.create(req.body);
    res.status(201).json({ success: true, data, message: 'Session created successfully' });
  } catch (e) { next(e); }
};

exports.endSession = async (req, res, next) => {
  try {
    const data = await svc.endSession(req.params.id, req.body);
    res.json({ success: true, data, message: 'Session ended successfully' });
  } catch (e) { next(e); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const rows = await svc.exportForCsv(req.query);
    const csvRows = rows.map(r => ({
      'Session ID': r.id,
      'User Ref': r.user_ref || '',
      'Station': r.station_name,
      'City': r.city,
      'State': r.state,
      'Connector Type': r.connector_type || '',
      'OCPP ID': r.ocpp_id || '',
      'Start Time': r.start_time,
      'End Time': r.end_time || '',
      'Energy (kWh)': r.energy_kwh,
      'Revenue': r.revenue,
      'Electricity Cost': r.electricity_cost,
      'Margin': r.margin,
      'Status': r.status,
    }));
    sendCsv(res, csvRows, `sessions-export-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { next(e); }
};

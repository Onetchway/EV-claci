'use strict';

const svc = require('../services/settlements.service');
const { sendCsv } = require('../utils/csvExport');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list(req.query)); } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try {
    const data = await svc.getOne(req.params.id);
    res.json({ success: true, data, message: 'Settlement retrieved successfully' });
  } catch (e) { next(e); }
};

exports.generate = async (req, res, next) => {
  try {
    const data = await svc.generate(req.body);
    res.status(201).json({ success: true, data, message: 'Settlement generated successfully' });
  } catch (e) { next(e); }
};

exports.approve = async (req, res, next) => {
  try {
    const data = await svc.approve(req.params.id);
    res.json({ success: true, data, message: 'Settlement approved successfully' });
  } catch (e) { next(e); }
};

exports.markPaid = async (req, res, next) => {
  try {
    const data = await svc.markPaid(req.params.id);
    res.json({ success: true, data, message: 'Settlement marked as paid' });
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const data = await svc.updateStatus(req.params.id, req.body.status, req.body.notes);
    res.json({ success: true, data, message: 'Settlement status updated' });
  } catch (e) { next(e); }
};

exports.getReport = async (req, res, next) => {
  try {
    const data = await svc.getReport(req.params.id);
    res.json({ success: true, data, message: 'Settlement report retrieved successfully' });
  } catch (e) { next(e); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const s = await svc.getOne(req.params.id);
    const rows = [{
      'Settlement ID': s.id,
      'Franchise': s.franchise_name,
      'Station': s.station_name,
      'Period Start': s.period_start,
      'Period End': s.period_end,
      'Total Revenue': s.total_revenue,
      'Franchise Share': s.franchise_share,
      'Company Share': s.company_share,
      'Status': s.status,
      'Generated At': s.generated_at,
      'Paid At': s.paid_at || '',
    }];
    sendCsv(res, rows, `settlement-${s.id}.csv`);
  } catch (e) { next(e); }
};

const svc = require('../services/settlements.service');
const { sendCsv } = require('../utils/csvExport');

exports.list         = async (req, res, next) => { try { res.json(await svc.list(req.query)); } catch (e) { next(e); } };
exports.getOne       = async (req, res, next) => { try { res.json(await svc.getOne(req.params.id)); } catch (e) { next(e); } };
exports.generate     = async (req, res, next) => { try { res.status(201).json(await svc.generate(req.body)); } catch (e) { next(e); } };
exports.updateStatus = async (req, res, next) => { try { res.json(await svc.updateStatus(req.params.id, req.body.status, req.body.notes)); } catch (e) { next(e); } };

exports.exportCsv = async (req, res, next) => {
  try {
    const s = await svc.getOne(req.params.id);
    const rows = [{ Franchise: s.franchise.name, PeriodStart: s.periodStart, PeriodEnd: s.periodEnd, TotalRevenue: s.totalRevenue, FranchiseShare: s.franchiseShare, CompanyShare: s.companyShare, Status: s.status }];
    sendCsv(res, rows, `settlement-${s.id}.csv`);
  } catch (e) { next(e); }
};

const svc = require('../services/invoices.service');

exports.list = async (req, res, next) => { try { res.json(await svc.list(req.query)); } catch (e) { next(e); } };
exports.getOne = async (req, res, next) => { try { res.json(await svc.getOne(req.params.id)); } catch (e) { next(e); } };

exports.generate = async (req, res, next) => {
  try {
    const periodStart = new Date(req.body.period_start);
    const periodEnd = new Date(req.body.period_end);
    if (isNaN(periodStart) || isNaN(periodEnd)) {
      return res.status(400).json({ error: 'period_start and period_end must be valid dates.' });
    }
    res.status(201).json(await svc.generateForTenant(req.params.tenantId, periodStart, periodEnd, req.superAdmin));
  } catch (e) { next(e); }
};

exports.preview = async (req, res, next) => {
  try {
    const periodStart = new Date(req.query.period_start);
    const periodEnd = new Date(req.query.period_end);
    if (isNaN(periodStart) || isNaN(periodEnd)) {
      return res.status(400).json({ error: 'period_start and period_end must be valid dates.' });
    }
    res.json(await svc.previewForTenant(req.params.tenantId, periodStart, periodEnd));
  } catch (e) { next(e); }
};

exports.markPaid = async (req, res, next) => { try { res.json(await svc.setStatus(req.params.id, 'paid', req.superAdmin)); } catch (e) { next(e); } };
exports.void = async (req, res, next) => { try { res.json(await svc.setStatus(req.params.id, 'void', req.superAdmin)); } catch (e) { next(e); } };
exports.resendEmail = async (req, res, next) => { try { res.json(await svc.resendEmail(req.params.id, req.superAdmin)); } catch (e) { next(e); } };
exports.recalculate = async (req, res, next) => { try { res.json(await svc.recalculate(req.params.id, req.superAdmin)); } catch (e) { next(e); } };

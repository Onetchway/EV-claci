const svc = require('../services/credits.service');

exports.listForTenant = async (req, res, next) => {
  try {
    const [ledger, balance] = await Promise.all([
      svc.listForTenant(req.params.tenantId),
      svc.balanceForTenant(req.params.tenantId),
    ]);
    res.json({ data: ledger, balance });
  } catch (e) { next(e); }
};
exports.addCredit = async (req, res, next) => {
  try { res.status(201).json(await svc.addCredit(req.params.tenantId, Number(req.body.amount), req.body.reason, req.superAdmin)); }
  catch (e) { next(e); }
};

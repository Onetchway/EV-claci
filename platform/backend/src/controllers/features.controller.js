const svc = require('../services/features.service');

exports.listCatalog = async (req, res, next) => { try { res.json({ data: await svc.listCatalog() }); } catch (e) { next(e); } };
exports.listForTenant = async (req, res, next) => { try { res.json({ data: await svc.listForTenant(req.params.tenantId) }); } catch (e) { next(e); } };
exports.setForTenant = async (req, res, next) => {
  try { res.json(await svc.setForTenant(req.params.tenantId, req.params.featureKey, !!req.body.enabled, req.superAdmin)); }
  catch (e) { next(e); }
};
exports.bulkSetForTenant = async (req, res, next) => {
  try { res.json({ data: await svc.bulkSetForTenant(req.params.tenantId, req.body.features || [], req.superAdmin) }); }
  catch (e) { next(e); }
};

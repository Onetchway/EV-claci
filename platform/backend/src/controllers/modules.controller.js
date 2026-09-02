const svc = require('../services/modules.service');

exports.listCatalog = async (req, res, next) => { try { res.json({ data: await svc.listCatalog() }); } catch (e) { next(e); } };
exports.updateCatalog = async (req, res, next) => { try { res.json(await svc.updateCatalog(req.params.key, req.body)); } catch (e) { next(e); } };
exports.listForTenant = async (req, res, next) => { try { res.json({ data: await svc.listForTenant(req.params.tenantId) }); } catch (e) { next(e); } };
// Tenant-authenticated (X-Tenant-Api-Key) — a tenant's own CRM asks "which whole modules am I allowed to show?"
exports.listForSelf = async (req, res, next) => { try { res.json({ data: await svc.listForTenant(req.tenant.id) }); } catch (e) { next(e); } };
exports.setForTenant = async (req, res, next) => {
  try { res.json(await svc.setForTenant(req.params.tenantId, req.params.moduleKey, !!req.body.enabled, req.superAdmin)); }
  catch (e) { next(e); }
};
exports.bulkSetForTenant = async (req, res, next) => {
  try { res.json({ data: await svc.bulkSetForTenant(req.params.tenantId, req.body.modules || [], req.superAdmin) }); }
  catch (e) { next(e); }
};

const svc = require('../services/addOns.service');

exports.listCatalog = async (req, res, next) => { try { res.json({ data: await svc.listCatalog() }); } catch (e) { next(e); } };
exports.createCatalog = async (req, res, next) => { try { res.status(201).json(await svc.createCatalog(req.body)); } catch (e) { next(e); } };
exports.updateCatalog = async (req, res, next) => { try { res.json(await svc.updateCatalog(req.params.id, req.body)); } catch (e) { next(e); } };
exports.removeCatalog = async (req, res, next) => { try { await svc.removeCatalog(req.params.id); res.status(204).end(); } catch (e) { next(e); } };

exports.listForTenant = async (req, res, next) => { try { res.json({ data: await svc.listForTenant(req.params.tenantId) }); } catch (e) { next(e); } };
exports.attachToTenant = async (req, res, next) => {
  try { res.status(201).json(await svc.attachToTenant(req.params.tenantId, req.body.add_on_id, req.body.amount_override, req.superAdmin)); }
  catch (e) { next(e); }
};
exports.detachFromTenant = async (req, res, next) => {
  try { await svc.detachFromTenant(req.params.tenantId, req.params.addOnId, req.superAdmin); res.status(204).end(); }
  catch (e) { next(e); }
};

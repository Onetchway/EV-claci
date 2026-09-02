const svc = require('../services/coupons.service');

exports.list = async (req, res, next) => { try { res.json({ data: await svc.list() }); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body)); } catch (e) { next(e); } };
exports.update = async (req, res, next) => { try { res.json(await svc.update(req.params.id, req.body)); } catch (e) { next(e); } };

exports.listForTenant = async (req, res, next) => { try { res.json({ data: await svc.listForTenant(req.params.tenantId) }); } catch (e) { next(e); } };
exports.assignToTenant = async (req, res, next) => {
  try { res.status(201).json(await svc.assignToTenant(req.params.tenantId, req.body.coupon_id, req.superAdmin)); }
  catch (e) { next(e); }
};
exports.unassignFromTenant = async (req, res, next) => {
  try { await svc.unassignFromTenant(req.params.tenantId, req.params.tenantCouponId, req.superAdmin); res.status(204).end(); }
  catch (e) { next(e); }
};

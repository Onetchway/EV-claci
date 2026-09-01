const svc = require('../services/franchise.service');

// A "franchise"-role user (see database/schema.sql's users.role check and
// src/middleware/rbac.js) is that franchise partner's own login — they may
// only ever look at their own franchise_id, never another one in the same
// tenant. ADMIN/FINANCE aren't restricted by this.
function assertOwnFranchiseOrStaff(req, id) {
  if (req.user.role === 'franchise' && req.user.franchise_id !== id) {
    const e = new Error('Access denied.'); e.status = 403; throw e;
  }
}

exports.list               = async (req, res, next) => { try { res.json(await svc.list(req.query, req)); } catch (e) { next(e); } };
exports.getOne             = async (req, res, next) => {
  try { assertOwnFranchiseOrStaff(req, req.params.id); res.json(await svc.getOne(req.params.id, req)); }
  catch (e) { next(e); }
};
exports.create              = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body, req)); } catch (e) { next(e); } };
exports.update             = async (req, res, next) => { try { res.json(await svc.update(req.params.id, req.body, req)); } catch (e) { next(e); } };
exports.remove             = async (req, res, next) => { try { await svc.remove(req.params.id, req); res.status(204).end(); } catch (e) { next(e); } };
exports.franchiseDashboard = async (req, res, next) => {
  try { assertOwnFranchiseOrStaff(req, req.params.id); res.json(await svc.franchiseDashboard(req.params.id, req)); }
  catch (e) { next(e); }
};
// GET /api/franchises/portal/dashboard — the franchise partner's own portal.
exports.portalDashboard = async (req, res, next) => {
  try {
    if (!req.user.franchise_id) { const e = new Error('This account is not linked to a franchise.'); e.status = 403; throw e; }
    res.json(await svc.franchiseDashboard(req.user.franchise_id, req));
  } catch (e) { next(e); }
};

const svc = require('../services/usage.service');

// Called by a TENANT's own backend (authenticated via its API key), not by super admin.
exports.report = async (req, res, next) => {
  try { res.status(201).json(await svc.reportUsage(req.tenant.id, req.body.employee_count)); }
  catch (e) { next(e); }
};

// Called by super admin to see billing-relevant counts only (never who the employees are).
exports.listForTenant = async (req, res, next) => {
  try { res.json({ data: await svc.latestForTenant(req.params.tenantId) }); }
  catch (e) { next(e); }
};

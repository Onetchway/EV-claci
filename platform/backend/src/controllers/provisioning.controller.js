const svc = require('../services/provisioning.service');

exports.provisionIsolatedDatabase = async (req, res, next) => {
  try { res.status(201).json(await svc.provisionIsolatedDatabase(req.params.tenantId, req.superAdmin)); }
  catch (e) { next(e); }
};

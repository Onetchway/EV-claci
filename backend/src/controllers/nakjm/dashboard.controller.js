const svc = require('../../services/nakjm/dashboard.service');

exports.overview = async (req, res, next) => { try { res.json(await svc.overview(req)); } catch (e) { next(e); } };

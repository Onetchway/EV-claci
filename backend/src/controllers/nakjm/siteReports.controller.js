const svc = require('../../services/nakjm/siteReports.service');

exports.list   = async (req, res, next) => { try { res.json(await svc.list(req.query, req)); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body, req)); } catch (e) { next(e); } };
exports.remove = async (req, res, next) => { try { await svc.remove(req.params.id, req); res.status(204).end(); } catch (e) { next(e); } };

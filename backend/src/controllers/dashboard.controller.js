const svc = require('../services/dashboard.service');

exports.admin    = async (req, res, next) => { try { res.json(await svc.adminDashboard(req)); } catch (e) { next(e); } };
exports.station  = async (req, res, next) => { try { res.json(await svc.stationDashboard(req.params.stationId, req)); } catch (e) { next(e); } };
exports.franchise = async (req, res, next) => { try { res.json(await svc.franchiseDashboard(req.params.franchiseId, req)); } catch (e) { next(e); } };

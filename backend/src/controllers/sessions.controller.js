const svc = require('../services/sessions.service');

exports.list       = async (req, res, next) => { try { res.json(await svc.list(req.query)); } catch (e) { next(e); } };
exports.getOne     = async (req, res, next) => { try { res.json(await svc.getOne(req.params.id)); } catch (e) { next(e); } };
exports.create     = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body)); } catch (e) { next(e); } };
exports.endSession = async (req, res, next) => { try { res.json(await svc.endSession(req.params.id, req.body)); } catch (e) { next(e); } };

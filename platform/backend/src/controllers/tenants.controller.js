const svc = require('../services/tenants.service');

exports.list = async (req, res, next) => { try { res.json(await svc.list(req.query)); } catch (e) { next(e); } };
exports.getOne = async (req, res, next) => { try { res.json(await svc.getOne(req.params.id)); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body, req.superAdmin)); } catch (e) { next(e); } };
exports.update = async (req, res, next) => { try { res.json(await svc.update(req.params.id, req.body, req.superAdmin)); } catch (e) { next(e); } };
exports.setStatus = async (req, res, next) => { try { res.json(await svc.setStatus(req.params.id, req.body.status, req.superAdmin)); } catch (e) { next(e); } };
exports.rotateApiKey = async (req, res, next) => { try { res.json(await svc.rotateApiKey(req.params.id, req.superAdmin)); } catch (e) { next(e); } };
exports.remove = async (req, res, next) => { try { await svc.remove(req.params.id, req.superAdmin); res.status(204).end(); } catch (e) { next(e); } };

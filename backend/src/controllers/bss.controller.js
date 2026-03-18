const svc = require('../services/bss.service');

exports.list        = async (req, res, next) => { try { res.json(await svc.list(req.query)); } catch (e) { next(e); } };
exports.getOne      = async (req, res, next) => { try { res.json(await svc.getOne(req.params.id)); } catch (e) { next(e); } };
exports.create      = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body)); } catch (e) { next(e); } };
exports.update      = async (req, res, next) => { try { res.json(await svc.update(req.params.id, req.body)); } catch (e) { next(e); } };
exports.remove      = async (req, res, next) => { try { await svc.remove(req.params.id); res.status(204).end(); } catch (e) { next(e); } };
exports.recordUsage = async (req, res, next) => { try { res.status(201).json(await svc.recordUsage(req.params.id, req.body)); } catch (e) { next(e); } };
exports.getUsage    = async (req, res, next) => { try { res.json(await svc.getUsage(req.params.id, req.query)); } catch (e) { next(e); } };

const svc = require('../services/auth.service');

exports.login = async (req, res, next) => { try { res.json(await svc.login(req.body)); } catch (e) { next(e); } };
exports.me    = async (req, res, next) => { try { res.json({ data: req.superAdmin }); } catch (e) { next(e); } };

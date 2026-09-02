const svc = require('../services/admins.service');

exports.list = async (req, res, next) => { try { res.json({ data: await svc.list() }); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body, req.superAdmin)); } catch (e) { next(e); } };
exports.update = async (req, res, next) => {
  try { res.json(await svc.update(req.params.id, req.body, req.superAdmin)); }
  catch (e) { next(e); }
};

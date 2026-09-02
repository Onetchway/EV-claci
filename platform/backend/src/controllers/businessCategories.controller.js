'use strict';

const svc = require('../services/businessCategories.service');

exports.list = async (req, res, next) => {
  try { res.json({ data: await svc.list() }); }
  catch (e) { next(e); }
};

exports.recommendations = async (req, res, next) => {
  try { res.json(await svc.getRecommendations(req.params.key)); }
  catch (e) { next(e); }
};

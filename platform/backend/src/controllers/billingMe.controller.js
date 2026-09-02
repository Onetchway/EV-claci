'use strict';

const svc = require('../services/billingMe.service');

exports.overview = async (req, res, next) => {
  try { res.json(await svc.overview(req.tenant.id)); }
  catch (e) { next(e); }
};

exports.listInvoices = async (req, res, next) => {
  try { res.json({ data: await svc.listInvoices(req.tenant.id) }); }
  catch (e) { next(e); }
};

exports.invoiceReceipt = async (req, res, next) => {
  try { res.json(await svc.getInvoiceReceipt(req.tenant.id, req.params.invoiceId)); }
  catch (e) { next(e); }
};

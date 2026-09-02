const svc = require('../services/payments.service');

exports.createOrder = async (req, res, next) => {
  try { res.status(201).json(await svc.createOrderForInvoice(req.params.invoiceId, req.superAdmin)); }
  catch (e) { next(e); }
};

exports.listForInvoice = async (req, res, next) => {
  try { res.json({ data: await svc.listForInvoice(req.params.invoiceId) }); }
  catch (e) { next(e); }
};

exports.refund = async (req, res, next) => {
  try { res.json(await svc.refund(req.params.id, req.superAdmin)); }
  catch (e) { next(e); }
};

exports.receipt = async (req, res, next) => {
  try { res.json(await svc.getReceipt(req.params.id)); }
  catch (e) { next(e); }
};

// Public: Razorpay calls this directly, authenticated by its own signature
// header (see payments.service.js's verifyWebhookSignature), not a bearer
// token -- there's no signed-in super admin on an inbound gateway callback.
exports.webhook = async (req, res, next) => {
  try {
    const result = await svc.handleWebhook(req.rawBody, req.headers['x-razorpay-signature']);
    res.json(result);
  } catch (e) { next(e); }
};

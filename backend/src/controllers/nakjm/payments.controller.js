const svc = require('../../services/nakjm/payments.service');

exports.listClientPayments   = async (req, res, next) => { try { res.json(await svc.listClientPayments(req.query)); } catch (e) { next(e); } };
exports.createClientPayment  = async (req, res, next) => { try { res.status(201).json(await svc.createClientPayment(req.body)); } catch (e) { next(e); } };
exports.removeClientPayment  = async (req, res, next) => { try { await svc.removeClientPayment(req.params.id); res.status(204).end(); } catch (e) { next(e); } };

exports.listVendorPayments  = async (req, res, next) => { try { res.json(await svc.listVendorPayments(req.query)); } catch (e) { next(e); } };
exports.createVendorPayment = async (req, res, next) => { try { res.status(201).json(await svc.createVendorPayment(req.body)); } catch (e) { next(e); } };
exports.removeVendorPayment = async (req, res, next) => { try { await svc.removeVendorPayment(req.params.id); res.status(204).end(); } catch (e) { next(e); } };

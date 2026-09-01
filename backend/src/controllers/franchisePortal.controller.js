'use strict';

const svc = require('../services/franchisePortal.service');

// Every "own" handler resolves the franchise from req.user.franchise_id —
// never from a client-supplied id — so a franchise-role login can only
// ever touch its own records. See franchise.controller.js's
// assertOwnFranchiseOrStaff for the equivalent guard on the admin-facing
// :id routes below.
function ownFranchiseId(req) {
  if (!req.user.franchise_id) { const e = new Error('This account is not linked to a franchise.'); e.status = 403; throw e; }
  return req.user.franchise_id;
}

exports.listOwnDocuments   = async (req, res, next) => { try { res.json(await svc.listDocuments(ownFranchiseId(req), req)); } catch (e) { next(e); } };
exports.uploadOwnDocument  = async (req, res, next) => {
  try {
    if (!req.file) { const e = new Error('file is required'); e.status = 400; throw e; }
    res.status(201).json(await svc.uploadDocument(ownFranchiseId(req), {
      file: req.file, kind: req.body.kind, uploaded_by: req.user.name || req.user.email,
    }, req));
  } catch (e) { next(e); }
};
exports.downloadDocument   = async (req, res, next) => {
  try {
    const doc = await svc.getDocument(req.params.id, req);
    if (req.user.role === 'franchise' && doc.franchise_id !== req.user.franchise_id) {
      const e = new Error('Access denied.'); e.status = 403; throw e;
    }
    const { UPLOAD_ROOT } = require('../utils/upload');
    const path = require('path');
    res.download(path.join(UPLOAD_ROOT, doc.file_path), doc.file_name);
  } catch (e) { next(e); }
};

exports.listOwnPayments    = async (req, res, next) => { try { res.json(await svc.listPayments(ownFranchiseId(req), req)); } catch (e) { next(e); } };
exports.listFranchisePayments = async (req, res, next) => { try { res.json(await svc.listPayments(req.params.id, req)); } catch (e) { next(e); } };
exports.createPayment      = async (req, res, next) => { try { res.status(201).json(await svc.createPayment(req.params.id, req.body, req)); } catch (e) { next(e); } };
exports.markPaymentPaid    = async (req, res, next) => { try { res.json(await svc.markPaymentPaid(req.params.paymentId, req)); } catch (e) { next(e); } };

exports.getOwnBankDetails  = async (req, res, next) => { try { res.json(await svc.getBankDetails(ownFranchiseId(req), req)); } catch (e) { next(e); } };
exports.saveOwnBankDetails = async (req, res, next) => { try { res.json(await svc.upsertBankDetails(ownFranchiseId(req), req.body, req)); } catch (e) { next(e); } };

exports.listOwnSupportRequests   = async (req, res, next) => { try { res.json(await svc.listSupportRequests(ownFranchiseId(req), req)); } catch (e) { next(e); } };
exports.createOwnSupportRequest  = async (req, res, next) => { try { res.status(201).json(await svc.createSupportRequest(ownFranchiseId(req), req.body, req)); } catch (e) { next(e); } };

exports.setStage = async (req, res, next) => { try { res.json(await svc.setStage(req.params.id, req.body.stage, req)); } catch (e) { next(e); } };

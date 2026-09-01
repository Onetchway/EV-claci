const svc = require('../../services/nakjm/documents.service');
const { parseBoqWorkbook } = require('../../utils/boqParser');
const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT } = require('../../utils/upload');

exports.list = async (req, res, next) => { try { res.json(await svc.list(req.query, req)); } catch (e) { next(e); } };

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) { const e = new Error('file is required'); e.status = 400; throw e; }
    const doc = await svc.create({
      file: req.file,
      project_id: req.body.project_id || null,
      doc_type: req.body.doc_type || 'other',
      notes: req.body.notes || null,
      uploaded_by: req.user?.name || req.user?.email || null,
    }, req);
    res.status(201).json(doc);
  } catch (e) { next(e); }
};

exports.download = async (req, res, next) => {
  try {
    const doc = await svc.getOne(req.params.id, req);
    res.download(path.join(UPLOAD_ROOT, doc.file_path), doc.file_name);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => { try { await svc.remove(req.params.id, req); res.status(204).end(); } catch (e) { next(e); } };

// Parses an uploaded BOQ spreadsheet into structured line items — does not persist anything.
// Lets the user review/edit the parsed items before saving them as a real BOQ.
exports.parseBoq = async (req, res, next) => {
  try {
    if (!req.file) { const e = new Error('file is required'); e.status = 400; throw e; }
    const buffer = fs.readFileSync(path.join(UPLOAD_ROOT, req.file.filename));
    const items = parseBoqWorkbook(buffer);
    fs.unlink(path.join(UPLOAD_ROOT, req.file.filename), () => {});
    if (!items.length) { const e = new Error('Could not detect a BOQ table in this file. Please check the format or enter items manually.'); e.status = 422; throw e; }
    res.json({ items });
  } catch (e) { next(e); }
};

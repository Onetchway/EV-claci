const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { hasPermission, hasProjectPermission } = require('../../middleware/permissions');
const { PERMISSIONS } = require('../../config/permissions');
const { saveBuffer } = require('../../services/storage');
const { stampGeotag } = require('../../services/storage/geotagStamp');
const { reverseGeocode } = require('../../services/geocode');
const { logAudit } = require('../../services/audit');
const { generateSubmissionPdf } = require('../pdf/pdfService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(requireAuth());

/** Global viewAll, ProjectMember, or the legacy single-assignee field — any grants access. */
async function canAccessProject(user, project) {
  if (hasPermission(user, PERMISSIONS.PROJECTS_VIEW_ALL.key)) return true;
  if (project.assignedEngineerId === user.id) return true;
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  return !!membership;
}

async function loadSubmissionOr404(req, res) {
  const submission = await prisma.submission.findUnique({
    where: { id: req.params.id },
    include: {
      photos: { include: { photoSlot: true } },
      projectStage: {
        include: {
          project: true,
          stageTemplate: { include: { fieldDefs: true, photoSlots: true } },
        },
      },
    },
  });
  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return null;
  }
  if (!(await canAccessProject(req.user, submission.projectStage.project))) {
    res.status(403).json({ error: 'Not assigned to this project' });
    return null;
  }
  return submission;
}

// Get-or-create the current draft submission for a project stage.
router.post('/project-stages/:stageId/submissions', async (req, res) => {
  const stage = await prisma.projectStage.findUnique({
    where: { id: req.params.stageId },
    include: { project: true, submissions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!stage) return res.status(404).json({ error: 'Project stage not found' });
  if (!(await canAccessProject(req.user, stage.project))) {
    return res.status(403).json({ error: 'Not assigned to this project' });
  }
  if (!['NOT_STARTED', 'IN_PROGRESS', 'REJECTED'].includes(stage.status)) {
    return res.status(400).json({ error: `Cannot start a new submission while stage is ${stage.status}` });
  }

  if (stage.status === 'IN_PROGRESS' && stage.submissions[0]) {
    return res.json({ submission: stage.submissions[0] });
  }

  const nextVersion = (stage.submissions[0]?.version || 0) + 1;
  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        projectStageId: stage.id,
        version: nextVersion,
        dataJson: {},
        submittedById: req.user.id,
      },
    });
    await tx.projectStage.update({ where: { id: stage.id }, data: { status: 'IN_PROGRESS' } });
    return created;
  });
  res.status(201).json({ submission });
});

// Save/merge form answers into the draft.
router.patch('/submissions/:id', async (req, res) => {
  const submission = await loadSubmissionOr404(req, res);
  if (!submission) return;
  if (submission.projectStage.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Submission is not editable in its current state' });
  }
  const patch = req.body?.dataJson || {};
  const merged = { ...submission.dataJson, ...patch };
  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: { dataJson: merged },
  });
  res.json({ submission: updated });
});

// Upload a geotagged photo for one required photo slot.
router.post('/submissions/:id/photos', upload.single('file'), async (req, res) => {
  const submission = await loadSubmissionOr404(req, res);
  if (!submission) return;
  if (submission.projectStage.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Submission is not editable in its current state' });
  }
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });

  const { photoSlotKey, lat, lng, accuracyM, capturedAt } = req.body || {};
  if (!photoSlotKey || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'photoSlotKey, lat and lng are required' });
  }
  const slot = submission.projectStage.stageTemplate.photoSlots.find((s) => s.key === photoSlotKey);
  if (!slot) return res.status(400).json({ error: `Unknown photoSlotKey "${photoSlotKey}" for this stage` });

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const capturedAtDate = capturedAt ? new Date(capturedAt) : new Date();
  const ext = path.extname(req.file.originalname) || '.jpg';

  const original = await saveBuffer('originals', req.file.buffer, ext);
  const address = await reverseGeocode(latNum, lngNum);
  const stampedBuffer = await stampGeotag(req.file.buffer, {
    label: slot.label,
    address,
    lat: latNum,
    lng: lngNum,
    capturedAt: capturedAtDate,
  });
  const stamped = await saveBuffer('stamped', stampedBuffer, '.jpg');

  const photo = await prisma.photo.create({
    data: {
      submissionId: submission.id,
      photoSlotId: slot.id,
      originalUrl: original.url,
      stampedUrl: stamped.url,
      lat: latNum,
      lng: lngNum,
      accuracyM: accuracyM !== undefined ? Number(accuracyM) : null,
      address,
      capturedAt: capturedAtDate,
    },
    include: { photoSlot: true },
  });
  res.status(201).json({ photo });
});

router.delete('/submissions/:id/photos/:photoId', async (req, res) => {
  const submission = await loadSubmissionOr404(req, res);
  if (!submission) return;
  if (submission.projectStage.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Submission is not editable in its current state' });
  }
  await prisma.photo.delete({ where: { id: req.params.photoId } });
  res.json({ ok: true });
});

// Finalize: validate required fields/photos, lock the submission, generate the PDF.
router.post('/submissions/:id/submit', async (req, res) => {
  const submission = await loadSubmissionOr404(req, res);
  if (!submission) return;
  if (submission.projectStage.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Submission is not in an editable state' });
  }

  const missingFields = submission.projectStage.stageTemplate.fieldDefs
    .filter((f) => f.required && f.type !== 'photo')
    .filter((f) => {
      const v = submission.dataJson?.[f.key];
      return v === undefined || v === null || v === '';
    })
    .map((f) => f.label);

  const photoSlotIdsPresent = new Set(submission.photos.map((p) => p.photoSlotId));
  const missingPhotos = submission.projectStage.stageTemplate.photoSlots
    .filter((s) => s.required && !photoSlotIdsPresent.has(s.id))
    .map((s) => s.label);

  if (missingFields.length || missingPhotos.length) {
    return res.status(400).json({
      error: 'Submission incomplete',
      missingFields,
      missingPhotos,
    });
  }

  await prisma.projectStage.update({
    where: { id: submission.projectStage.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  await logAudit({
    actorId: req.user.id,
    action: 'submission.submit',
    entityType: 'Submission',
    entityId: submission.id,
    after: { status: 'SUBMITTED', version: submission.version },
  });

  let pdfUrl = null;
  try {
    pdfUrl = await generateSubmissionPdf(submission.id);
  } catch (err) {
    console.error('PDF generation failed for submission', submission.id, err);
  }

  res.json({ ok: true, pdfUrl });
});

router.post('/submissions/:id/generate-pdf', async (req, res) => {
  const submission = await loadSubmissionOr404(req, res);
  if (!submission) return;
  if (!(await hasProjectPermission(req.user, submission.projectStage.project.id, PERMISSIONS.SUBMISSIONS_MANAGE.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: submissions.manage' });
  }
  const url = await generateSubmissionPdf(req.params.id);
  res.json({ pdfUrl: url });
});

router.get('/submissions/:id', async (req, res) => {
  const submission = await loadSubmissionOr404(req, res);
  if (!submission) return;
  res.json({ submission });
});

module.exports = router;

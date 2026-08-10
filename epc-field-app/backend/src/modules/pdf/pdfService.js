const prisma = require('../../config/prisma');
const { buildStageHtml } = require('../../services/pdf/buildStageHtml');
const { renderHtmlToPdf } = require('../../services/pdf/renderPdf');
const { saveBuffer } = require('../../services/storage');
const { resolveProjectConfig } = require('../../services/config');

/** Renders and stores the PDF for a submission, returns its public URL. Used on submit and on manual regenerate. */
async function generateSubmissionPdf(submissionId) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      photos: { include: { photoSlot: true } },
      documents: true,
      projectStage: {
        include: {
          project: { include: { client: true } },
          stageTemplate: {
            include: {
              fieldDefs: { orderBy: { order: 'asc' } },
              photoSlots: { orderBy: { order: 'asc' } },
            },
          },
        },
      },
    },
  });
  if (!submission) throw Object.assign(new Error('Submission not found'), { status: 404 });

  const photoFileUrls = new Map(
    submission.photos.map((p) => [p.id, p.stampedUrl || p.originalUrl])
  );
  const footerText = await resolveProjectConfig(submission.projectStage.project, 'pdf.footerText');

  const html = buildStageHtml({
    client: submission.projectStage.project.client,
    project: submission.projectStage.project,
    stageTemplate: submission.projectStage.stageTemplate,
    submission,
    photos: submission.photos,
    photoFileUrls,
    documents: submission.documents,
    footerText,
  });

  const pdfBuffer = await renderHtmlToPdf(html);
  const { url } = await saveBuffer('pdf', pdfBuffer, '.pdf');

  await prisma.submission.update({ where: { id: submission.id }, data: { pdfUrl: url } });
  return url;
}

module.exports = { generateSubmissionPdf };

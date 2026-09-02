const audit = require('../services/audit.service');
const notifications = require('../services/notifications.service');
const jobs = require('../services/jobs.service');
const health = require('../services/health.service');
const support = require('../services/support.service');

exports.listAudit = async (req, res, next) => { try { res.json({ data: await audit.list(req.query) }); } catch (e) { next(e); } };

exports.listNotifications = async (req, res, next) => {
  try {
    const [data, unread] = await Promise.all([notifications.list(req.query), notifications.unreadCount()]);
    res.json({ data, unread });
  } catch (e) { next(e); }
};
exports.markNotificationRead = async (req, res, next) => { try { await notifications.markRead(req.params.id); res.status(204).end(); } catch (e) { next(e); } };
exports.markAllNotificationsRead = async (req, res, next) => { try { await notifications.markAllRead(); res.status(204).end(); } catch (e) { next(e); } };

exports.listJobs = async (req, res, next) => { try { res.json({ data: await jobs.listWithLastRun() }); } catch (e) { next(e); } };
exports.jobHistory = async (req, res, next) => { try { res.json({ data: await jobs.history(req.params.name) }); } catch (e) { next(e); } };
exports.runJob = async (req, res, next) => {
  try { res.json(await jobs.runJob(req.params.name, 'manual')); }
  catch (e) { next(e); }
};

exports.systemHealth = async (req, res, next) => { try { res.json(await health.check()); } catch (e) { next(e); } };

exports.tenantHealth = async (req, res, next) => { try { res.json(await support.tenantHealth(req.params.tenantId)); } catch (e) { next(e); } };
exports.listSupportSessions = async (req, res, next) => { try { res.json({ data: await support.listForTenant(req.params.tenantId) }); } catch (e) { next(e); } };
exports.startSupportSession = async (req, res, next) => {
  try { res.status(201).json(await support.start(req.params.tenantId, req.body.reason, req.body.duration_minutes, req.superAdmin)); }
  catch (e) { next(e); }
};
exports.endSupportSession = async (req, res, next) => {
  try { res.json(await support.end(req.params.id, req.superAdmin)); }
  catch (e) { next(e); }
};

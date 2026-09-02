'use strict';

const { query } = require('../config/database');

// Real checks where a real check is cheap (DB round-trip); a
// configuration presence check for everything else -- this platform has
// no separate probe for Firebase/CRM API reachability from in here, so
// "configured" is the honest signal rather than faking a live status.
const check = async () => {
  const checks = [];

  const dbStart = Date.now();
  try {
    await query('SELECT 1');
    checks.push({ name: 'Postgres', status: 'healthy', latency_ms: Date.now() - dbStart });
  } catch (err) {
    checks.push({ name: 'Postgres', status: 'down', error: err.message });
  }

  checks.push({
    name: 'CRM Provisioning',
    status: process.env.CRM_PROVISION_URL && process.env.CRM_PROVISION_SECRET ? 'configured' : 'not_configured',
  });
  checks.push({
    name: 'Payments (Razorpay)',
    status: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'configured' : 'not_configured',
  });
  checks.push({
    name: 'Payments Webhook',
    status: process.env.RAZORPAY_WEBHOOK_SECRET ? 'configured' : 'not_configured',
  });
  checks.push({
    name: 'Email',
    status: process.env.SMTP_HOST ? 'configured' : 'not_configured',
  });

  return {
    checked_at: new Date().toISOString(),
    checks,
    overall: checks.some((c) => c.status === 'down') ? 'degraded' : 'healthy',
  };
};

module.exports = { check };

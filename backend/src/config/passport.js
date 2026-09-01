const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('./database');
const { resolveTenantByHost } = require('../utils/resolveTenant');

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'zivahgroup.com';

// Google OAuth is optional — only registered when configured. Deploys
// without GOOGLE_CLIENT_ID (local testing, or a tenant that only wants
// email/password login — see src/services/auth.service.js) skip this
// entirely rather than crashing on startup.
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.log('[passport] GOOGLE_CLIENT_ID/SECRET not set — Google sign-in disabled, email/password login still works.');
} else {

// Multi-tenant ("shared" deployment mode, see platform/README.md): a
// shared instance resolves which tenant a sign-in belongs to from the
// Host it came in on (subdomain or custom domain, both super-admin
// managed — see platform/backend/src/services/tenants.service.js's
// resolveByHost). When that resolves, it replaces the single-org
// ALLOWED_EMAIL_DOMAIN gate entirely and the new/returning user is
// stamped with that tenant's id. When it doesn't (standalone,
// dedicated, or isolated deploys — no PLATFORM_API_URL, or the host
// just isn't a known tenant domain), behavior is unchanged from before:
// the single ALLOWED_DOMAIN gate applies and tenant_id stays NULL.
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(null, false, { message: 'No email from Google.' });

    const tenant = await resolveTenantByHost(req.hostname);

    if (tenant) {
      if (tenant.status === 'cancelled') return done(null, false, { message: 'This account is no longer active.' });
    } else if (email.split('@')[1] !== ALLOWED_DOMAIN) {
      return done(null, false, { message: `Only @${ALLOWED_DOMAIN} emails are allowed.` });
    }

    const picture = profile.photos?.[0]?.value || null;
    const existing = await query('SELECT * FROM users WHERE email = $1', [email]);

    let user;
    if (existing.rows[0]) {
      const updated = await query(
        'UPDATE users SET picture = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [picture || existing.rows[0].picture, existing.rows[0].id]
      );
      user = updated.rows[0];
    } else {
      const created = await query(
        `INSERT INTO users (name, email, picture, role, tenant_id) VALUES ($1, $2, $3, 'operations', $4) RETURNING *`,
        [profile.displayName, email, picture, tenant?.id || null]
      );
      user = created.rows[0];
    }
    return done(null, user);
  } catch (err) { return done(err); }
}));

}

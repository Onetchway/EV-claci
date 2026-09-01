const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('./database');

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'zivahgroup.com';

// NOTE on multi-tenant ("shared" deployment mode, see platform/README.md):
// this domain gate is single-org. A shared instance serving several
// tenants at once would need a domain -> tenant_id lookup here instead of
// one global ALLOWED_DOMAIN, so that a new Google sign-in lands in the
// right tenant. Not built — today, self-serve OAuth signup only makes
// sense for a single-tenant (dedicated/isolated) deploy. In shared mode,
// assign tenant_id to a user explicitly via PUT /api/users/:id instead.
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(null, false, { message: 'No email from Google.' });
    if (email.split('@')[1] !== ALLOWED_DOMAIN)
      return done(null, false, { message: `Only @${ALLOWED_DOMAIN} emails are allowed.` });

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
        `INSERT INTO users (name, email, picture, role) VALUES ($1, $2, $3, 'operations') RETURNING *`,
        [profile.displayName, email, picture]
      );
      user = created.rows[0];
    }
    return done(null, user);
  } catch (err) { return done(err); }
}));

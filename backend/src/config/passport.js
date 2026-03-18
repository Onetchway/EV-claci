const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./database');

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'zivahgroup.com';

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

    let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
    if (!user) {
      user = await prisma.user.create({
        data: { googleId: profile.id, email, name: profile.displayName, avatar: profile.photos?.[0]?.value || null, role: 'OPERATIONS' },
      });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { avatar: profile.photos?.[0]?.value || user.avatar } });
    }
    return done(null, user);
  } catch (err) { return done(err); }
}));

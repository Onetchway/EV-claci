require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  storageRoot: process.env.STORAGE_ROOT || './storage',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4100',
  // Comma-separated list of allowed browser origins, e.g. "https://dashboard.nakjminfra.com".
  // Unset/empty means allow any origin (fine for local dev; the mobile app doesn't send an
  // Origin header at all, so this only affects browser-based clients like admin-web).
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT || 'epc-field-app/1.0',
};

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/prisma');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function requireAuth() {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roleRef: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    next();
  };
}

module.exports = { signToken, requireAuth };

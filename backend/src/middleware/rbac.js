/**
 * Role-Based Access Control middleware.
 * Usage: authorize('ADMIN', 'OPERATIONS')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role(s): ${roles.join(', ')}`,
    });
  }
  next();
};

module.exports = { authorize };

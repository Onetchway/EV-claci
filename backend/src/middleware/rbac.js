'use strict';

/**
 * Role-Based Access Control middleware.
 * Accepts both uppercase and lowercase role strings.
 * Usage: authorize('ADMIN', 'OPERATIONS') or authorize('admin', 'operations')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated.' });

  const userRole = (req.user.role || '').toLowerCase();

  // Admin always passes
  if (userRole === 'admin') return next();

  const normalizedRoles = roles.map(r => r.toLowerCase());
  if (!normalizedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
    });
  }
  next();
};

module.exports = { authorize };

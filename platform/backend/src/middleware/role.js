'use strict';

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.superAdmin) return res.status(401).json({ error: 'Authentication required.' });
    if (req.superAdmin.role === 'super_admin') return next();
    if (!roles.includes(req.superAdmin.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.superAdmin.role}`,
      });
    }
    next();
  };
}

module.exports = { requireRole };

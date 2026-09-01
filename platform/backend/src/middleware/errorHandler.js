const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);

  if (err.code === '23505') { // postgres unique_violation
    return res.status(409).json({ error: 'Duplicate entry — unique constraint violated.', detail: err.detail });
  }
  if (err.code === '23503') { // postgres foreign_key_violation
    return res.status(409).json({ error: 'Referenced record does not exist.', detail: err.detail });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

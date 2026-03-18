const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate entry — unique constraint violated.', field: err.meta?.target });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

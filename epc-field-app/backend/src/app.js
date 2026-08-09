require('express-async-errors');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '2mb' }));
app.use(
  '/api',
  rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })
);

// Serves stored photos and generated PDFs.
app.use('/files', express.static(path.resolve(env.storageRoot)));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

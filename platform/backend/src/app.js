'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3100',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Api-Key'],
}));
// Captures the raw request bytes alongside the parsed body -- payments.
// service.js's webhook handler needs the exact bytes Razorpay signed, not
// a re-serialized copy of req.body (whitespace/key-order could differ).
app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'alpha-platform-control-plane', ts: new Date() }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` }));
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5100;
  app.listen(PORT, () => {
    console.log(`Alpha platform control-plane API listening on :${PORT}`);
    if (process.env.NODE_ENV !== 'test') require('./jobs/scheduler').start();
  });
}

module.exports = app;

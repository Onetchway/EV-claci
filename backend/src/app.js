'use strict';

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const passport = require('passport');
const rateLimit = require('express-rate-limit');

require('./config/passport');

const routes      = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(passport.initialize());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'ev-csms-api', ts: new Date() }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` }));
app.use(errorHandler);

module.exports = app;

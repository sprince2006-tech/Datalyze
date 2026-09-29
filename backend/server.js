require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

// ── Fail fast on missing env ────────────────────────────────────────
const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'SESSION_SECRET'];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`[BOOT] Missing required env var: ${k}`);
    process.exit(1);
  }
}

const connectDB = require('./config/db');
const authRoutes     = require('./routes/auth');
const datasetRoutes  = require('./routes/datasets');
const chartRoutes    = require('./routes/charts');
const uploadRoutes   = require('./routes/upload');
const publicRoutes   = require('./routes/public');
const reportRoutes   = require('./routes/reports');
const sessionRoutes  = require('./routes/session');
const errorHandler   = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ───────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','), credentials: true },
});

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    if (typeof roomId === 'string' && roomId.length < 128) socket.join(roomId);
  });
});

app.use((req, _res, next) => { req.io = io; next(); });

// ── Security & body parsing ─────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
}));

// 25 MB limit — PDF report payloads include base64 chart images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Rate limiting — applies to all /api routes
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stricter limiter for auth routes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth/session', sessionRoutes);
app.use('/api/auth',    authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/charts',  chartRoutes);
app.use('/api/upload',  uploadRoutes);
app.use('/api/public',  publicRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Production static frontend ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../frontend/dist');
  app.use(express.static(dist, {
    setHeaders(res, filePath) {
      if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// ── Error handler (last) ────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => console.log(`[BOOT] API on :${PORT}`));
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
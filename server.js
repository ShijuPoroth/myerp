require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

// Import database configuration
const { db } = require('./config/database');
const { requireAuth } = require('./middleware/auth');

// Import route modules
const equipmentRoutes = require('./routes/equipment');
const hrRoutes = require('./routes/hr');
const adminRoutes = require('./routes/admin');
const warehouseRoutes = require('./routes/warehouse');
const supplierRoutes = require('./routes/suppliers');
const procurementRoutes = require('./routes/procurement');
const authRoutes = require('./routes/auth');
const cateringRoutes = require('./routes/catering');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Trust Cloudflare proxy (always on since app runs behind cloudflared tunnel)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      styleSrcAttr: ["'unsafe-inline'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'sha256-7z++peN0VDVzFLVcOcv50T9xKH2dqyjrJszECytR1UM='"],
      scriptSrcAttr: ["'unsafe-inline'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"]
    }
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginResourcePolicy: { policy: "same-origin" }
}));

// Rate limit login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});
app.use('/api/login', loginLimiter);

// CORS: allow localhost for development + live domain for production
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
if (process.env.CLIENT_ORIGIN) allowedOrigins.push(process.env.CLIENT_ORIGIN);
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (same-origin, mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// SQLite-backed session store
const SQLiteSessionStore = class extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, cb) {
    this.db.get('SELECT data FROM sessions WHERE sid = ? AND (expires IS NULL OR expires > ?)', [sid, Date.now()], (err, row) => {
      if (err) return cb(err);
      if (!row) return cb();
      try {
        cb(null, JSON.parse(row.data));
      } catch (e) {
        cb(e);
      }
    });
  }

  set(sid, sess, cb) {
    const expires = (sess.cookie && sess.cookie.expires) ? new Date(sess.cookie.expires).getTime() : null;
    this.db.run('INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)', [sid, JSON.stringify(sess), expires], cb || (() => {}));
  }

  destroy(sid, cb) {
    this.db.run('DELETE FROM sessions WHERE sid = ?', [sid], cb || (() => {}));
  }

  touch(sid, sess, cb) {
    this.set(sid, sess, cb || (() => {}));
  }
};

app.use(session({
  store: new SQLiteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // dynamically upgraded below for Cloudflare HTTPS traffic
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
// Upgrade cookie to secure when request arrives via Cloudflare HTTPS tunnel
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'https' && req.session) {
    req.session.cookie.secure = true;
  }
  next();
});
// Clean URL routes and redirects to hide .html extensions
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use((req, res, next) => {
  if (req.path === '/login.html') return res.redirect(301, '/login');
  if (req.path === '/index.html') return res.redirect(301, '/app');
  next();
});

// Serve uploads only from the configured origin and force download for non-image files
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    if (!imageExts.includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    res.setHeader('Cache-Control', 'private, no-cache');
  }
}));
app.use(express.static('public', { etag: false, lastModified: false, setHeaders: function(res) { res.setHeader('Cache-Control', 'no-store'); } }));

// Client-side error logging endpoint (public, for debugging)
app.post('/api/client-error', express.json({ limit: '1mb' }), (req, res) => {
  const { message, source, line, column, stack, url } = req.body || {};
  const logLine = `[${new Date().toISOString()}] CLIENT ERROR\n  URL: ${url || req.headers.referer || ''}\n  Message: ${message || ''}\n  Source: ${source || ''}:${line || ''}:${column || ''}\n  Stack: ${stack || ''}\n`;
  console.error(logLine);
  fs.appendFile('client-errors.log', logLine, (err) => { if (err) console.error('Error writing client error log:', err); });
  res.json({ ok: true });
});

// Mount auth routes before API protection
app.use('/api', authRoutes);

// Protect API routes (auth routes are mounted above this)
app.use('/api', requireAuth);

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Mount route modules
app.use('/api/equipment', equipmentRoutes);
app.use('/api', hrRoutes);
app.use('/api', adminRoutes);
app.use('/api', warehouseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api', procurementRoutes);
app.use('/api/catering', cateringRoutes);

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

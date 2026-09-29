const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO7VY5aB.ZY/5s4sO.gLQyE1k4uXjzO4K';

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });

const norm = (s) => String(s || '').trim().toLowerCase();

// ── POST /api/auth/register ─────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = norm(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (password.length > 72) {
      return res.status(400).json({ success: false, message: 'Password too long' });
    }

    const exists = await User.findOne({ email }).select('_id');
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, authProvider: 'local' });
    const token = signToken(user._id);
    return res.status(201).json({ success: true, token, user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Invalid registration data' });
    }
    return next(err);
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const email = norm(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    const hash = user && user.password ? user.password : DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user._id);
    return res.json({ success: true, token, user });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/auth/google ───────────────────────────────────────────
// Verifies a Google ID token, finds or creates a user, returns our JWT.
router.post('/google', async (req, res, next) => {
  try {
    if (!googleClient) {
      return res.status(503).json({
        success: false,
        message: 'Google Sign-In is not configured on this server.',
      });
    }

    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing Google credential' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.warn('[AUTH] Google token verify failed:', verifyErr.message);
      return res.status(401).json({ success: false, message: 'Invalid Google token' });
    }

    if (!payload || !payload.email || payload.email_verified === false) {
      return res.status(401).json({ success: false, message: 'Google account has no verified email' });
    }

    const email = norm(payload.email);
    const name = String(payload.name || email.split('@')[0]).slice(0, 100);
    const googleId = String(payload.sub || '');

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: 'google',
        isActive: true,
      });
    } else {
      // Existing user — link Google account if not already linked
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (user.authProvider !== 'google' && !user.password) updates.authProvider = 'google';
      if (Object.keys(updates).length) {
        user = await User.findByIdAndUpdate(user._id, updates, { new: true });
      }
    }

    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Account is disabled' });
    }

    const token = signToken(user._id);
    return res.json({ success: true, token, user });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PATCH /api/auth/me ──────────────────────────────────────────────
router.patch('/me', protect, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name too long' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true, runValidators: true, context: 'query' },
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }
    return next(err);
  }
});

module.exports = router;
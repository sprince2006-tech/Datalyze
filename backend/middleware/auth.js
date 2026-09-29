const jwt = require('jsonwebtoken');
const User = require('../models/User');

const VERIFY_OPTS = { algorithms: ['HS256'] };

const extractToken = (req) => {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, VERIFY_OPTS);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    req.user = user;
    return next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired' : 'Not authenticated';
    return res.status(401).json({ success: false, message: msg });
  }
};

const optionalAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(); // no token → anonymous
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, VERIFY_OPTS);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive !== false) req.user = user;
  } catch (_e) { /* invalid token → treat as anonymous */ }
  return next();
};

module.exports = { protect, optionalAuth };
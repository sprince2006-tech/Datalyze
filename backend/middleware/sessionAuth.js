const crypto = require('crypto');

const sign = (id) =>
  crypto.createHmac('sha256', process.env.SESSION_SECRET).update(id).digest('hex').slice(0, 32);

/** Returns `<id>.<signature>` */
const issueSession = () => {
  const id = crypto.randomBytes(16).toString('hex');
  return `${id}.${sign(id)}`;
};

/** Verifies `<id>.<signature>` and returns id, or null. */
const verifySession = (raw) => {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  return id;
};

/** Reads `X-Session-ID` header, verifies, attaches `req.sessionId`. */
const sessionAuth = (req, _res, next) => {
  const raw = req.headers['x-session-id'];
  const id = verifySession(raw);
  if (id) req.sessionId = id;
  next();
};

module.exports = { issueSession, verifySession, sessionAuth };
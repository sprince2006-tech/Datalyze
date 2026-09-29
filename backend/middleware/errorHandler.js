module.exports = (err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large (max 50 MB)' });
  }
  if (err && err.message === 'Unsupported file extension') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Already exists' });
  }
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[ERR]', err && err.stack ? err.stack : err);
  res.status(500).json({
    success: false,
    message: isDev ? String(err.message || err) : 'Something went wrong',
  });
};
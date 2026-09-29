const router = require('express').Router();
const path = require('path');
const Dataset = require('../models/Dataset');
const { optionalAuth } = require('../middleware/auth');
const { sessionAuth } = require('../middleware/sessionAuth');
const { buildChartData, computeAnalysis, analyseColumns } = require('../services/analytics');
const { recommendCharts, buildAutoDashboard } = require('../services/chartRecommender');
const {
  isMLAvailable, autoDashboardML, chartDataML, analyseWithML,
  forecastML, anomalyML, clusterML, correlationML,
} = require('../services/mlProxy');
const { parseFile } = require('../services/fileParser');

/**
 * Ownership filter for a dataset request.
 *  - Authenticated user → match by user id.
 *  - Anonymous verified session → match by sessionId.
 *  - Otherwise → null (caller must reject).
 */
const ownershipFilter = (req) => {
  if (req.user) return { user: req.user._id };
  if (req.sessionId) return { sessionId: req.sessionId };
  return null;
};

const loadDataset = async (req) => {
  const filter = ownershipFilter(req);
  if (!filter) return { error: 401 };
  const ds = await Dataset.findOne({ _id: req.params.id, ...filter });
  if (!ds) return { error: 404 };
  return { ds };
};

const loadRows = async (ds) => {
  if (!ds.filePath) return ds.preview || [];
  const resolved = path.resolve(ds.filePath);
  if (!resolved.startsWith(path.resolve(process.env.UPLOAD_DIR || './storage/uploads'))) return ds.preview || [];
  const { rows } = await parseFile(resolved, ds.fileType);
  return rows;
};

router.use(optionalAuth, sessionAuth);

router.get('/', async (req, res, next) => {
  try {
    const filter = ownershipFilter(req);
    if (!filter) return res.json({ success: true, data: [] });
    const datasets = await Dataset.find(filter).select('-preview -analysis').sort('-createdAt');
    return res.json({ success: true, data: datasets });
  } catch (err) { return next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { ds, error } = await loadDataset(req);
    if (error) return res.status(error).json({ success: false, message: 'Dataset not found' });
    return res.json({ success: true, data: ds });
  } catch (err) { return next(err); }
});

router.get('/:id/chart-data', async (req, res, next) => {
  try {
    const { ds, error } = await loadDataset(req);
    if (error) return res.status(error).json({ success: false, message: 'Dataset not found' });
    const { xCol, yCol, type = 'bar' } = req.query;
    if (!xCol) return res.status(400).json({ success: false, message: 'xCol required' });
    const rows = await loadRows(ds);
    const ml = await isMLAvailable();
    if (ml && rows.length) {
      try {
        await analyseWithML(rows, String(ds._id));
        const data = await chartDataML(String(ds._id), xCol, yCol, type);
        return res.json({ success: true, data, engine: 'python' });
      } catch (_) { /* fall through */ }
    }
    return res.json({ success: true, data: buildChartData(rows, xCol, yCol, type), engine: 'node' });
  } catch (err) { return next(err); }
});

router.get('/:id/recommend', async (req, res, next) => {
  try {
    const { ds, error } = await loadDataset(req);
    if (error) return res.status(error).json({ success: false, message: 'Dataset not found' });
    const rows = await loadRows(ds);
    const ml = await isMLAvailable();
    if (ml && rows.length) {
      try {
        const mlResult = await analyseWithML(rows, String(ds._id));
        return res.json({ success: true, data: mlResult.recommendations, engine: 'python' });
      } catch (_) { /* fall through */ }
    }
    return res.json({ success: true, data: recommendCharts(ds.columns, rows), engine: 'node' });
  } catch (err) { return next(err); }
});

router.get('/:id/auto-dashboard', async (req, res, next) => {
  try {
    const { ds, error } = await loadDataset(req);
    if (error) return res.status(error).json({ success: false, message: 'Dataset not found' });
    if (ds.analysis && ds.analysis.kpis && ds.analysis.charts) {
      return res.json({ success: true, data: ds.analysis, engine: 'stored' });
    }
    const rows = await loadRows(ds);
    const ml = await isMLAvailable();
    if (ml && rows.length) {
      try {
        const dashboard = await autoDashboardML(rows, String(ds._id));
        return res.json({ success: true, data: dashboard, engine: 'python' });
      } catch (_) { /* fall through */ }
    }
    const dashboard = buildAutoDashboard(ds.columns, rows);
    return res.json({ success: true, data: dashboard, engine: 'node' });
  } catch (err) { return next(err); }
});

router.get('/:id/correlation', async (req, res, next) => {
  try {
    const { ds, error } = await loadDataset(req);
    if (error) return res.status(error).json({ success: false, message: 'Dataset not found' });
    if (!await isMLAvailable()) return res.status(503).json({ success: false, message: 'ML service unavailable' });
    const rows = await loadRows(ds);
    await analyseWithML(rows, String(ds._id));
    return res.json({ success: true, data: await correlationML(String(ds._id)) });
  } catch (err) { return next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const filter = ownershipFilter(req);
    if (!filter) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const ds = await Dataset.findOneAndDelete({ _id: req.params.id, ...filter });
    if (!ds) return res.status(404).json({ success: false, message: 'Dataset not found' });
    return res.json({ success: true, message: 'Dataset deleted' });
  } catch (err) { return next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const filter = ownershipFilter(req);
    if (!filter) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const name = String(req.body.name || '').slice(0, 200);
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const ds = await Dataset.findOneAndUpdate(
      { _id: req.params.id, ...filter },
      { name },
      { new: true, runValidators: true },
    );
    if (!ds) return res.status(404).json({ success: false, message: 'Dataset not found' });
    return res.json({ success: true, data: ds });
  } catch (err) { return next(err); }
});

module.exports = router;
const axios = require('axios');
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const client = axios.create({ baseURL: ML_URL, timeout: 30000 });

const isMLAvailable = async () => {
  try { await client.get('/health', { timeout: 1500 }); return true; }
  catch { return false; }
};

const post = async (path, body, timeout = 30000) =>
  (await client.post(path, body, { timeout })).data.data;
const get = async (path, params, timeout = 10000) =>
  (await client.get(path, { params, timeout })).data.data;

const analyseWithML   = (rows, id) => post('/analyse-data',    { dataset_id: String(id), rows });
const autoDashboardML = (rows, id) => post('/auto-dashboard',  { dataset_id: String(id), rows });
const chartDataML     = (id, x, y, t) => get(`/chart-data/${id}`, { x_col: x, y_col: y, chart_type: t });
const forecastML      = (id, d, v, p) => get(`/forecast/${id}`, { date_col: d, value_col: v, periods: p });
const anomalyML       = (id, c, m)    => get(`/anomaly/${id}`,  { column: c, method: m });
const clusterML       = (id, n)       => get(`/cluster/${id}`,  n ? { n_clusters: n } : {});
const correlationML   = (id)          => get(`/correlation/${id}`, {});

module.exports = { isMLAvailable, analyseWithML, autoDashboardML, chartDataML, forecastML, anomalyML, clusterML, correlationML };
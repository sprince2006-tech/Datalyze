const { recommendCharts } = require('./chartRecommender');

const isBlank = (v) => v === null || v === undefined || v === '' ||
  (typeof v === 'string' && v.trim() === '');

const inferType = (values) => {
  const nonNull = values.filter((v) => !isBlank(v));
  if (!nonNull.length) return 'string';

  const allNum = nonNull.every((v) => !isNaN(Number(v)));
  if (allNum) {
    const nums = nonNull.map(Number);
    if (nums.every((n) => n >= 40000 && n <= 73050)) return 'date';
    return 'numeric';
  }
  const dateRe = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/;
  if (nonNull.every((v) => dateRe.test(String(v)) || !isNaN(Date.parse(v)))) return 'date';
  const bools = new Set(['true', 'false', 'yes', 'no', '0', '1']);
  if (nonNull.every((v) => bools.has(String(v).toLowerCase()))) return 'boolean';
  return 'string';
};

const numericStats = (nums) => {
  if (!nums.length) return { sum: 0, min: null, max: null, mean: null, median: null, std: null };
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / nums.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return {
    sum: +sum.toFixed(4),
    min: sorted[0], max: sorted[sorted.length - 1],
    mean: +mean.toFixed(4), median: +median.toFixed(4),
    std: +Math.sqrt(variance).toFixed(4),
  };
};

const analyseColumns = (rows) => {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const values = rows.map((r) => r[key]);
    const nonNull = values.filter((v) => !isBlank(v));
    const type = inferType(nonNull);
    const col = {
      name: key, type,
      nullCount: values.length - nonNull.length,
      null_count: values.length - nonNull.length,
      unique: new Set(nonNull.map(String)).size,
    };
    if (type === 'numeric') Object.assign(col, numericStats(nonNull.map(Number)));
    else Object.assign(col, { min: null, max: null, mean: null, median: null, std: null, sum: null });
    return col;
  });
};

const generateInsights = (columns, rowCount) => {
  const out = [];
  const nums = columns.filter((c) => c.type === 'numeric' && c.max != null);
  if (nums.length) {
    const top = nums.reduce((a, b) => (a.max > b.max ? a : b));
    out.push(`Column "${top.name}" has the highest maximum value of ${top.max}.`);
  }
  columns.forEach((c) => {
    if (!c.nullCount) return;
    const pct = ((c.nullCount / Math.max(rowCount, 1)) * 100).toFixed(1);
    if (parseFloat(pct) > 1) out.push(`"${c.name}" has ${c.nullCount} missing values (${pct}%).`);
  });
  const dates = columns.filter((c) => c.type === 'date');
  if (dates.length) out.push(`Date columns: ${dates.map((c) => c.name).join(', ')}.`);
  if (!out.length) out.push(`Dataset looks clean — ${rowCount} rows, ${columns.length} columns.`);
  return out;
};

const buildChartData = (rows, xCol, yCol, chartType = 'bar') => {
  if (!rows.length) return [];
  const convert = (v) => {
    const n = Number(v);
    if (!isNaN(n) && n >= 40000 && n <= 73050) return new Date((n - 25569) * 86400 * 1000).toISOString().split('T')[0];
    return v;
  };

  if (chartType === 'pie' || chartType === 'donut') {
    const counts = {};
    rows.forEach((r) => {
      const k = String(convert(r[xCol]) ?? 'Unknown');
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }
  if (chartType === 'scatter' && yCol) {
    return rows.slice(0, 500).map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  const grouped = {};
  rows.forEach((r) => {
    const k = String(convert(r[xCol]) ?? 'N/A');
    grouped[k] = (grouped[k] || 0) + (parseFloat(r[yCol]) || 0);
  });
  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const computeCorrelations = (rows, columns) => {
  const cols = columns.filter((c) => c.type === 'numeric').map((c) => c.name);
  if (cols.length < 2) return [];
  const values = {};
  cols.forEach((c) => { values[c] = rows.map((r) => parseFloat(r[c])).filter((v) => Number.isFinite(v)); });
  const out = [];
  for (let i = 0; i < cols.length; i += 1) {
    for (let j = i + 1; j < cols.length; j += 1) {
      const a = values[cols[i]]; const b = values[cols[j]];
      const len = Math.min(a.length, b.length);
      if (len < 3) continue;
      const ma = a.reduce((x, y) => x + y, 0) / len;
      const mb = b.reduce((x, y) => x + y, 0) / len;
      let num = 0; let da = 0; let db = 0;
      for (let k = 0; k < len; k += 1) {
        const x = a[k] - ma; const y = b[k] - mb;
        num += x * y; da += x * x; db += y * y;
      }
      const r = num / (Math.sqrt(da) * Math.sqrt(db));
      if (!Number.isFinite(r)) continue;
      const abs = Math.abs(r);
      const strength = abs >= 0.8 ? 'very strong' : abs >= 0.6 ? 'strong' : abs >= 0.4 ? 'moderate' : abs >= 0.2 ? 'weak' : 'very weak';
      out.push({ col_a: cols[i], col_b: cols[j], correlation: +r.toFixed(4), strength });
    }
  }
  return out.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
};

const computeAnalysis = (rows, columns) => {
  const nums = columns.filter((c) => c.type === 'numeric');
  const kpis = nums.slice(0, 4).map((col) => {
    const vals = rows.map((r) => parseFloat(r[col.name])).filter((v) => Number.isFinite(v));
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      column: col.name,
      label: col.name.replace(/_/g, ' '),
      sum: +sum.toFixed(2),
      avg: +(sum / Math.max(vals.length, 1)).toFixed(5),
      min: col.min, max: col.max,
    };
  });
  const correlations = computeCorrelations(rows, columns);
  const insights = generateInsights(columns, rows.length);
  const recommendations = recommendCharts(columns, rows).slice(0, 6);
  const charts = recommendations.map((rec) => ({ ...rec, data: buildChartData(rows, rec.xCol, rec.yCol, rec.chartType) }));
  return { kpis, correlations, insights, recommendations, charts, row_count: rows.length, col_count: columns.length };
};

module.exports = { analyseColumns, generateInsights, buildChartData, computeCorrelations, computeAnalysis };
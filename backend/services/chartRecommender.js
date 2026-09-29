// ── Column classification helpers ───────────────────────────────────
const ID_PATTERNS = /(_id|_ID|^id$|^ID$|order.?id|order.?no|invoice|serial|index|ref|code|key|uuid)/i;

const isRealNumeric = (col) => {
  const name = String(col.name || '').toLowerCase();
  if (ID_PATTERNS.test(col.name)) return false;
  if (name.endsWith('_id') || name.startsWith('id_') || name === 'id') return false;
  if (col.type === 'date') return false;
  if (name.includes('date') || name.includes('time')) return false;
  if (col.min != null && col.max != null && col.min === col.max) return false;
  if (col.std === 0) return false;
  if (col.mean > 0 && (col.std / col.mean) < 0.01) return false;
  if (col.type !== 'numeric') return false;
  return true;
};

const _bestNumeric = (numeric) => {
  const PREFERRED = ['total', 'amount', 'revenue', 'sales', 'profit', 'price', 'cost', 'income', 'value', 'sum'];
  const AVOID = ['percent', 'pct', 'rate', 'ratio', 'score', 'age', 'year', 'month', 'day', 'discount', 'tax'];
  const score = (col) => {
    const name = String(col.name || '').toLowerCase();
    let s = (col.std || 0) / Math.max(Math.abs(col.mean || 1), 1);
    if (PREFERRED.some((p) => name.includes(p))) s += 100;
    if (AVOID.some((a) => name.includes(a))) s -= 50;
    return s;
  };
  return numeric.reduce((best, col) => (score(col) > score(best) ? col : best), numeric[0]);
};

// ── Chart recommendation engine ─────────────────────────────────────
const recommendCharts = (columns = [], rows = []) => {
  const numeric = columns.filter(isRealNumeric);
  const string = columns.filter((c) => c.type === 'string');
  const date = columns.filter(
    (c) => c.type === 'date'
      || String(c.name || '').toLowerCase().includes('date')
      || String(c.name || '').toLowerCase().includes('time'),
  );
  const recs = [];

  if (date.length && numeric.length) {
    const best = _bestNumeric(numeric);
    recs.push({
      id: 'rec_line',
      chartType: 'line',
      title: `${best.name} over Time`,
      reason: `"${date[0].name}" is a date — line chart shows ${best.name} trend over time.`,
      xCol: date[0].name,
      yCol: best.name,
      confidence: 97,
      icon: '📈',
    });
  }

  const lowCard = string.find((c) => c.unique >= 2 && c.unique <= 20);
  if (lowCard && numeric.length) {
    const best = _bestNumeric(numeric);
    recs.push({
      id: 'rec_bar',
      chartType: 'bar',
      title: `${best.name} by ${lowCard.name}`,
      reason: `"${lowCard.name}" has ${lowCard.unique} categories — bar chart compares ${best.name} across groups.`,
      xCol: lowCard.name,
      yCol: best.name,
      confidence: 93,
      icon: '📊',
    });
  }

  const veryLow = string.find((c) => c.unique >= 2 && c.unique <= 8);
  if (veryLow) {
    recs.push({
      id: 'rec_pie',
      chartType: 'donut',
      title: `Distribution by ${veryLow.name}`,
      reason: `"${veryLow.name}" has only ${veryLow.unique} categories — donut chart shows proportions.`,
      xCol: veryLow.name,
      yCol: numeric[0]?.name || null,
      confidence: 90,
      icon: '🍩',
    });
  }

  if (numeric.length >= 2) {
    recs.push({
      id: 'rec_scatter',
      chartType: 'scatter',
      title: `${numeric[0].name} vs ${numeric[1].name}`,
      reason: 'Two real numeric columns — scatter reveals correlation and distribution.',
      xCol: numeric[0].name,
      yCol: numeric[1].name,
      confidence: 85,
      icon: '🔵',
    });
  }

  if (date.length && numeric.length >= 2) {
    recs.push({
      id: 'rec_area',
      chartType: 'area',
      title: `${numeric[1].name} Volume over Time`,
      reason: `Area chart shows cumulative volume of ${numeric[1].name} over ${date[0].name}.`,
      xCol: date[0].name,
      yCol: numeric[1].name,
      confidence: 78,
      icon: '📉',
    });
  }

  const secondStr = string.filter((c) => c.unique >= 2 && c.unique <= 15)[1];
  if (secondStr && numeric.length) {
    const best = _bestNumeric(numeric);
    recs.push({
      id: 'rec_bar2',
      chartType: 'bar',
      title: `${best.name} by ${secondStr.name}`,
      reason: `"${secondStr.name}" has ${secondStr.unique} groups — secondary breakdown.`,
      xCol: secondStr.name,
      yCol: best.name,
      confidence: 75,
      icon: '📊',
    });
  }

  const seen = new Set();
  const unique = [];
  for (const rec of recs) {
    const key = `${rec.chartType}|${rec.xCol}|${rec.yCol}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rec);
    }
  }
  return unique.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
};

// ── Auto dashboard (kpis + charts) ──────────────────────────────────
const buildAutoDashboard = (columns = [], rows = []) => {
  const realNumeric = columns.filter(isRealNumeric).slice(0, 4);
  const kpis = realNumeric.map((col) => {
    const vals = rows.map((r) => parseFloat(r[col.name])).filter((v) => Number.isFinite(v));
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      column: col.name,
      label: String(col.name).replace(/_/g, ' '),
      sum: +sum.toFixed(2),
      avg: +(sum / Math.max(vals.length, 1)).toFixed(2),
      min: col.min,
      max: col.max,
    };
  });
  return {
    kpis,
    charts: recommendCharts(columns, rows).slice(0, 6),
  };
};

module.exports = { recommendCharts, buildAutoDashboard };
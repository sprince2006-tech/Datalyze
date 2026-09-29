import { useState, useRef, createRef, useEffect } from 'react';
import { Sparkles, Zap, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import DataChart from '../Charts/DataChart';
import { fmt } from '../../utils/format';

const KpiCard = ({ kpi }) => (
  <div className="wp-card p-4">
    <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">{kpi.label}</div>
    <div className="text-[28px] font-extrabold text-gray-900 leading-none mb-1.5">{fmt(kpi.sum)}</div>
    <div className="flex gap-3 text-[11px] text-gray-500">
      <span>Avg: <strong className="text-brand">{fmt(kpi.avg)}</strong></span>
      <span>Min: <strong>{fmt(kpi.min)}</strong></span>
      <span>Max: <strong>{fmt(kpi.max)}</strong></span>
    </div>
  </div>
);

const ChartCard = ({ rec, datasetId, chartRef }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Treat stored data as valid only if it actually has points
    const stored = Array.isArray(rec.data) ? rec.data : null;
    if (stored && stored.length > 0) {
      setData(stored);
      setLoading(false);
      return () => { cancelled = true; };
    }

    if (!rec.xCol) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    // Otherwise fetch fresh data
    setLoading(true);
    setError(null);
    api.get(`/datasets/${datasetId}/chart-data`, {
      params: { xCol: rec.xCol, yCol: rec.yCol, type: rec.chartType },
    })
      .then((r) => {
        if (cancelled) return;
        const fresh = Array.isArray(r.data.data) ? r.data.data : [];
        if (fresh.length === 0) {
          setError('No data for this chart');
        } else {
          setData(fresh);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.response?.data?.message || 'Failed to load chart');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [datasetId, rec.xCol, rec.yCol, rec.chartType, rec.data]);

  return (
    <div className="wp-card">
      <div className="wp-card-header flex-wrap gap-1.5">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg">{rec.icon || '📊'}</span>
          <span className="text-[13px] font-bold">{rec.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-light text-brand uppercase">{rec.chartType}</span>
          {rec.confidence != null && <span className="text-[11px] font-bold text-gray-500">{rec.confidence}% match</span>}
        </div>
      </div>
      {rec.reason && <p className="px-4 pt-1.5 text-[11px] text-gray-400 italic">{rec.reason}</p>}
      <div ref={chartRef} className="p-4 pt-2">
        {loading && <div className="h-[220px] flex items-center justify-center"><div className="spinner" /></div>}
        {error && !loading && (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-[13px] border border-dashed rounded-md">
            {error}
          </div>
        )}
        {!loading && !error && data && data.length > 0 && (
          <DataChart type={rec.chartType} data={data} xKey="name" yKey="value" height={220} />
        )}
      </div>
    </div>
  );
};

export default function AutoDashboard({ datasetId, datasetName, chartRefs }) {
  const [generated, setGenerated] = useState(false);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (dashData?.charts?.length && chartRefs) {
      chartRefs.current = dashData.charts.map((_, i) => chartRefs.current[i] || createRef());
    }
  }, [dashData, chartRefs]);

  const handleGenerate = async () => {
    setGenerated(true); setLoading(true); setError(null); setDashData(null);
    try {
      const res = await api.get(`/datasets/${datasetId}/auto-dashboard`);
      const data = res.data.data;
      if (data?.charts?.length) {
        const seen = new Set();
        data.charts = data.charts.filter((c) => {
          const k = `${c.chartType}|${c.xCol}|${c.yCol}`;
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
      }
      setDashData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate dashboard');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-6 mb-5 rounded-lg flex items-center justify-between gap-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Zap size={18} color="#fff" />
            <span className="text-base font-bold text-white">AI Auto Dashboard</span>
          </div>
          <p className="text-[13px] text-white/70 max-w-lg m-0">
            AI builds the most meaningful charts for <strong className="text-white">{datasetName}</strong>.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-md font-bold text-sm disabled:opacity-70"
        >
          <Sparkles size={16} />
          {loading ? 'Generating…' : generated ? 'Regenerate' : 'Generate Dashboard'}
        </button>
      </div>

      {!generated && (
        <div className="wp-card p-12 text-center">
          <Sparkles size={48} color="#e5e7eb" className="mx-auto mb-3.5" />
          <p className="text-base font-bold mb-2">Ready to build your AI dashboard</p>
          <p className="text-[13px] text-gray-500 max-w-md mx-auto mb-6">Click generate and AI will pick the best charts.</p>
          <button className="btn-wp" onClick={handleGenerate}><Sparkles size={15} /> Generate AI Dashboard</button>
        </div>
      )}

      {generated && loading && (
        <div className="text-center py-12">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-[15px] font-bold mb-1">AI is analysing your data…</p>
        </div>
      )}

      {generated && !loading && error && <div className="notice notice-error">{error}</div>}

      {generated && !loading && dashData && (
        <div className="fade-up">
          {dashData.kpis?.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} color="#e03e2d" />
                <span className="text-[13px] font-bold text-gray-700">Key Metrics</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {dashData.kpis.map((kpi) => <KpiCard key={kpi.column} kpi={kpi} />)}
              </div>
            </div>
          )}
          {dashData.charts?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} color="#e03e2d" />
                <span className="text-[13px] font-bold text-gray-700">AI Recommended Charts</span>
                {dashData.engine === 'python' && (
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">🐍 Python ML</span>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {dashData.charts.map((rec, i) => (
                  <ChartCard key={rec.id || i} rec={rec} datasetId={datasetId} chartRef={chartRefs?.current?.[i]} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
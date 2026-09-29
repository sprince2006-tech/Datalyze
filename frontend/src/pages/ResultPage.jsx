import { useEffect, useRef, createRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Sparkles, TrendingUp, AlertCircle, Save } from 'lucide-react';
import api from '../utils/api';
import DataChart from '../components/Charts/DataChart';
import SignupModal from '../components/Modal/SignupModal';
import { useAuth } from '../context/AuthContext';
import { chartToImage, waitForChartsToRender } from '../utils/chartExport';
import { getPendingFile, clearPendingFile } from '../utils/pendingUpload';
import { fmt } from '../utils/format';
import Logo from '../components/Logo';

const KPICard = ({ kpi }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{kpi.label}</div>
    <div className="text-[30px] font-extrabold text-gray-900 leading-none mb-1.5">{fmt(kpi.sum)}</div>
    <div className="flex gap-3 text-xs text-gray-500">
      <span>Avg: <strong className="text-brand">{fmt(kpi.avg)}</strong></span>
      <span>Min: <strong>{fmt(kpi.min)}</strong></span>
      <span>Max: <strong>{fmt(kpi.max)}</strong></span>
    </div>
  </div>
);

const ChartCard = ({ rec, chartRef, datasetId }) => {
  const inline = Array.isArray(rec.data) ? rec.data : [];
  const [data, setData] = useState(inline);
  const [loading, setLoading] = useState(inline.length === 0 && !!datasetId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (inline.length > 0) { setData(inline); setLoading(false); return; }
    if (!datasetId || !rec.xCol) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    api.get(`/datasets/${datasetId}/chart-data`, {
      params: { xCol: rec.xCol, yCol: rec.yCol, type: rec.chartType },
    })
      .then((r) => {
        if (cancelled) return;
        const fresh = Array.isArray(r.data.data) ? r.data.data : [];
        if (fresh.length === 0) setError('No data for this chart');
        else setData(fresh);
      })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.message || 'Failed to load chart'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [datasetId, rec.xCol, rec.yCol, rec.chartType, inline]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{rec.icon || '📊'}</span>
          <span className="text-sm font-bold text-gray-900">{rec.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 uppercase">
            {rec.chartType}
          </span>
          {rec.confidence != null && (
            <span className="text-[11px] font-bold text-gray-500">{rec.confidence}% match</span>
          )}
        </div>
      </div>
      {rec.reason && <p className="px-4 pt-2 text-xs text-gray-400 italic m-0">{rec.reason}</p>}
      <div ref={chartRef} className="p-3">
        {loading && <div className="h-[220px] flex items-center justify-center"><div className="spinner" /></div>}
        {error && !loading && (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm border border-dashed rounded-md">{error}</div>
        )}
        {!loading && !error && data.length > 0 && (
          <DataChart type={rec.chartType} data={data} xKey="name" yKey="value" height={220} />
        )}
        {!loading && !error && data.length === 0 && (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm border border-dashed rounded-md">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default function ResultPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const chartRefs = useRef([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResult');
    const name = sessionStorage.getItem('fileName');
    if (!stored) { navigate('/'); return; }

    let parsed;
    try { parsed = JSON.parse(stored); }
    catch { navigate('/'); return; }

    setResult(parsed);
    setFileName(name || 'Your file');

    const charts = parsed.recommendations || parsed.charts || [];
    chartRefs.current = charts.map((_, i) => chartRefs.current[i] || createRef());
  }, [navigate]);

  if (!result) return null;

  const recommendations = result.recommendations || result.charts || [];
  const kpis = Array.isArray(result.kpis) ? result.kpis : [];
  const insights = Array.isArray(result.insights) ? result.insights : [];
  const columns = Array.isArray(result.columns) ? result.columns : [];
  const correlations = Array.isArray(result.correlations) ? result.correlations : [];
  const isTextFile = result.source === 'node' && recommendations.length === 0 && kpis.length === 0;
  const datasetId = result.dataset_id || result._id || null;

  const downloadPDF = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      await waitForChartsToRender(1200);

      const chartImages = [];
      console.log('[PDF] recommendations:', recommendations.length);
      for (let i = 0; i < recommendations.length; i += 1) {
        const ref = chartRefs.current[i];
        if (!ref?.current) {
          console.warn(`[PDF] ref missing for chart ${i}`);
          continue;
        }
        const img = await chartToImage(ref.current);
        if (img) {
          chartImages.push({
            image: img,
            title: recommendations[i].title || 'Chart',
            chartType: recommendations[i].chartType || '',
            confidence: recommendations[i].confidence || null,
            reason: recommendations[i].reason || '',
          });
          console.log(`[PDF] captured chart ${i + 1}: ${recommendations[i].title}`);
        } else {
          console.warn(`[PDF] chart ${i + 1} capture returned null`);
        }
      }
      console.log(`[PDF] total charts captured: ${chartImages.length}/${recommendations.length}`);

      const res = await api.post(
        '/public/generate-pdf',
        { data: result, fileName, chartImages },
        { responseType: 'blob', timeout: 60000 },
      );

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (fileName || 'report').replace(/[^a-z0-9._-]/gi, '-');
      a.href = url;
      a.download = `DataLyze-${safeName}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PDF] failed:', err);
      alert('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadClick = () => {
    if (!user) { setPendingAction('download'); setShowSignupModal(true); }
    else downloadPDF();
  };

  const saveToAccount = async () => {
    const file = getPendingFile();
    if (!file) {
      setSaveMsg('Original file is no longer available. Please upload again.');
      return;
    }
    setSaving(true); setSaveMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd, {});
      if (!res.data.success) throw new Error(res.data.message);
      clearPendingFile();
      navigate(`/dashboard/datasets/${res.data.datasetId}`);
    } catch (err) {
      setSaveMsg(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSaveClick = () => {
    if (!user) { setPendingAction('save'); setShowSignupModal(true); }
    else saveToAccount();
  };

  const handleModalSuccess = () => {
    const action = pendingAction;
    setPendingAction(null);
    setShowSignupModal(false);
    if (action === 'save') saveToAccount();
    else if (action === 'download') downloadPDF();
  };

  const handleModalClose = () => {
    setShowSignupModal(false);
    setPendingAction(null);
  };

  const modalConfig = pendingAction === 'save'
    ? {
        title: 'Save to Dashboard',
        subtitle: 'Create a free account to save this dashboard and access it anytime from any device.',
        allowGuest: false,
      }
    : {
        title: 'Download Report',
        subtitle: 'Create a free account to save your analysis, or download without one.',
        allowGuest: true,
      };

  return (
    <div className="min-h-screen bg-gray-50">
      <SignupModal
        isOpen={showSignupModal}
        onClose={handleModalClose}
        onDownloadWithoutSignup={handleModalSuccess}
        allowGuest={modalConfig.allowGuest}
        title={modalConfig.title}
        subtitle={modalConfig.subtitle}
      />

      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
            <ArrowLeft size={15} /> New analysis
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <Logo size={28} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save to Dashboard'}
          </button>
          <button onClick={handleDownloadClick} disabled={downloading} className="btn-wp disabled:opacity-60">
            <Download size={14} /> {downloading ? 'Generating…' : 'Download Report'}
          </button>
        </div>
      </nav>

      {saveMsg && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-[13px] text-amber-800 text-center">
          {saveMsg}
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 m-0 mb-1">{fileName}</h1>
          <p className="text-sm text-gray-500 m-0">
            {result.row_count?.toLocaleString() || 0} rows · {result.col_count || 0} columns
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Rows', value: result.row_count?.toLocaleString() || 0 },
            { label: 'Columns', value: result.col_count || 0 },
            { label: 'Charts', value: recommendations.length },
          ].map(({ label, value }) => (
            <div key={label} className="px-3.5 py-1.5 bg-gray-100 rounded-full text-[13px] text-gray-700">
              <strong>{value}</strong> {label}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
        {['dashboard', 'columns', 'insights'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm border-b-2 transition capitalize ${
              activeTab === tab ? 'border-brand text-brand font-bold' : 'border-transparent text-gray-500 font-medium'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <>
            {!user && recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                💡 Sign up to <strong>save this dashboard</strong> and access it anytime.
              </div>
            )}
            {isTextFile && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
                <strong>No charts.</strong> This file contains text, not tabular data. Upload a CSV, Excel, or JSON file.
              </div>
            )}
            {kpis.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={15} className="text-brand" />
                  <span className="text-sm font-bold text-gray-700">Key Metrics</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {kpis.map((kpi, i) => <KPICard key={kpi.column || i} kpi={kpi} />)}
                </div>
              </div>
            )}
            {recommendations.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} className="text-brand" />
                  <span className="text-sm font-bold text-gray-700">AI Recommended Charts</span>
                  <span className="text-xs text-gray-400">— {recommendations.length} generated</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {recommendations.map((rec, i) => (
                    <ChartCard
                      key={rec.id || i}
                      rec={rec}
                      chartRef={chartRefs.current[i]}
                      datasetId={datasetId}
                    />
                  ))}
                </div>
              </div>
            )}
            {!isTextFile && kpis.length === 0 && recommendations.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <AlertCircle size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-base font-bold text-gray-900 mb-1">No data to display</p>
                <p className="text-sm text-gray-500">Try a CSV or Excel file with at least one numeric column.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'columns' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">Column Analysis</div>
            {columns.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">No columns detected.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Column', 'Type', 'Unique', 'Nulls', 'Min', 'Max', 'Mean'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col, i) => (
                      <tr key={col.name || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{col.name}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600">
                            {col.role || col.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{col.unique?.toLocaleString() || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{col.null_count ?? col.nullCount ?? 0}</td>
                        <td className="px-4 py-2.5 text-gray-700">{col.min ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{col.max ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{col.mean ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="flex flex-col gap-3">
            {insights.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                No insights available for this file.
              </div>
            )}
            {insights.map((ins, i) => {
              const type = ins.type || 'info';
              const message = ins.message || ins;
              const colors = {
                warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: '⚠️' },
                info:    { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-800',  icon: 'ℹ️' },
                success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: '✅' },
              };
              const c = colors[type] || colors.info;
              return (
                <div key={i} className={`${c.bg} ${c.border} border rounded-lg p-4 flex gap-3 items-start`}>
                  <span className="text-base shrink-0">{c.icon}</span>
                  <p className={`m-0 text-sm ${c.text} leading-relaxed`}>{message}</p>
                </div>
              );
            })}
            {correlations.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mt-2">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Column Correlations</h3>
                {correlations.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-[13px] text-gray-700 flex-1">
                      <strong>{c.col_a}</strong> ↔ <strong>{c.col_b}</strong>
                    </span>
                    <span className="text-xs text-gray-500">{c.strength}</span>
                    <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      Math.abs(c.correlation) >= 0.6 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                    }`}>
                      r = {c.correlation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
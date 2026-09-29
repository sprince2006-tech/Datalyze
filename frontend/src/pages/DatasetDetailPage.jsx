import { useState, useRef, createRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, BarChart2, AlertCircle, FileText } from 'lucide-react';
import api from '../utils/api';
import DataChart from '../components/Charts/DataChart';
import ChartRecommender from '../components/Charts/ChartRecommender';
import AutoDashboard from '../components/Dashboard/AutoDashboard';
import SignupModal from '../components/Modal/SignupModal';
import { useAuth } from '../context/AuthContext';
import { waitForChartsToRender, chartToImage } from '../utils/chartExport';

const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'donut', 'scatter'];

/**
 * Authenticated blob download.
 * Uses the shared axios instance so the Authorization header is sent.
 */
async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([res.data]);
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(link.href);
}

export default function DatasetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState('bar');
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [chartData, setChartData] = useState(null);
  const [buildingChart, setBuildingChart] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [exporting, setExporting] = useState(''); // '', 'xlsx', 'csv'
  const [exportError, setExportError] = useState('');
  const chartRefs = useRef([]);

  const { data, isLoading } = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => api.get(`/datasets/${id}`).then((r) => r.data.data),
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 3000 : false,
  });

  const ds = data;

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <div className="spinner w-8 h-8 mx-auto" />
      </div>
    );
  }
  if (!ds) return <div className="notice notice-error">Dataset not found.</div>;

  const tabs = ['overview', 'columns', 'preview', 'charts', 'ai recommend', 'ai dashboard'];
  const previewRows = ds.preview?.slice(0, 20) || [];
  const previewCols = previewRows.length ? Object.keys(previewRows[0]) : [];

  const buildChart = async () => {
    if (!xCol) return;
    setBuildingChart(true);
    try {
      const res = await api.get(`/datasets/${id}/chart-data`, {
        params: { xCol, yCol, type: chartType },
      });
      setChartData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setBuildingChart(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!user) setShowSignupModal(true);
    else downloadPDF();
  };

  const downloadPDF = async () => {
    if (!ds) return;
    setDownloadingPDF(true);
    try {
      const dashboardRes = await api.get(`/datasets/${id}/auto-dashboard`);
      const dashboardData = dashboardRes.data.data;

      const charts = dashboardData.charts || [];
      await waitForChartsToRender(800);

      const chartImages = [];
      if (activeTab === 'ai dashboard') {
        for (let i = 0; i < charts.length; i++) {
          const chartRef = chartRefs.current[i];
          if (chartRef && chartRef.current) {
            const img = await chartToImage(chartRef.current);
            if (img) {
              chartImages.push({
                image: img,
                title: charts[i].title || 'Chart',
                chartType: charts[i].chartType || '',
                confidence: charts[i].confidence || null,
                reason: charts[i].reason || '',
              });
            }
          }
        }
      }

      const pdfData = {
        row_count: ds.rowCount,
        col_count: ds.colCount,
        columns: ds.columns,
        kpis: dashboardData.kpis || [],
        recommendations: dashboardData.charts || [],
        insights: ds.aiInsights || [],
      };

      const response = await api.post(
        '/public/generate-pdf',
        { data: pdfData, fileName: ds.name, chartImages },
        { responseType: 'blob', timeout: 60000 },
      );

      const blobData = response.data;
      if (!blobData || blobData.size === 0) throw new Error('Server returned empty file');
      if (blobData.type?.includes('application/json')) {
        const txt = await blobData.text();
        let msg = 'Server error';
        try { msg = JSON.parse(txt).message || msg; } catch (_) {}
        throw new Error(msg);
      }

      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      const safeName = (ds.name || 'report').replace(/[^a-z0-9._-]/gi, '-');
      link.href = url;
      link.download = `DataLyze-${safeName}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[PDF] Download failed:', error);
      alert(error.response?.data?.message || error.message || 'Failed to download PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  // ── Excel / CSV export via authenticated blob download ────────────
  const handleExport = async (format) => {
    setExportError('');
    setExporting(format);
    try {
      const safeName = (ds.name || 'dataset').replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
      await downloadFile(
        `/reports/export/${ds._id}?format=${format}`,
        `${safeName}.${format}`,
      );
    } catch (err) {
      console.error('[EXPORT] failed:', err);
      let msg = 'Export failed. Try again.';
      // Blob responses hide JSON error bodies — read them
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          msg = JSON.parse(text).message || msg;
        } catch (_) { /* ignore */ }
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      }
      setExportError(msg);
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="fade-up">
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onDownloadWithoutSignup={downloadPDF}
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => navigate('/dashboard/datasets')}
          className="flex items-center gap-1 text-[13px] text-gray-500 bg-none border-none cursor-pointer"
        >
          <ArrowLeft size={14} /> Datasets
        </button>
        <span className="text-gray-200">/</span>
        <h1 className="text-lg font-extrabold text-gray-900 m-0">{ds.name}</h1>
        <span className={`badge badge-${ds.status}`}>{ds.status}</span>
        <div className="flex-1" />

        <button
          onClick={handleDownloadPDF}
          disabled={downloadingPDF || ds.status !== 'ready'}
          className="btn-wp"
          style={{ background: downloadingPDF ? '#9ca3af' : '#8b5cf6' }}
        >
          <FileText size={13} /> {downloadingPDF ? 'Generating…' : 'PDF Report'}
        </button>

        <button
          onClick={() => handleExport('xlsx')}
          disabled={exporting === 'xlsx' || ds.status !== 'ready'}
          className="btn-wp"
        >
          <Download size={13} /> {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
        </button>

        <button
          onClick={() => handleExport('csv')}
          disabled={exporting === 'csv' || ds.status !== 'ready'}
          className="btn-wp btn-wp-secondary"
        >
          <Download size={13} /> {exporting === 'csv' ? 'Exporting…' : 'CSV'}
        </button>
      </div>

      {exportError && (
        <div className="notice notice-error mb-3">{exportError}</div>
      )}

      {ds.status === 'processing' && (
        <div className="notice mb-3 flex items-center gap-2">
          <div className="spinner w-3.5 h-3.5" />
          Analyzing your file…
        </div>
      )}
      {ds.status === 'error' && (
        <div className="notice notice-error mb-3">Error: {ds.error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
        {[
          ['Rows', ds.rowCount?.toLocaleString() || '—'],
          ['Columns', ds.colCount || '—'],
          ['File type', ds.fileType?.toUpperCase()],
          ['File size', ds.fileSize ? `${(ds.fileSize / 1024).toFixed(0)} KB` : '—'],
          ['Uploaded', new Date(ds.createdAt).toLocaleDateString()],
        ].map(([l, v]) => (
          <div key={l} className="wp-card p-2.5 px-3.5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className="text-base font-bold text-gray-900">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3.5 py-2 text-[13px] border-b-2 whitespace-nowrap capitalize transition ${
              activeTab === t
                ? 'border-brand text-brand font-bold'
                : 'border-transparent text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="wp-card">
            <div className="wp-card-header">AI Insights</div>
            <div className="p-3 px-4">
              {!(ds.aiInsights || []).length ? (
                <p className="text-gray-400 text-[13px]">No insights yet.</p>
              ) : (
                (ds.aiInsights || []).map((ins, i) => (
                  <div key={i} className="flex gap-2 mb-2.5">
                    <AlertCircle size={14} color="#e03e2d" className="shrink-0 mt-0.5" />
                    <span className="text-[13px] text-gray-700">{ins}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="wp-card">
            <div className="wp-card-header">Column Types</div>
            <div className="p-3 px-4">
              {['numeric', 'string', 'date', 'boolean'].map((type) => {
                const count = (ds.columns || []).filter((c) => c.type === type).length;
                if (!count) return null;
                return (
                  <div key={type} className="flex items-center gap-2 mb-2">
                    <span className={`badge badge-${type} min-w-[60px] text-center`}>{type}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded">
                      <div
                        className="h-full rounded bg-brand"
                        style={{ width: `${(count / (ds.columns || []).length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 min-w-[16px]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'columns' && (
        <div className="wp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Column</th><th>Type</th><th>Nulls</th><th>Unique</th>
                  <th>Min</th><th>Max</th><th>Mean</th><th>Median</th><th>Std</th>
                </tr>
              </thead>
              <tbody>
                {(ds.columns || []).map((col) => (
                  <tr key={col.name}>
                    <td className="font-semibold">{col.name}</td>
                    <td><span className={`badge badge-${col.type}`}>{col.type}</span></td>
                    <td>{col.nullCount ?? '—'}</td>
                    <td>{col.unique?.toLocaleString() ?? '—'}</td>
                    <td>{col.min ?? '—'}</td>
                    <td>{col.max ?? '—'}</td>
                    <td>{col.mean ?? '—'}</td>
                    <td>{col.median ?? '—'}</td>
                    <td>{col.std ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="wp-card">
          <div className="wp-card-header">
            Data Preview <span className="text-[11px] text-gray-400 font-normal">first 20 rows</span>
          </div>
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="wp-table min-w-full">
              <thead className="sticky top-0 bg-white z-[1]">
                <tr>{previewCols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {previewCols.map((c) => (
                      <td key={c} className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {row[c] == null
                          ? <span className="text-gray-300 italic">null</span>
                          : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <div className="wp-card p-4 self-start">
            <p className="font-bold text-[13px] mb-3">Build a Chart</p>

            <label className="text-xs text-gray-500 block mb-1">Chart type</label>
            <select
              className="wp-input mb-3"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
            >
              {CHART_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>

            <label className="text-xs text-gray-500 block mb-1">X axis / Category</label>
            <select
              className="wp-input mb-3"
              value={xCol}
              onChange={(e) => setXCol(e.target.value)}
            >
              <option value="">— select column —</option>
              {(ds.columns || []).map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            <label className="text-xs text-gray-500 block mb-1">Y axis / Value</label>
            <select
              className="wp-input mb-4"
              value={yCol}
              onChange={(e) => setYCol(e.target.value)}
            >
              <option value="">— optional —</option>
              {(ds.columns || []).filter((c) => c.type === 'numeric').map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            <button
              className="btn-wp w-full justify-center"
              onClick={buildChart}
              disabled={!xCol || buildingChart}
            >
              <BarChart2 size={14} /> {buildingChart ? 'Building…' : 'Generate Chart'}
            </button>
          </div>

          <div className="wp-card p-4">
            {chartData ? (
              <DataChart
                type={chartType}
                data={chartData}
                xKey="name"
                yKey="value"
                height={360}
                title={`${xCol}${yCol ? ` vs ${yCol}` : ''}`}
              />
            ) : (
              <div className="h-[360px] flex flex-col items-center justify-center text-gray-400 text-[13px]">
                <BarChart2 size={36} className="text-gray-200 mb-3" />
                Select columns and click Generate Chart
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai recommend' && (
        <div className="wp-card overflow-hidden">
          <ChartRecommender datasetId={id} />
        </div>
      )}

      {activeTab === 'ai dashboard' && (
        <AutoDashboard datasetId={id} datasetName={ds.name} chartRefs={chartRefs} />
      )}
    </div>
  );
}
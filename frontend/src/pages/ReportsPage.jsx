import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import api from '../utils/api';
import { fmtDate } from '../utils/format';

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

export default function ReportsPage() {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get('/datasets').then((r) => r.data.data),
  });

  const ready = (data || []).filter((d) => d.status === 'ready');

  const handleExport = async (datasetId, datasetName, format) => {
    setError('');
    setExporting(`${datasetId}-${format}`);
    try {
      const safeName = (datasetName || 'dataset').replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
      await downloadFile(
        `/reports/export/${datasetId}?format=${format}`,
        `${safeName}.${format}`,
      );
    } catch (err) {
      console.error('[EXPORT] failed:', err);
      let msg = 'Export failed. Try again.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          msg = JSON.parse(text).message || msg;
        } catch (_) { /* ignore */ }
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      }
      setError(msg);
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="fade-up">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-gray-900 m-0">Reports</h1>
        <p className="text-[13px] text-gray-500 m-0">Export your datasets as Excel or CSV</p>
      </div>

      {error && <div className="notice notice-error mb-3">{error}</div>}

      {isLoading && (
        <div className="text-center py-16">
          <div className="spinner w-7 h-7 mx-auto" />
        </div>
      )}

      {isError && <div className="notice notice-error">Failed to load datasets.</div>}

      {!isLoading && !isError && ready.length === 0 && (
        <div className="wp-card p-16 text-center">
          <p className="text-[15px] font-bold mb-1.5">No ready datasets</p>
          <p className="text-[13px] text-gray-400 mb-4">Upload and analyze a file first.</p>
          <button className="btn-wp" onClick={() => navigate('/dashboard/upload')}>
            Upload a File
          </button>
        </div>
      )}

      {ready.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {ready.map((ds) => (
            <div key={ds._id} className="wp-card p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900">{ds.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {ds.rowCount?.toLocaleString() || 0} rows · {ds.colCount || 0} columns ·{' '}
                  {ds.fileType?.toUpperCase()} · {fmtDate(ds.createdAt)}
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  className="btn-wp btn-wp-secondary"
                  onClick={() => navigate(`/dashboard/datasets/${ds._id}`)}
                >
                  View
                </button>

                <button
                  className="btn-wp"
                  onClick={() => handleExport(ds._id, ds.name, 'xlsx')}
                  disabled={exporting === `${ds._id}-xlsx`}
                >
                  <Download size={13} />
                  {exporting === `${ds._id}-xlsx` ? 'Exporting…' : 'Excel'}
                </button>

                <button
                  className="btn-wp btn-wp-secondary"
                  onClick={() => handleExport(ds._id, ds.name, 'csv')}
                  disabled={exporting === `${ds._id}-csv`}
                >
                  <Download size={13} />
                  {exporting === `${ds._id}-csv` ? 'Exporting…' : 'CSV'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
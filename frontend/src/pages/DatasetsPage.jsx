import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Trash2, Download } from 'lucide-react';
import api from '../utils/api';
import { fmtSize, fmtDate } from '../utils/format';

export default function DatasetsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get('/datasets').then((r) => r.data.data),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/datasets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['datasets'] }),
  });

  const filtered = (data || []).filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 m-0">Datasets</h1>
          <p className="text-[13px] text-gray-500 m-0">{filtered.length} dataset{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-wp btn-wp-secondary" onClick={() => refetch()}><RefreshCw size={13} /> Refresh</button>
          <Link to="/dashboard/upload" className="btn-wp">+ Upload</Link>
        </div>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="wp-input pl-8" placeholder="Search datasets…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="wp-card overflow-hidden">
        {isLoading && <div className="p-8 text-center"><div className="spinner mx-auto" /></div>}
        {isError && <div className="p-5 notice notice-error">Failed to load datasets.</div>}
        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Name</th><th>Type</th><th>Rows</th><th>Columns</th>
                  <th>Size</th><th>Status</th><th>Uploaded</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">No datasets. <Link to="/dashboard/upload" className="text-brand">Upload one!</Link></td></tr>
                )}
                {filtered.map((ds) => (
                  <tr key={ds._id}>
                    <td>
                      <button className="text-brand font-semibold" onClick={() => navigate(`/dashboard/datasets/${ds._id}`)}>{ds.name}</button>
                    </td>
                    <td><span className="text-[11px] uppercase">{ds.fileType}</span></td>
                    <td>{ds.rowCount?.toLocaleString() || '—'}</td>
                    <td>{ds.colCount || '—'}</td>
                    <td>{fmtSize(ds.fileSize)}</td>
                    <td><span className={`badge badge-${ds.status}`}>{ds.status}</span></td>
                    <td className="text-gray-400">{fmtDate(ds.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-wp btn-wp-secondary text-[11px] px-2 py-1" onClick={() => navigate(`/dashboard/datasets/${ds._id}`)}>View</button>
                        <button
                          className="btn-wp btn-wp-danger text-[11px] px-2 py-1"
                          onClick={() => { if (confirm(`Delete "${ds.name}"?`)) del.mutate(ds._id); }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, Plus } from 'lucide-react';
import api from '../utils/api';
import DataChart from '../components/Charts/DataChart';
import { fmtDate } from '../utils/format';

export default function VisualizePage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['charts'],
    queryFn: () => api.get('/charts').then((r) => r.data.data),
  });
  const charts = data || [];

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 m-0">Visualize</h1>
          <p className="text-[13px] text-gray-500 m-0">All your saved charts</p>
        </div>
        <button className="btn-wp" onClick={() => navigate('/dashboard/datasets')}>
          <Plus size={14} /> New Chart
        </button>
      </div>

      {isLoading && <div className="text-center py-16"><div className="spinner mx-auto" /></div>}
      {isError && <div className="notice notice-error">Failed to load charts.</div>}

      {!isLoading && !isError && charts.length === 0 && (
        <div className="wp-card p-16 text-center">
          <BarChart2 size={48} color="#e5e7eb" className="mx-auto mb-3" />
          <p className="text-[15px] font-bold mb-1.5">No charts yet</p>
          <p className="text-[13px] text-gray-400 mb-4">
            Open a dataset → Charts tab → build and save visualizations.
          </p>
          <button className="btn-wp" onClick={() => navigate('/dashboard/datasets')}>
            Go to Datasets
          </button>
        </div>
      )}

      {charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {charts.map((chart) => (
            <div key={chart._id} className="wp-card">
              <div className="wp-card-header">
                <span>{chart.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{chart.dataset?.name || 'Unknown'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-brand-light text-brand font-semibold">
                    {chart.type}
                  </span>
                </div>
              </div>
              <div className="p-4">
                {chart.chartData ? (
                  <DataChart type={chart.type} data={chart.chartData} xKey="name" yKey="value" height={240} />
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-gray-400 text-[13px] border border-dashed rounded">
                    Chart data unavailable
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-2 text-right">
                  Created {fmtDate(chart.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
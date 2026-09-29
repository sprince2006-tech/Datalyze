import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, CheckCircle, BarChart2 } from 'lucide-react';
import api from '../../utils/api';
import DataChart from './DataChart';

export default function ChartRecommender({ datasetId }) {
  const [selected, setSelected] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recommend', datasetId],
    queryFn: () => api.get(`/datasets/${datasetId}/recommend`).then((r) => r.data.data),
    enabled: !!datasetId,
  });

  const handleSelect = async (rec) => {
    setSelected(rec.id); setLoading(true); setError('');
    try {
      const res = await api.get(`/datasets/${datasetId}/chart-data`, {
        params: { xCol: rec.xCol, yCol: rec.yCol, type: rec.chartType },
      });
      setChartData({ ...rec, data: res.data.data });
    } catch {
      setError('Failed to load chart data');
      setChartData(null);
    } finally { setLoading(false); }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="spinner mx-auto mb-2" />
        <p className="text-[13px] text-gray-500">Analysing your data…</p>
      </div>
    );
  }

  if (isError) {
    return <div className="p-6 notice notice-error">Failed to load recommendations.</div>;
  }

  const recs = data || [];

  return (
    <div>
      <div className="flex items-center gap-2.5 px-4 py-3.5 bg-gradient-to-br from-brand-light to-white border-b border-gray-200">
        <Sparkles size={18} color="#e03e2d" />
        <div>
          <div className="text-sm font-bold">AI Chart Recommender</div>
          <div className="text-xs text-gray-500">{recs.length} recommendations</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[420px]">
        <div className="border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto">
          {!recs.length && <p className="p-5 text-[13px] text-gray-500">Not enough variety for recommendations.</p>}
          {recs.map((rec) => (
            <button
              key={rec.id}
              type="button"
              onClick={() => handleSelect(rec)}
              className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition ${
                selected === rec.id ? 'bg-brand-light border-l-[3px] border-l-brand' : 'border-l-[3px] border-l-transparent'
              }`}
            >
              <div className="flex gap-2.5 items-start">
                <span className="text-xl shrink-0">{rec.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[13px] font-bold truncate">{rec.title}</span>
                    {selected === rec.id && <CheckCircle size={13} className="text-green-600" />}
                  </div>
                  <div className="text-[11px] text-gray-500 leading-snug mb-1.5">{rec.reason}</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-light text-brand uppercase">{rec.chartType}</span>
                    <span className="text-[11px] text-gray-500">{rec.confidence}% match</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-5 flex flex-col justify-center">
          {loading && <div className="text-center"><div className="spinner mx-auto mb-2.5" /><p className="text-[13px] text-gray-500">Building chart…</p></div>}
          {!loading && !chartData && !error && (
            <div className="text-center text-gray-400">
              <BarChart2 size={48} color="#e5e7eb" className="mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700 mb-1">Select a recommendation</p>
              <p className="text-[13px]">Click any chart on the left to preview</p>
            </div>
          )}
          {error && <div className="text-center text-red-600 text-sm">{error}</div>}
          {!loading && chartData && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{chartData.icon}</span>
                <div>
                  <div className="text-sm font-bold">{chartData.title}</div>
                  <div className="text-[11px] text-gray-500">{chartData.reason}</div>
                </div>
              </div>
              <DataChart type={chartData.chartType} data={chartData.data} xKey="name" yKey="value" height={320} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
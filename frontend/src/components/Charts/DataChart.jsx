import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#e03e2d', '#3b82f6', '#16a34a', '#d97706', '#8b5cf6', '#06b6d4', '#f97316', '#10b981'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="font-bold mb-1 text-gray-900">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : String(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

export default function DataChart({
  type = 'bar', data = [], xKey = 'name', yKey = 'value', height = 300, title,
}) {
  if (!Array.isArray(data) || !data.length) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-[13px] border border-dashed border-gray-200 rounded-md" style={{ height }}>
        No data available
      </div>
    );
  }

  const axisStyle = { fontSize: 11, fill: '#9ca3af' };

  const render = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={xKey} tick={axisStyle} angle={-30} textAnchor="end" interval="preserveStartEnd" height={50} />
            <YAxis tick={axisStyle} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} fill="#e03e2d" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={xKey} tick={axisStyle} angle={-30} textAnchor="end" interval="preserveStartEnd" height={50} />
            <YAxis tick={axisStyle} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Line dataKey={yKey} stroke="#e03e2d" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={xKey} tick={axisStyle} angle={-30} textAnchor="end" interval="preserveStartEnd" height={50} />
            <YAxis tick={axisStyle} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Area dataKey={yKey} stroke="#e03e2d" fill="rgba(224,62,45,.1)" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        );
      case 'pie':
      case 'donut': {
        const top = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
        const limited = top.length > 12
          ? [...top.slice(0, 11), { name: 'Other', value: top.slice(11).reduce((s, d) => s + (d.value || 0), 0) }]
          : top;
        return (
          <PieChart>
            <Pie data={limited} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%"
              innerRadius={type === 'donut' ? '55%' : 0} outerRadius="75%" paddingAngle={2}
              isAnimationActive={false}
            >
              {limited.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        );
      }
      case 'scatter': {
        const pts = Array.isArray(data)
          ? data.map((d) => ({ x: Number(d.x ?? d[xKey]), y: Number(d.y ?? d[yKey]) }))
              .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          : [];
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="x" type="number" tick={axisStyle} name={xKey} tickCount={5} />
            <YAxis dataKey="y" type="number" tick={axisStyle} name={yKey} width={55} tickCount={5} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            <Scatter data={pts} fill="#e03e2d" isAnimationActive={false} />
          </ScatterChart>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      {title && <p className="text-[13px] font-semibold text-gray-900 mb-2.5">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>{render()}</ResponsiveContainer>
    </div>
  );
}
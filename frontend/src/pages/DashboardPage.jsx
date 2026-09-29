import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Database, Upload, BarChart2, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import DataChart from '../components/Charts/DataChart';

const StatCard = ({ label, value, icon:Icon, color='#e03e2d', sub }) => (
  <div className="wp-card" style={{ padding:'16px', display:'flex', gap:14, alignItems:'flex-start' }}>
    <div style={{ width:40, height:40, borderRadius:8, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize:22, fontWeight:800, color:'#111827', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#16a34a', marginTop:2 }}>{sub}</div>}
    </div>
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data:dsData, isLoading } = useQuery({ queryKey:['datasets'], queryFn:()=>api.get('/datasets').then(r=>r.data.data) });
  const { data:chartsData } = useQuery({ queryKey:['charts'], queryFn:()=>api.get('/charts').then(r=>r.data.data) });
  const datasets = dsData||[]; const charts = chartsData||[];
  const ready = datasets.filter(d=>d.status==='ready');
  const totalRows = ready.reduce((s,d)=>s+(d.rowCount||0),0);
  const dsChart = datasets.slice(0,8).map(d=>({ name:d.name.length>10?d.name.slice(0,10)+'…':d.name, value:d.rowCount||0 }));

  return (
    <div className="fade-up">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#111827', margin:0 }}>Dashboard</h1>
          <p style={{ fontSize:13, color:'#6b7280', margin:'4px 0 0' }}>Analytics overview — all your data at a glance</p>
        </div>
        <button className="btn-wp" onClick={()=>navigate('/dashboard/upload')}><Upload size={14} />Upload Data</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
        <StatCard label="Total Datasets" value={datasets.length} icon={Database} color="#e03e2d" sub={`${ready.length} ready`} />
        <StatCard label="Total Rows" value={totalRows.toLocaleString()} icon={TrendingUp} color="#16a34a" />
        <StatCard label="Saved Charts" value={charts.length} icon={BarChart2} color="#d97706" />
        <StatCard label="Reports" value="—" icon={FileText} color="#8b5cf6" sub="Coming soon" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <div className="wp-card">
          <div className="wp-card-header">Rows per Dataset<span style={{ fontSize:11, color:'#9ca3af', fontWeight:400 }}>top 8</span></div>
          <div style={{ padding:'16px' }}>
            {isLoading ? <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center' }}><div className="spinner" /></div>
              : dsChart.length ? <DataChart type="bar" data={dsChart} xKey="name" yKey="value" height={220} />
              : <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:'60px 0' }}>No datasets yet. <a href="/dashboard/upload" style={{ color:'#e03e2d' }}>Upload one!</a></p>}
          </div>
        </div>
        <div className="wp-card">
          <div className="wp-card-header">Dataset Status</div>
          <div style={{ padding:'16px' }}>
            {datasets.length ? <DataChart type="donut" data={[
              { name:'Ready', value:datasets.filter(d=>d.status==='ready').length },
              { name:'Processing', value:datasets.filter(d=>d.status==='processing').length },
              { name:'Error', value:datasets.filter(d=>d.status==='error').length }
            ].filter(d=>d.value>0)} xKey="name" yKey="value" height={220} />
            : <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:'60px 0' }}>No data yet</p>}
          </div>
        </div>
      </div>

      <div className="wp-card">
        <div className="wp-card-header">Recent Datasets<button className="btn-wp btn-wp-secondary" style={{ fontSize:11, padding:'2px 10px' }} onClick={()=>navigate('/dashboard/datasets')}>View All</button></div>
        <div style={{ overflowX:'auto' }}>
          <table className="wp-table">
            <thead><tr><th>Name</th><th>Type</th><th>Rows</th><th>Columns</th><th>Status</th><th>Uploaded</th><th></th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} style={{ textAlign:'center', padding:24 }}><div className="spinner" /></td></tr>
                : !datasets.length ? <tr><td colSpan={7} style={{ textAlign:'center', padding:24, color:'#9ca3af' }}>No datasets found. <a href="/dashboard/upload" style={{ color:'#e03e2d' }}>Upload your first file!</a></td></tr>
                : datasets.slice(0,8).map(ds => (
                  <tr key={ds._id}>
                    <td style={{ fontWeight:600, color:'#e03e2d', cursor:'pointer' }} onClick={()=>navigate(`/dashboard/datasets/${ds._id}`)}>{ds.name}</td>
                    <td><span style={{ textTransform:'uppercase', fontSize:11 }}>{ds.fileType}</span></td>
                    <td>{ds.rowCount?.toLocaleString()||'—'}</td><td>{ds.colCount||'—'}</td>
                    <td><span className={`badge badge-${ds.status}`}>{ds.status}</span></td>
                    <td style={{ color:'#9ca3af' }}>{new Date(ds.createdAt).toLocaleDateString()}</td>
                    <td><button className="btn-wp btn-wp-secondary" style={{ fontSize:11, padding:'2px 8px' }} onClick={()=>navigate(`/dashboard/datasets/${ds._id}`)}>View</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {ready.some(d=>d.aiInsights?.length) && (
        <div style={{ marginTop:16 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:8 }}>AI Insights</h2>
          {ready.slice(0,3).flatMap(d=>(d.aiInsights||[]).slice(0,2).map((ins,i) => (
            <div key={`${d._id}-${i}`} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#fff', borderLeft:'4px solid #e03e2d', padding:'10px 14px', borderRadius:'0 6px 6px 0', marginBottom:8, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
              <AlertCircle size={15} color="#e03e2d" style={{ flexShrink:0, marginTop:1 }} />
              <div><span style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>{d.name} · </span><span style={{ fontSize:13, color:'#111827' }}>{ins}</span></div>
            </div>
          )))}
        </div>
      )}
    </div>
  );
}

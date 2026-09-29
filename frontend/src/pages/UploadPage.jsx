import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/Upload/FileUpload';

export default function UploadPage() {
  const navigate = useNavigate();
  return (
    <div className="fade-up" style={{ maxWidth:800 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:'#111827', margin:0 }}>Upload Files</h1>
        <p style={{ fontSize:13, color:'#6b7280', margin:'4px 0 0' }}>Upload Excel, CSV, PDF, Word or JSON — analyzed automatically.</p>
      </div>
      <div className="wp-card" style={{ padding:20, marginBottom:16 }}>
        <FileUpload onUploadSuccess={(ds) => setTimeout(()=>navigate(`/dashboard/datasets/${ds._id}`),1500)} />
      </div>
      <div className="wp-card">
        <div className="wp-card-header">Tips for best results</div>
        <div style={{ padding:'14px 16px' }}>
          {[['Excel / CSV','First row should be column headers. Numeric columns auto-detect statistics.'],['PDF / Word','Text content extracted line by line.'],['JSON','Arrays of objects work best.'],['File size','Files up to 50 MB supported.']].map(([t,d])=>(
            <div key={t} style={{ display:'flex', gap:10, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#e03e2d', flexShrink:0, marginTop:6 }} />
              <div><span style={{ fontWeight:700, color:'#111827' }}>{t}: </span><span style={{ color:'#6b7280' }}>{d}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

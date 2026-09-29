import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, FileText, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../utils/api';
import { fmtSize } from '../../utils/format';

const FILE_ICONS = {
  xlsx: FileSpreadsheet, xls: FileSpreadsheet, csv: FileSpreadsheet,
  pdf: FileText, docx: FileText, json: File, txt: File,
};
const ACCEPTED = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/json': ['.json'],
  'text/plain': ['.txt'],
};

export default function FileUpload({ onUploadSuccess }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState([]);
  const [name, setName] = useState('');
  const [rejection, setRejection] = useState('');

  const onDrop = useCallback((accepted) => {
    setRejection('');
    setFiles((prev) => [
      ...prev,
      ...accepted.map((f) => ({ file: f, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, status: 'pending', progress: 0 })),
    ]);
  }, []);

  const onDropRejected = useCallback((rejections) => {
    const r = rejections[0];
    const msg = r.errors.map((e) => e.message).join(', ');
    setRejection(msg || 'File rejected');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, onDropRejected, accept: ACCEPTED, maxSize: 50 * 1024 * 1024,
  });

  const uploadFile = async (item) => {
    setFiles((p) => p.map((f) => (f.id === item.id ? { ...f, status: 'uploading', progress: 10 } : f)));
    try {
      const fd = new FormData();
      fd.append('file', item.file);
      if (name) fd.append('name', name);

      const res = await api.post('/upload', fd, {
        // NOTE: do NOT set Content-Type manually — axios sets the boundary
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 80) + 10;
          setFiles((p) => p.map((f) => (f.id === item.id ? { ...f, progress: pct } : f)));
        },
      });
      const datasetId = res.data.datasetId;
      setFiles((p) => p.map((f) => (f.id === item.id ? { ...f, status: 'processing', progress: 90, datasetId } : f)));
      pollDataset(item.id, datasetId);
    } catch (err) {
      setFiles((p) => p.map((f) => (f.id === item.id ? { ...f, status: 'error', error: err.response?.data?.message || 'Upload failed' } : f)));
    }
  };

  const pollDataset = (itemId, datasetId) => {
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      if (tries > 150) { clearInterval(iv); return; } // 5 minutes max
      try {
        const res = await api.get(`/datasets/${datasetId}`);
        const status = res.data.data.status;
        if (status === 'ready') {
          clearInterval(iv);
          setFiles((p) => p.map((f) => (f.id === itemId ? { ...f, status: 'done', progress: 100 } : f)));
          qc.invalidateQueries({ queryKey: ['datasets'] });
          onUploadSuccess?.(res.data.data);
        } else if (status === 'error') {
          clearInterval(iv);
          setFiles((p) => p.map((f) => (f.id === itemId ? { ...f, status: 'error', error: res.data.data.error || 'Analysis failed' } : f)));
        }
      } catch { clearInterval(iv); }
    }, 2000);
  };

  const ext = (fn) => fn.split('.').pop()?.toLowerCase();

  return (
    <div>
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${isDragActive ? 'border-brand bg-brand-light' : 'border-gray-300 bg-white'}`}>
        <input {...getInputProps()} />
        <Upload size={36} color="#e03e2d" className="mx-auto mb-3" />
        <p className="text-[15px] font-bold text-gray-900 mb-1">
          {isDragActive ? 'Drop your file here!' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[13px] text-gray-500 mb-3">Excel, CSV, PDF, Word, JSON · Max 50 MB</p>
      </div>

      {rejection && <div className="mt-3 text-xs text-red-600">{rejection}</div>}

      {files.some((f) => f.status === 'pending') && (
        <div className="mt-3 flex gap-2 items-center">
          <input className="wp-input max-w-xs" placeholder="Dataset name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-wp" onClick={() => files.filter((f) => f.status === 'pending').forEach(uploadFile)}>
            <Upload size={14} /> Upload All
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 wp-card">
          <div className="wp-card-header">Files ({files.length})</div>
          {files.map((item) => {
            const Icon = FILE_ICONS[ext(item.file.name)] || File;
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <Icon size={20} color="#e03e2d" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{item.file.name}</div>
                  <div className="text-[11px] text-gray-500">{fmtSize(item.file.size)}</div>
                  {['uploading', 'processing'].includes(item.status) && (
                    <div className="h-[3px] bg-gray-100 rounded mt-1.5 overflow-hidden">
                      <div className="h-full bg-brand transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.status === 'error' && <div className="text-[11px] text-red-600 mt-1">{item.error}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'pending' && <button className="btn-wp text-[11px] px-2.5 py-1" onClick={() => uploadFile(item)}>Upload</button>}
                  {item.status === 'processing' && <span className="text-[11px] text-amber-600">Analyzing…</span>}
                  {item.status === 'done' && <CheckCircle size={16} className="text-green-600" />}
                  {item.status === 'error' && <AlertCircle size={16} className="text-red-600" />}
                  <button className="text-gray-400 hover:text-gray-700" onClick={() => setFiles((p) => p.filter((f) => f.id !== item.id))}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
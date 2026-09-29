import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, ArrowRight, Zap, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { setPendingFile } from '../utils/pendingUpload';
import Logo from '../components/Logo';

const ACCEPTED = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
};

const STEPS = [
  { n: '01', title: 'Upload',    desc: 'Drop a CSV, Excel, or JSON file.' },
  { n: '02', title: 'Analyse',   desc: 'Python inspects every column.' },
  { n: '03', title: 'Visualise', desc: 'Charts and KPIs appear instantly.' },
  { n: '04', title: 'Export',    desc: 'Download PDF, Excel, or CSV.' },
];

function PreviewLine() {
  return (
    <svg viewBox="0 0 220 90" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="heroLine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e03e2d" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#e03e2d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 68 L25 52 L50 62 L75 34 L100 48 L125 26 L150 40 L175 22 L200 34 L220 14"
            fill="none" stroke="#e03e2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0 68 L25 52 L50 62 L75 34 L100 48 L125 26 L150 40 L175 22 L200 34 L220 14 L220 90 L0 90 Z"
            fill="url(#heroLine)" />
    </svg>
  );
}

function PreviewBars() {
  const bars = [38, 55, 42, 68, 50, 78, 62, 88, 70, 82, 55, 74];
  const highlight = 7;
  return (
    <svg viewBox="0 0 220 90" preserveAspectRatio="none" className="w-full h-full">
      {bars.map((h, i) => (
        <rect key={i} x={i * 18 + 6} y={90 - h} width="11" height={h} rx="2.5"
              fill={i === highlight ? '#e03e2d' : '#e5e7eb'} />
      ))}
    </svg>
  );
}

function PreviewDonut() {
  const cx = 50, cy = 50, r = 34, sw = 11;
  const circ = 2 * Math.PI * r;
  const segs = [
    { pct: 0.44, color: '#e03e2d' },
    { pct: 0.26, color: '#3b82f6' },
    { pct: 0.18, color: '#16a34a' },
    { pct: 0.12, color: '#f59e0b' },
  ];
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
      {segs.map((s, i) => {
        const dash = s.pct * circ;
        const offset = -acc * circ;
        acc += s.pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
                  strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        );
      })}
    </svg>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Where the user is right now — passed to Login/Register so their
  // back button and post-login redirect both return them here.
  const here = location.pathname || '/';

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return;
    const file = accepted[0];
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/public/analyse', fd, { timeout: 90000 });
      if (!res.data.success) throw new Error(res.data.message);
      setPendingFile(file);
      sessionStorage.setItem('analysisResult', JSON.stringify(res.data.result ?? res.data.data));
      sessionStorage.setItem('fileName', file.name);
      navigate('/result', { state: { from: here } });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [navigate, here]);

  const onDropRejected = useCallback((rejections) => {
    const r = rejections[0];
    setError(r.errors.map((e) => e.message).join(', '));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED,
    maxSize: 50 * 1024 * 1024,
  });

  return (
    <div className="min-h-screen bg-white flex flex-col antialiased">

      <section className="min-h-screen flex flex-col">
        <nav className="shrink-0 px-6 md:px-12 h-16 flex items-center justify-between">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            {user ? (
              <button
                className="btn-wp"
                onClick={() => navigate('/dashboard', { state: { from: here } })}
              >
                Dashboard <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-100"
                  onClick={() => navigate('/login', { state: { from: here } })}
                >
                  Log in
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand-dark shadow-sm"
                  onClick={() => navigate('/register', { state: { from: here } })}
                >
                  Sign up free
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-brand/[0.07] blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-[440px] h-[440px] rounded-full bg-blue-500/[0.05] blur-3xl" />
          </div>

          <div className="relative max-w-6xl mx-auto px-6 md:px-12 h-full flex items-center py-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">

              <div>
                <h1 className="text-[40px] md:text-[56px] lg:text-[60px] font-extrabold text-gray-900 leading-[1.04] tracking-tight mb-8">
                  Spreadsheet in.
                  <br />
                  <span className="bg-gradient-to-r from-brand to-[#f97316] bg-clip-text text-transparent">
                    Dashboard out.
                  </span>
                </h1>

                <div className="max-w-md">
                  <div
                    {...getRootProps({
                      role: 'button',
                      'aria-label': 'Upload a dataset file',
                    })}
                    className={`group rounded-2xl border-2 border-dashed p-6 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                      isDragActive
                        ? 'border-brand bg-brand-light scale-[1.02]'
                        : 'border-gray-300 bg-white hover:border-brand/50 hover:bg-gray-50'
                    }`}
                  >
                    <input {...getInputProps()} />
                    {uploading ? (
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl border-[3px] border-gray-200 border-t-brand animate-spin shrink-0" />
                        <div>
                          <p className="text-[15px] font-bold text-gray-900 m-0">Analysing…</p>
                          <p className="text-xs text-gray-500 m-0 mt-0.5">Usually under 3 seconds</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <Upload size={20} color="#fff" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[15px] font-bold text-gray-900 m-0 group-hover:text-brand transition-colors">
                            {isDragActive ? 'Drop your file here' : 'Select a file'}
                          </p>
                          <p className="text-xs text-gray-500 m-0 mt-0.5">
                            CSV · XLSX · JSON · 50 MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">
                      {error}
                    </div>
                  )}

                  <div className="mt-5 flex items-center gap-5 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Zap size={12} className="text-amber-500" /> Under 3 seconds
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp size={12} className="text-green-600" /> No signup needed
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="absolute -inset-8 bg-gradient-to-br from-brand/10 via-transparent to-blue-500/10 rounded-3xl blur-3xl" />

                <div className="relative bg-white rounded-2xl border border-gray-200 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.18)] p-5 space-y-4">
                  <div className="flex items-center gap-1.5 pb-3 border-b border-gray-100">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <span className="ml-3 text-[11px] font-medium text-gray-400">
                      datalyze · dashboard
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { l: 'Revenue', v: '$134K' },
                      { l: 'Profit',  v: '$40.7K' },
                      { l: 'Orders',  v: '1,000' },
                    ].map((k) => (
                      <div key={k.l} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-1">
                          {k.l}
                        </p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-none m-0">
                          {k.v}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-gray-100 bg-white p-3 col-span-2 flex flex-col">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-2">
                        Revenue trend
                      </p>
                      <div className="h-[72px]"><PreviewLine /></div>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-3 flex flex-col">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-2">
                        Split
                      </p>
                      <div className="h-[72px]"><PreviewDonut /></div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-white p-3 flex flex-col">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-2">
                      Top categories
                    </p>
                    <div className="h-[72px]"><PreviewBars /></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-gray-50/80 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
          <div className="mb-12">
            <p className="text-xs font-bold text-brand uppercase tracking-[0.18em] mb-3">
              How it works
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight tracking-tight m-0">
              From raw file to report — in four steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[11px] font-extrabold tracking-widest text-brand">
                    {s.n}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-brand/40 to-transparent" />
                </div>

                <h3 className="text-lg font-extrabold text-gray-900 m-0 mb-2 leading-tight">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed m-0">
                  {s.desc}
                </p>

                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-[26px] -right-3 text-gray-300">
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={22} />
          <p className="text-xs text-gray-400 m-0">
            © {new Date().getFullYear()} DataLyze
          </p>
          <div className="flex items-center gap-5 text-xs">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-900 font-medium"
            >
              Home
            </button>
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login', { state: { from: here } })}
              className="text-gray-500 hover:text-gray-900 font-medium"
            >
              Dashboard
            </button>
            {!user && (
              <button
                onClick={() => navigate('/register', { state: { from: here } })}
                className="text-gray-500 hover:text-gray-900 font-medium"
              >
                Sign up
              </button>
            )}
          </div>
        </div>
      </footer>

    </div>
  );
}
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleButton from '../components/GoogleButton';
import Logo from '../components/Logo';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/dashboard';

  // Prefer going back to where the user came from, fall back to "/"
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-5 relative">

      {/* Back button — top-left of the viewport */}
      <button
        onClick={handleBack}
        className="absolute top-5 left-5 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="mb-7">
        <Logo size={36} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-9 w-full max-w-md shadow-lg">
        <h1 className="text-[22px] font-extrabold text-gray-900 m-0 mb-1.5 text-center">
          Welcome back
        </h1>
        <p className="text-sm text-gray-500 m-0 mb-6 text-center">
          Log in to access your dashboards
        </p>

        <div className="mb-5">
          <GoogleButton
            label="Continue with Google"
            onSuccess={() => navigate(from, { replace: true })}
            onError={(msg) => setError(msg)}
          />
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-[13px] text-red-600 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3.5">
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="wp-input"
            />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="wp-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white rounded-lg text-[15px] font-bold disabled:opacity-60 hover:bg-brand-dark"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-[13px] text-gray-500 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand font-semibold no-underline">
            Sign up free
          </Link>
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-5">DataLyze · Free data analysis tool</p>
    </div>
  );
}
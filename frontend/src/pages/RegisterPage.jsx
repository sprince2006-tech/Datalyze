import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleButton from '../components/GoogleButton';
import Logo from '../components/Logo';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/dashboard';

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, type = 'text', placeholder = '') => (
    <div className="mb-3.5">
      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className="wp-input"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-5 relative">

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
          Create your account
        </h1>
        <p className="text-sm text-gray-500 m-0 mb-6 text-center">
          Free forever · No credit card needed
        </p>

        <div className="mb-5">
          <GoogleButton
            label="Sign up with Google"
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
          {field('Full name', 'name', 'text', 'Jane Smith')}
          {field('Email address', 'email', 'email', 'you@example.com')}
          {field('Password', 'password', 'password', '••••••••')}
          {field('Confirm password', 'confirm', 'password', '••••••••')}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white rounded-lg text-[15px] font-bold disabled:opacity-60 hover:bg-brand-dark mt-1.5"
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </button>
        </form>

        <p className="text-center text-[13px] text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand font-semibold no-underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
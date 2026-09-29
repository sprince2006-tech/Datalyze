import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoogleButton from '../GoogleButton';

export default function SignupModal({
  isOpen, onClose, onDownloadWithoutSignup,
  allowGuest = true,
  title = 'Continue',
  subtitle = 'Create a free account to save your dashboard, or continue without one.',
}) {
  const { register, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('choice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => { if (!isOpen) { setError(''); setMode('choice'); } }, [isOpen]);

  if (!isOpen) return null;

  const afterAuth = () => { onClose?.(); onDownloadWithoutSignup?.(); };

  const handleSignup = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await register(name, email, password); afterAuth(); }
    catch (err) { setError(err.response?.data?.message || 'Signup failed'); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await login(email, password); afterAuth(); }
    catch (err) { setError(err.response?.data?.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  const continueAnon = () => { afterAuth(); };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-5"
         onClick={loading ? undefined : onClose} role="dialog" aria-modal="true">
      <div ref={ref} onClick={(e) => e.stopPropagation()}
           className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-extrabold m-0">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" disabled={loading}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {mode === 'choice' && (
            <>
              <p className="text-[15px] text-gray-700 mb-5">{subtitle}</p>
              <div className="mb-4">
                <GoogleButton label="Continue with Google"
                              onSuccess={() => { onClose?.(); onDownloadWithoutSignup?.(); }}
                              onError={(msg) => setError(msg)} />
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-[13px] text-red-600 mb-4">{error}</div>}
              <button className="btn-wp w-full justify-center py-3.5 mb-3" onClick={() => setMode('signup')}>
                <UserPlus size={18} /> Sign Up with Email
              </button>
              <button className="w-full flex justify-center items-center gap-2 py-3.5 rounded-lg border border-gray-300 font-semibold text-gray-700 mb-5"
                      onClick={() => setMode('login')}>
                <LogIn size={18} /> Login
              </button>
              {allowGuest && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-gray-200" />
                    <div className="relative inline-block px-3 bg-white text-[13px] text-gray-400 left-1/2 -translate-x-1/2">OR</div>
                  </div>
                  <button className="w-full flex justify-center items-center gap-2 py-3.5 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                          onClick={continueAnon}>
                    <Download size={18} /> Continue without account
                  </button>
                </>
              )}
            </>
          )}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div><label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input className="wp-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
                <input className="wp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
                <input className="wp-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
              {error && <div className="text-[13px] text-red-600">{error}</div>}
              <button type="submit" className="btn-wp w-full justify-center py-3" disabled={loading}>{loading ? 'Creating…' : 'Sign Up & Continue'}</button>
              <button type="button" className="w-full text-sm text-gray-500" onClick={() => setMode('choice')}>← Back</button>
            </form>
          )}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
                <input className="wp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
                <input className="wp-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              {error && <div className="text-[13px] text-red-600">{error}</div>}
              <button type="submit" className="btn-wp w-full justify-center py-3" disabled={loading}>{loading ? 'Logging in…' : 'Login & Continue'}</button>
              <button type="button" className="w-full text-sm text-gray-500" onClick={() => setMode('choice')}>← Back</button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
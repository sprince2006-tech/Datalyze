import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleButton({ onSuccess, onError, label = 'Continue with Google' }) {
  const { loginWithGoogle } = useAuth();
  const btnRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response) => {
          if (!response?.credential) return;
          setLoading(true);
          try {
            const user = await loginWithGoogle(response.credential);
            onSuccess?.(user);
          } catch (err) {
            onError?.(err.response?.data?.message || 'Google sign-in failed');
          } finally {
            setLoading(false);
          }
        },
        auto_select: false,
      });
      setReady(true);
    };

    // Wait for the Google script to load
    if (window.google?.accounts?.id) init();
    else {
      const iv = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(iv);
          init();
        }
      }, 100);
      setTimeout(() => clearInterval(iv), 5000);
    }

    return () => { cancelled = true; };
  }, [loginWithGoogle, onSuccess, onError]);

  const handleClick = () => {
    if (!CLIENT_ID) {
      onError?.('Google Sign-In is not configured. Set VITE_GOOGLE_CLIENT_ID.');
      return;
    }
    if (!ready || !window.google?.accounts?.id) {
      onError?.('Google Sign-In is still loading, try again in a moment.');
      return;
    }
    window.google.accounts.id.prompt(); // shows One Tap / popup
    // Fallback: also try the popup flow
    try {
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline', size: 'large', type: 'standard', width: 320,
      });
    } catch (_) { /* ignore */ }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34 6.5 29.3 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.5-7.4l-6.6 5.1C9.8 39.7 16.4 44 24 44z"/>
          <path fill="#1565C0" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.7 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
        </svg>
        {loading ? 'Signing in…' : label}
      </button>
      {/* Hidden container used for the fallback renderButton */}
      <div ref={btnRef} style={{ display: 'none' }} />
    </>
  );
}
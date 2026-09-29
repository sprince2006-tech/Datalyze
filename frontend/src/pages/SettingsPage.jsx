import { useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../utils/format';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (trimmed.length > 100) { setError('Name too long'); return; }

    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await api.patch('/auth/me', { name: trimmed });
      updateUser(res.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-up max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 m-0">Settings</h1>
        <p className="text-[13px] text-gray-500 m-0">Manage your account</p>
      </div>

      {saved && <div className="notice notice-success mb-4">Settings saved.</div>}

      <div className="wp-card mb-4">
        <div className="wp-card-header">Profile Information</div>
        <form onSubmit={handleSave} className="p-5">
          <div className="mb-3.5">
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              className="wp-input max-w-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              className="wp-input max-w-sm bg-gray-50"
              type="email"
              value={user?.email || ''}
              readOnly
            />
            <p className="text-[11px] text-gray-400 mt-1">Email cannot be changed.</p>
          </div>

          {error && <div className="text-[13px] text-red-600 mb-3">{error}</div>}

          <button type="submit" className="btn-wp" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="wp-card">
        <div className="wp-card-header">Account Details</div>
        <div className="p-4">
          {[
            ['Role', user?.role || '—'],
            ['User ID', user?._id || '—'],
            ['Joined', fmtDate(user?.createdAt)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-[13px]"
            >
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-900 break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
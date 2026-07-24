import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { authApi } from '../services/api';
import { getErrorMessage } from '../hooks/useToastHelper';

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirm) { toast('Passwords do not match', 'error'); return; }
    if (newPass.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: newPass });
      toast('Password changed successfully', 'success');
      setCurrent(''); setNewPass(''); setConfirm('');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-accent mb-6">My Profile</h1>
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
            {user?.full_name?.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-accent">{user?.full_name}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            <div className="text-xs text-primary mt-1 font-medium">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-accent mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={current} onChange={e => setCurrent(e.target.value)} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={newPass} onChange={e => setNewPass(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

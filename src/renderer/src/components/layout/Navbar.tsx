import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../ui/NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  async function handleLogout() {
    setConfirmLogout(false);
    await logout();
    navigate('/login');
  }

  return (
    <>
      <header className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between no-print flex-shrink-0">
        <div className="text-sm text-muted-foreground">
          OPTIMA CLAYS LTD · Business Management System
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-xs">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block">
              <div className="font-medium text-accent text-xs">{user?.full_name}</div>
              <div className="text-muted-foreground text-xs">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
          </div>
          <NotificationBell />
          <Link to="/settings" title="Settings" className="p-1.5 hover:bg-background rounded-lg transition-colors text-muted-foreground hover:text-accent">
            <Settings size={16} />
          </Link>
          <button
            onClick={() => setConfirmLogout(true)}
            title="Sign out"
            className="p-1.5 hover:bg-background rounded-lg transition-colors text-muted-foreground hover:text-danger"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Logout confirmation overlay */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-surface rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-danger/10 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div>
                <h3 className="font-semibold text-accent">Sign Out</h3>
                <p className="text-sm text-gray-500">Are you sure you want to sign out?</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmLogout(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleLogout} className="bg-danger text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

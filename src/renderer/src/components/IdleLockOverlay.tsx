import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../hooks/useToastHelper';
import { hasBeenIdleTooLong, IDLE_CHECK_INTERVAL_MS } from '../lib/idleLock';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// Sits on top of the whole app (higher than any modal) once someone's been
// idle for a while, rather than logging them out - their open forms and
// unsaved work stay exactly as they left them underneath, and re-entering
// the password just dismisses the overlay again instead of navigating away.
export default function IdleLockOverlay() {
  const { user, login } = useAuth();
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    function markActive() {
      lastActivityRef.current = Date.now();
    }
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      if (hasBeenIdleTooLong(lastActivityRef.current, Date.now())) {
        setLocked(true);
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (locked) passwordInputRef.current?.focus();
  }, [locked]);

  if (!user || !locked) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      await login(user.email, password);
      lastActivityRef.current = Date.now();
      setLocked(false);
      setPassword('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/95 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="text-accent" size={24} />
        </div>
        <h1 className="font-semibold text-accent text-lg mb-1">Session locked</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You've been away a while. Enter your password to continue as {user.full_name}.
        </p>
        <form onSubmit={handleUnlock} className="space-y-3 text-left">
          <input
            ref={passwordInputRef}
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}

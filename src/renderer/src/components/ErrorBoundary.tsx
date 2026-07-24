import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any uncaught render error (a bad date format, a null
// reference, anything) unmounts the whole React tree and leaves a blank
// white window with no way back short of restarting the app.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-danger" size={26} />
          </div>
          <h1 className="font-semibold text-accent text-lg mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This page ran into a problem and couldn't continue. Your data is safe - reloading will take you back to a working screen.
          </p>
          <button className="btn-primary w-full" onClick={() => window.location.reload()}>
            Reload
          </button>
          <p className="text-xs text-muted-foreground mt-4 font-mono break-words">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}

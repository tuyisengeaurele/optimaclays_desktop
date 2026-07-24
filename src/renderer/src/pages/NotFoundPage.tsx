import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <AlertCircle size={64} className="text-primary/40" />
        </div>
        <h1 className="text-6xl font-bold text-accent mb-2">404</h1>
        <h2 className="text-xl font-semibold text-accent mb-3">Page Not Found</h2>
        <p className="text-gray-500 mb-6">The page you're looking for doesn't exist or you don't have permission to view it.</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <Home size={16} /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTransitionPresence } from '../../hooks/useTransitionPresence';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export default function ConfirmDialog({ open, onConfirm, onCancel, title, message }: Props) {
  const { shouldRender, visible } = useTransitionPresence(open);
  if (!shouldRender) return null;
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className={`relative bg-surface rounded-xl shadow-xl max-w-sm w-full p-6 transition-all duration-200 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={22} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-accent">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-outline">Cancel</button>
          <button onClick={onConfirm} className="bg-danger text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors active:scale-95">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

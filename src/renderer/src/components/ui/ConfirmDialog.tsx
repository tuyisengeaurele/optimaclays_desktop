import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export default function ConfirmDialog({ open, onConfirm, onCancel, title, message }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            className="relative bg-surface rounded-xl shadow-xl max-w-sm w-full p-6"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

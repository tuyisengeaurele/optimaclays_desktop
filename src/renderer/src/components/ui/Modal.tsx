import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export default function Modal({ open, isOpen, onClose, title, children, size = 'md' }: Props) {
  const show = !!(open ?? isOpen);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative bg-surface rounded-xl shadow-xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-accent">{title}</h2>
              <button onClick={onClose} className="p-1 hover:bg-background rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

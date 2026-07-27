import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar stays fixed height, never scrolls with page. overflow-visible so the floating toggle button isn't clipped */}
      <div className="flex-shrink-0 h-screen sticky top-0 overflow-visible">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

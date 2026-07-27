import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar stays fixed height, never scrolls with page. overflow-visible so the floating toggle button isn't clipped */}
      <div className="flex-shrink-0 h-screen sticky top-0 overflow-visible">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div
            key={location.pathname}
            className={`transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

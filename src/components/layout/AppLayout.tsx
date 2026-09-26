import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { MobileNav } from './MobileNav';

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  // Messages is a full-width surface: drop the right widget column for it.
  const hideRightSidebar = pathname.startsWith('/app/messages');
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 lg:pb-12 flex gap-8">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Dynamic Center Page Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Right Sidebar (Widget Area) */}
        {!hideRightSidebar && <RightSidebar />}
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
};

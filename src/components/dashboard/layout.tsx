'use client';

import { ReactNode } from 'react';
import { DashboardSidebar } from './sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function DashboardLayout({ children, showSidebar = true }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showSidebar && <DashboardSidebar />}
      {/* Main content */}
      <main className={showSidebar ? 'md:ml-64 min-h-screen' : 'min-h-screen'}>
        {children}
      </main>
    </div>
  );
}

'use client';

import { ReactNode } from 'react';
import { DashboardSidebar } from './sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      {/* Main content */}
      <main className="md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

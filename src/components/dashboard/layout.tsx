'use client';

import { ReactNode, useEffect } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'dark');
    html.classList.add('dark');

    return () => {
      if (prevTheme) {
        html.setAttribute('data-theme', prevTheme);
        html.classList.toggle('dark', prevTheme !== 'light');
      } else {
        html.removeAttribute('data-theme');
        html.classList.remove('dark');
      }
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#06060a' }}>
      <main className="min-h-screen">
        {children}
      </main>
    </div>
  );
}

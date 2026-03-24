'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </SessionProvider>
  );
}

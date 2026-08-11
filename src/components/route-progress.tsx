'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const show = setTimeout(() => {
      if (!cancelled) setVisible(true);
    }, 0);
    const hide = setTimeout(() => {
      if (!cancelled) setVisible(false);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden">
      <div className="h-full bg-primary animate-[route-progress_0.4s_ease-out]" style={{ width: '100%' }} />
      <style>{`
        @keyframes route-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
'use client';

import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { MediaContent } from '@/components/media/content';
import { Zap } from 'lucide-react';

export default function DashboardAnimePage() {
  return (
    <DashboardLayout>
      <MediaContent 
        type="anime" 
        title="Anime" 
        icon="Zap" 
      />
    </DashboardLayout>
  );
}

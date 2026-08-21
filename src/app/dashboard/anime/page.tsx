'use client';

import { DashboardLayout } from '@/components/dashboard/layout';
import { MediaContent } from '@/components/media/content';

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

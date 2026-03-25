import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { MediaContent } from '@/components/media/content';

export default async function DashboardTVPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout>
      <MediaContent type="tv" title="TV Shows" icon="Tv" />
    </DashboardLayout>
  );
}
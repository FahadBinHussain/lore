import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { WatchLaterContent } from '@/components/dashboard/watch-later-content';

export const metadata = {
  title: 'Watch Later • Lore',
  description: 'Your saved media items to watch, read, and play next.',
};

export default async function WatchLaterPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout>
      <WatchLaterContent />
    </DashboardLayout>
  );
}

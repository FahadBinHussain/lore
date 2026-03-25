import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { MediaContent } from '@/components/media/content';

export default async function DashboardMoviesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout user={session.user}>
      <MediaContent type="movie" title="Movies" icon="Film" />
    </DashboardLayout>
  );
}
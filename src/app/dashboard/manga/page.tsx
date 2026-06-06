import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { MediaContent } from '@/components/media/content';

export default async function MangaDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout>
      <MediaContent type="manga" title="Manga" icon="BookCopy" />
    </DashboardLayout>
  );
}

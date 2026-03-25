import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { MediaContent } from '@/components/media/content';

export default async function BoardGamesDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout>
      <MediaContent type="boardgame" title="Board Games" icon="Dice6" />
    </DashboardLayout>
  );
}
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { DashboardContent } from '@/components/dashboard/content';

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout user={session.user}>
      <DashboardContent />
    </DashboardLayout>
  );
}

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { SearchContent } from '@/components/search/content';

export default async function SearchPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout>
      <SearchContent />
    </DashboardLayout>
  );
}

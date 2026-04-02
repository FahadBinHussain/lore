import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { CreateUniverseForm } from '@/components/universes/create-form';
import { isAdminRole } from '@/lib/auth/roles';

export default async function CreateUniversePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Check if user is admin
  if (!isAdminRole(session.user.role)) {
    redirect('/dashboard');
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create Universe</h1>
          <p className="text-muted-foreground mt-2">
            Create a new universe collection of media items
          </p>
        </div>

        <CreateUniverseForm />
      </div>
    </DashboardLayout>
  );
}

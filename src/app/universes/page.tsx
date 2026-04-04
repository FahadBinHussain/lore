import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UniversesContent } from '@/components/universes/content';
import { db } from '@/db';
import { collectionItems, collections, userMediaProgress, users } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export default async function UniversesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  let userId = Number.parseInt(session.user.id || '', 10);
  if (!Number.isFinite(userId) && session.user.email) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
      columns: { id: true },
    });
    if (dbUser) {
      userId = dbUser.id;
    }
  }

  const allCollections = await db.query.collections.findMany({
    where: eq(collections.visibility, 'public'),
    orderBy: desc(collections.createdAt),
    with: {
      items: {
        with: {
          mediaItem: true,
        },
        orderBy: collectionItems.releaseOrder,
      },
      creator: {
        columns: {
          name: true,
          image: true,
        },
      },
    },
  });

  const mediaItemIds = Array.from(new Set(allCollections.flatMap((collection) => collection.items.map((item) => item.mediaItem.id))));

  const progressRows =
    Number.isFinite(userId) && mediaItemIds.length > 0
      ? await db.query.userMediaProgress.findMany({
          where: and(eq(userMediaProgress.userId, userId), inArray(userMediaProgress.mediaItemId, mediaItemIds)),
          columns: {
            mediaItemId: true,
            status: true,
          },
        })
      : [];

  const watchedIds = new Set(progressRows.filter((row) => row.status !== 'not_started').map((row) => row.mediaItemId));

  const collectionsWithProgress = allCollections.map((collection) => {
    const itemsTotal = collection.items.length;
    const itemsCompleted = collection.items.reduce((count, item) => (watchedIds.has(item.mediaItem.id) ? count + 1 : count), 0);
    const progress = itemsTotal > 0 ? Math.round((itemsCompleted / itemsTotal) * 100) : 0;

    return {
      ...collection,
      itemsTotal,
      itemsCompleted,
      progress,
    };
  });

  const serializedCollections = JSON.parse(JSON.stringify(collectionsWithProgress));

  return <UniversesContent initialUniverses={serializedCollections} />;
}

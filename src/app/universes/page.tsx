import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UniversesContent } from '@/components/universes/content';
import { db } from '@/db';
import { collectionItems, collections, userMediaProgress, users } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { isAdminRole } from '@/lib/auth/roles';

function isTrackableMediaItem(mediaItem: { source: string | null; isPlaceholder?: boolean | null }) {
  return mediaItem.source !== 'manual' && !mediaItem.isPlaceholder;
}

export default async function UniversesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }
  const viewerIsAdmin = isAdminRole(session.user.role);

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

  const mediaItemIds = Array.from(
    new Set(
      allCollections.flatMap((collection) =>
        collection.items
          .map((item) => item.mediaItem)
          .filter((mediaItem) => isTrackableMediaItem(mediaItem))
          .map((mediaItem) => mediaItem.id)
      )
    )
  );

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
    const trackableItems = collection.items.filter((item) => isTrackableMediaItem(item.mediaItem));
    const itemsTotal = trackableItems.length;
    const itemsCompleted = trackableItems.reduce(
      (count, item) => (watchedIds.has(item.mediaItem.id) ? count + 1 : count),
      0
    );
    const progress = itemsTotal > 0 ? Math.round((itemsCompleted / itemsTotal) * 100) : 0;
    const totalItems = collection.items.length;
    const untrackableCount = Math.max(0, totalItems - itemsTotal);

    return {
      ...collection,
      itemsTotal,
      itemsCompleted,
      progress,
      totalItems,
      untrackableCount,
      canDelete: viewerIsAdmin,
    };
  });

  const serializedCollections = JSON.parse(JSON.stringify(collectionsWithProgress));

  return (
    <UniversesContent
      initialUniverses={serializedCollections}
      initialCanCreateUniverse={viewerIsAdmin}
    />
  );
}

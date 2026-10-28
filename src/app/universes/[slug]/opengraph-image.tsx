import { ImageResponse } from 'next/og';
import { db } from '@/db';
import { collections, collectionItems } from '@/db/schema';
import { and, eq, or } from 'drizzle-orm';

export const runtime = 'nodejs';
export const alt = 'Universe Timeline — Lore';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function UniverseOGImage({ params }: Props) {
  const { slug } = await params;
  const maybeId = parseInt(slug, 10);

  let universeName = 'Universe Timeline';
  let universeDescription = 'Explore complete franchise timelines and chronological watch orders.';
  let itemCount = 0;
  let bgImage: string | null = null;
  let mediaTypes: string[] = [];

  try {
    const universe = await db.query.collections.findFirst({
      where: and(
        eq(collections.visibility, 'public'),
        Number.isNaN(maybeId) ? eq(collections.slug, slug) : or(eq(collections.slug, slug), eq(collections.id, maybeId))
      ),
      with: {
        items: {
          orderBy: collectionItems.releaseOrder,
          with: { mediaItem: true },
        },
      },
    });

    if (universe) {
      universeName = universe.name;
      if (universe.description) {
        universeDescription = universe.description;
      }
      itemCount = universe.items.length;

      // Extract types
      const types = new Set<string>();
      for (const item of universe.items) {
        if (item.mediaItem?.mediaType) {
          types.add(item.mediaItem.mediaType.toUpperCase());
        }
      }
      mediaTypes = Array.from(types).slice(0, 4);

      // Extract background image
      if (universe.bannerImage && universe.bannerImage.startsWith('http')) {
        bgImage = universe.bannerImage;
      } else if (universe.coverImage && universe.coverImage.startsWith('http')) {
        bgImage = universe.coverImage;
      } else {
        const itemWithBackdrop = universe.items.find((i) => i.mediaItem?.backdropPath);
        if (itemWithBackdrop?.mediaItem?.backdropPath) {
          const bp = itemWithBackdrop.mediaItem.backdropPath;
          bgImage = bp.startsWith('http') ? bp : `https://image.tmdb.org/t/p/w780${bp}`;
        } else {
          const itemWithPoster = universe.items.find((i) => i.mediaItem?.posterPath);
          if (itemWithPoster?.mediaItem?.posterPath) {
            const pp = itemWithPoster.mediaItem.posterPath;
            bgImage = pp.startsWith('http') ? pp : `https://image.tmdb.org/t/p/w500${pp}`;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error generating universe OG image:', error);
  }

  // Truncate description for card display
  const cleanDescription =
    universeDescription.length > 180 ? universeDescription.slice(0, 177) + '...' : universeDescription;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 68px',
          backgroundColor: '#090a10',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {/* Background poster/backdrop with gradient dark overlay */}
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.18,
            }}
          />
        )}

        {/* Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(9, 10, 16, 0.94) 0%, rgba(9, 10, 16, 0.85) 50%, rgba(15, 23, 42, 0.95) 100%)',
          }}
        />

        {/* Subtle decorative outer line */}
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            pointerEvents: 'none',
          }}
        />

        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '13px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '3px solid #ffffff',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Lore</span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.55)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 600,
                }}
              >
                Franchise & Universe Timelines
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: 500,
            }}
          >
            univrs.vercel.app
          </div>
        </div>

        {/* Center: Main Universe Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxWidth: '1020px',
            position: 'relative',
            zIndex: 1,
            marginTop: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              Universe Timeline
            </span>

            {itemCount > 0 && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#93c5fd',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}
              >
                {itemCount} Tracked Entries
              </span>
            )}
          </div>

          <h1
            style={{
              fontSize: universeName.length > 30 ? '54px' : '64px',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              margin: 0,
              background: 'linear-gradient(180deg, #ffffff 30%, rgba(255, 255, 255, 0.75) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {universeName}
          </h1>

          <p
            style={{
              fontSize: '20px',
              lineHeight: 1.45,
              color: 'rgba(255, 255, 255, 0.72)',
              margin: 0,
              maxWidth: '920px',
            }}
          >
            {cleanDescription}
          </p>
        </div>

        {/* Bottom Bar: Timeline features and pill indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 1,
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {mediaTypes.length > 0 ? (
              mediaTypes.map((type) => (
                <span
                  key={type}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: 'rgba(255, 255, 255, 0.6)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {type}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Release Order • Chronological Order • Spin-offs
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              color: '#818cf8',
              fontWeight: 600,
            }}
          >
            <span>Complete Order & Progress</span>
            <span style={{ fontSize: '16px' }}>→</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

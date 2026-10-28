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
  let posterImage: string | null = null;
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

      // Extract poster image
      if (universe.coverImage && universe.coverImage.startsWith('http')) {
        posterImage = universe.coverImage;
      } else {
        const itemWithPoster = universe.items.find((i) => i.mediaItem?.posterPath);
        if (itemWithPoster?.mediaItem?.posterPath) {
          const pp = itemWithPoster.mediaItem.posterPath;
          posterImage = pp.startsWith('http') ? pp : `https://image.tmdb.org/t/p/w342${pp}`;
        }
      }
    }
  } catch (error) {
    console.error('Error generating universe OG image:', error);
  }

  // Truncate description for card display
  const cleanDescription =
    universeDescription.length > 150 ? universeDescription.slice(0, 147) + '...' : universeDescription;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '54px 64px',
          backgroundColor: '#090a10',
          backgroundImage:
            'radial-gradient(circle at 85% 15%, rgba(99, 102, 241, 0.2) 0%, transparent 50%), radial-gradient(circle at 15% 85%, rgba(168, 85, 247, 0.18) 0%, transparent 45%)',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
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

        {/* Left Column: Details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            flex: 1,
            paddingRight: posterImage ? '40px' : '0px',
          }}
        >
          {/* Top Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '3px solid #ffffff',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Lore</span>
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

          {/* Main Universe Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '720px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#a855f7',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                }}
              >
                Universe Timeline
              </span>

              {itemCount > 0 && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#93c5fd',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    padding: '5px 12px',
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
                fontSize: universeName.length > 28 ? '46px' : '56px',
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                margin: 0,
                color: '#ffffff',
              }}
            >
              {universeName}
            </h1>

            <p
              style={{
                fontSize: '18px',
                lineHeight: 1.45,
                color: 'rgba(255, 255, 255, 0.72)',
                margin: 0,
              }}
            >
              {cleanDescription}
            </p>
          </div>

          {/* Bottom Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {mediaTypes.length > 0 ? (
                mediaTypes.map((type) => (
                  <span
                    key={type}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'rgba(255, 255, 255, 0.6)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {type}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Chronological Order & Progress
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.65)',
                fontWeight: 500,
              }}
            >
              univrs.vercel.app
            </span>
          </div>
        </div>

        {/* Right Column: Framed Poster */}
        {posterImage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '280px',
              height: '100%',
              flexShrink: 0,
            }}
          >
            <img
              src={posterImage}
              alt=""
              style={{
                width: '260px',
                height: '390px',
                objectFit: 'cover',
                borderRadius: '16px',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            />
          </div>
        )}
      </div>
    ),
    {
      ...size,
    }
  );
}

import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Lore — Media & Universe Tracker';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#090a10',
          backgroundImage:
            'radial-gradient(circle at 85% 15%, rgba(99, 102, 241, 0.22) 0%, transparent 50%), radial-gradient(circle at 15% 85%, rgba(168, 85, 247, 0.18) 0%, transparent 45%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Subtle decorative border frame */}
        <div
          style={{
            position: 'absolute',
            inset: '24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            pointerEvents: 'none',
          }}
        />

        {/* Top Header: Badge & Domain */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '3px solid #ffffff',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Lore</span>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Media & Universe Tracker</span>
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

        {/* Center: Main Headline & Synopsis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '980px', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#818cf8',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              The Multiverse Awaits
            </span>
          </div>

          <h1
            style={{
              fontSize: '56px',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              margin: 0,
              background: 'linear-gradient(180deg, #ffffff 30%, rgba(255, 255, 255, 0.75) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Track your media universe across every interconnected franchise.
          </h1>

          <p
            style={{
              fontSize: '20px',
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.65)',
              margin: 0,
              maxWidth: '860px',
            }}
          >
            Movies, TV series, anime, games, comics, and soundtracks in exact release and chronological order — with your personal progress marked along the way.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {[
            '🌌 49+ Curated Universes',
            '⚡ Mixed Chronological Timelines',
            '🎬 Multi-Format Cross Tracking',
            '📌 Watch Later Queue',
            '🎨 Artist & Artwork Explorer',
          ].map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.85)',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

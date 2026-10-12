'use client';

import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  const handleGoogleSignIn = () => {
    const callbackUrl = `${window.location.origin}/dashboard`;
    signIn('google', { callbackUrl });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-background">
      <main className="flex-grow flex items-center justify-center px-6 py-16 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 40%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 70%)',
          }}
        />

        <div className="relative w-full max-w-md z-10">
          <div className="rounded-3xl p-8 sm:p-12 flex flex-col items-center text-center glass-panel shadow-2xl shadow-black/10">
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="Lore logo"
                width={48}
                height={48}
                className="w-12 h-12 mx-auto rounded-xl object-contain bg-transparent mb-6"
              />
              <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 text-base-content">
                Sign in to Lore
              </h1>
              <p className="text-base-content/70 text-base max-w-[300px] mx-auto leading-relaxed">
                Access your media library and pick up where you left off.
              </p>
            </div>

            <div className="w-full space-y-4">
              <button
                onClick={handleGoogleSignIn}
                className="group relative w-full flex items-center justify-center gap-3 bg-base-200 hover:bg-base-300 text-base-content font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 border border-base-content/15 shadow-sm active:scale-[0.98]"
              >
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            <p className="mt-8 text-sm text-base-content/70">
              Movies, TV shows, anime, games, books, and more in one place.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

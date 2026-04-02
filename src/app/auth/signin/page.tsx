'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="min-h-screen flex flex-col selection:bg-primary selection:text-on-primary overflow-hidden bg-[#020205] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-6 relative">
        {/* Ambient Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-primary/10 rounded-full blur-[160px] pointer-events-none opacity-40"></div>
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-secondary/5 rounded-full blur-[140px] pointer-events-none"></div>

        {/* Sign In Card */}
        <div className="relative w-full max-w-md z-10">
          <div className="surface-container rounded-2xl p-10 lg:p-14 flex flex-col items-center text-center shadow-[0_32px_64px_rgba(0,0,0,0.6)] border border-outline-variant/10 glass-panel">
            {/* Branding Section */}
            <div className="mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-8">
                <img
                  src="/logo.png?v=3"
                  alt="Lore logo"
                  className="w-10 h-10 rounded-xl object-contain bg-transparent"
                />
              </div>
              <h1 className="font-headline text-4xl font-bold tracking-tight text-gradient mb-4">
                Sign In
              </h1>
              <p className="font-body text-on-surface-variant text-base max-w-[280px] mx-auto leading-relaxed">
                Access your universal media library and continue your tracking journey.
              </p>
            </div>

            {/* Primary Action Container */}
            <div className="w-full space-y-4">
              <button
                onClick={handleGoogleSignIn}
                className="group relative w-full flex items-center justify-center gap-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface font-semibold py-4 px-6 rounded-xl transition-all duration-300 border border-outline-variant/15 active:scale-[0.98] shadow-lg"
              >
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
                <span className="tracking-wide">Continue with Google</span>
              </button>
            </div>

            {/* Footer Section */}
            <div className="mt-12 flex flex-col items-center gap-6">
              <div className="text-[10px] font-label tracking-[0.3em] uppercase text-outline/60">
                Universal Archiving Since 2026
              </div>
              {/* Media Type Badges */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 opacity-30 text-[9px] uppercase tracking-widest font-bold">
                <span>Movies</span>
                <span>TV Shows</span>
                <span>Games</span>
                <span>Books</span>
              </div>
            </div>
          </div>

          {/* Contextual Branding */}
          <div className="mt-10 flex justify-center items-center gap-4 px-4">
            <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent via-outline-variant to-transparent"></div>
            <div className="font-label text-[10px] tracking-[0.25em] uppercase text-outline whitespace-nowrap">The Midnight Archivist</div>
            <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent via-outline-variant to-transparent"></div>
          </div>
        </div>
      </main>

      {/* Visual Background */}
      <div className="fixed inset-0 -z-20 bg-[#020205]"></div>
      <div className="fixed inset-0 -z-10 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(167,164,255,0.05)_0%,rgba(0,0,0,0)_100%)]"></div>
      </div>

      {/* Background Hero */}
      <div className="fixed inset-0 -z-20 opacity-[0.03] grayscale mix-blend-screen pointer-events-none">
        <img 
          alt="Cinema and media textures" 
          className="w-full h-full object-cover" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMWfdhly0B7AgoKAtIU_FnqOlJvfW0w7Z6jJnLeYS_KU3YOZLOEjngmPvd7n-0uK2PRIVTJRIV9nIxBeXJAUSDlywT3Xpp4wIPdUfQJqZIVW6KszgHw8mJHo6fPYIhlXjsaMub89jyjl2wmYde1B2A4IXG0cJr8LF39j1KEtwCfdpDg46tZoM6e-QPripA3VkBbb1cfBquW0mmY6ExLoNGdckoN3lXbQ58m1nr8JYrLl_T1QClMowcJt_yh2Xx_d2A37BAqDpA8B2u" 
        />
      </div>
    </div>
  );
}


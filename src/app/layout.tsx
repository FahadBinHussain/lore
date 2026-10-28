import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Epilogue, Italianno, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { ScrollNavigationTracker } from "@/components/scroll-navigation-tracker";
import { PageTransition } from "@/components/page-transition";
import { RouteProgress } from "@/components/route-progress";
import { SiteFooter } from "@/components/site-footer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://univrs.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Lore — Media & Universe Tracker",
    template: "%s | Lore",
  },
  description: "Track movies, TV shows, anime, games, books, comics, and soundtracks across interconnected universes in release and chronological order.",
  applicationName: "Lore",
  keywords: [
    "media tracker",
    "universe tracker",
    "chronological watch order",
    "movie tracker",
    "tv tracking",
    "anime tracker",
    "franchise timeline",
    "mcu watch order",
    "star wars timeline"
  ],
  authors: [{ name: "Lore" }],
  creator: "Lore",
  publisher: "Lore",
  icons: {
    icon: "/logo.png?v=3",
    shortcut: "/logo.png?v=3",
    apple: "/logo.png?v=3",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Lore",
    title: "Lore — Media & Universe Tracker",
    description: "Track movies, TV shows, anime, games, books, comics, and soundtracks across interconnected universes in release and chronological order.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Lore — Media & Universe Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lore — Media & Universe Tracker",
    description: "Track movies, TV shows, anime, games, books, comics, and soundtracks across interconnected universes in release and chronological order.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const epilogue = Epilogue({
  variable: "--font-epilogue",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const italianno = Italianno({
  variable: "--font-italianno",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} ${epilogue.variable} ${manrope.variable} ${italianno.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background pt-16">
        <Providers>
          <Suspense fallback={null}>
            <ScrollNavigationTracker />
          </Suspense>
          <Navbar />
          <RouteProgress />
          <PageTransition>{children}</PageTransition>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}


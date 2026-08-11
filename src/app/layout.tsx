import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Epilogue, Italianno, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { ScrollNavigationTracker } from "@/components/scroll-navigation-tracker";
import { PageTransition } from "@/components/page-transition";
import { RouteProgress } from "@/components/route-progress";

export const metadata: Metadata = {
  title: "Lore - Media Tracker",
  description: "Track movies, TV shows, games, and books across interconnected universes",
  icons: {
    icon: "/logo.png?v=3",
    shortcut: "/logo.png?v=3",
    apple: "/logo.png?v=3",
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
  weight: ["400", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
        </Providers>
      </body>
    </html>
  );
}


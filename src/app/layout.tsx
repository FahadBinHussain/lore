import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Epilogue, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { ScrollNavigationTracker } from "@/components/scroll-navigation-tracker";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} ${epilogue.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Italianno&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <style>{`
          .font-script {
            font-family: 'Italianno', cursive;
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col bg-background pt-16">
        <Providers>
          <Suspense fallback={null}>
            <ScrollNavigationTracker />
          </Suspense>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}


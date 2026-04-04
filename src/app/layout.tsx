import type { Metadata } from "next";
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
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} ${epilogue.variable} ${manrope.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var themes=["light","dark","cupcake","bumblebee","emerald","corporate","synthwave","retro","cyberpunk","valentine","halloween","garden","forest","aqua","lofi","pastel","fantasy","wireframe","black","luxury","dracula","cmyk","autumn","business","acid","lemonade","night","coffee","winter","dim","nord","sunset","caramellatte","abyss","silk"];var darkThemes=["dark","synthwave","halloween","forest","black","luxury","dracula","business","night","coffee","dim","sunset","abyss"];var saved=localStorage.getItem("theme");var theme=themes.indexOf(saved||"")>-1?saved:"light";document.documentElement.setAttribute("data-theme",theme);document.documentElement.classList.toggle("dark",darkThemes.indexOf(theme)>-1);}catch(e){}})();`,
          }}
        />
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
          <ScrollNavigationTracker />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}


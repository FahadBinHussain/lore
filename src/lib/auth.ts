import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

function getPreferredAuthBaseUrl(baseUrl: string): string {
  const explicitAuthUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (explicitAuthUrl) {
    return explicitAuthUrl;
  }

  const vercelProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProjectProductionUrl) {
    return `https://${vercelProjectProductionUrl}`;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return baseUrl;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const preferredBaseUrl = getPreferredAuthBaseUrl(baseUrl).replace(/\/$/, '');

      if (url.startsWith('/')) {
        return `${preferredBaseUrl}${url}`;
      }

      try {
        const parsedUrl = new URL(url);
        const parsedBaseUrl = new URL(preferredBaseUrl);

        if (parsedUrl.origin === parsedBaseUrl.origin) {
          return url;
        }
      } catch {
        return `${preferredBaseUrl}/dashboard`;
      }

      return `${preferredBaseUrl}/dashboard`;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, session.user.email),
        });
        
        if (dbUser) {
          session.user.id = dbUser.id.toString();
          session.user.role = dbUser.role;
          session.user.username = dbUser.username;
          // Use database image if available, otherwise use token picture
          session.user.image = dbUser.image || token.picture || session.user.image;
        } else {
          // If no db user, use token picture
          session.user.image = token.picture || session.user.image;
        }
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user && account) {
        token.id = user.id;
        // Preserve image from Google profile
        if (account.provider === 'google') {
          // Google profile picture can be in different places
          token.picture = profile?.picture || profile?.image || user.image;
        }
      }
      // Ensure picture persists in token
      if (!token.picture && user?.image) {
        token.picture = user.image;
      }
      return token;
    },
    async signIn({ user, account }) {
      try {
        if (account?.provider === 'google' && user.email) {
          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, user.email),
          });

          if (!existingUser) {
            await db.insert(users).values({
              email: user.email,
              name: user.name || null,
              image: user.image || null,
              role: 'user',
              emailVerified: new Date(),
            });
          } else {
            await db.update(users)
              .set({ 
                lastLoginAt: new Date(),
                name: user.name || existingUser.name,
                image: user.image || existingUser.image,
              })
              .where(eq(users.email, user.email));
          }
        }
        return true;
      } catch (error) {
        console.error('SignIn error:', error);
        return true;
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
});

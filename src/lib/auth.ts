import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeUserRole } from '@/lib/auth/roles';

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

function normalizeImageValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

async function findAuthUserByEmail(email: string) {
  try {
    return await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        role: true,
        username: true,
        image: true,
      },
    });
  } catch {
    return null;
  }
}

async function findUserImageByEmail(email: string): Promise<string | null> {
  try {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { image: true },
    });
    return normalizeImageValue(dbUser?.image);
  } catch {
    return null;
  }
}

async function backfillUserImage(userId: number, image: string): Promise<void> {
  try {
    await db.update(users)
      .set({ image })
      .where(eq(users.id, userId));
  } catch {
    // Non-blocking best-effort write.
  }
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
      const tokenPicture = normalizeImageValue(token.picture);

      if (session.user) {
        session.user.role = normalizeUserRole(token.role);
      }

      if (session.user?.email) {
        const dbUser = await findAuthUserByEmail(session.user.email);

        if (dbUser) {
          session.user.id = dbUser.id.toString();
          session.user.role = normalizeUserRole(dbUser.role);
          session.user.username = dbUser.username;
          // Use database image if available, otherwise use token picture
          session.user.image = normalizeImageValue(dbUser.image) || tokenPicture || normalizeImageValue(session.user.image);

          // Backfill missing DB image from token so future sessions keep the avatar.
          if (!dbUser.image && tokenPicture) {
            await backfillUserImage(dbUser.id, tokenPicture);
          }
        } else {
          // If no DB user (or lookup failed), keep session usable from token/session payload.
          if (typeof token.sub === 'string' && token.sub.trim().length > 0) {
            session.user.id = token.sub;
          }
          if (typeof token.username === 'string') {
            session.user.username = token.username;
          }
          session.user.image = tokenPicture || normalizeImageValue(session.user.image);
          session.user.role = normalizeUserRole(token.role);
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
          token.picture = normalizeImageValue(profile?.picture) || normalizeImageValue(profile?.image) || normalizeImageValue(user.image);
        }
      }
      token.role = normalizeUserRole(token.role ?? user?.role);
      // Ensure picture persists in token
      if (!normalizeImageValue(token.picture) && user?.image) {
        token.picture = normalizeImageValue(user.image);
      }
      // Last-resort recovery from DB (helps older sessions where token.picture was never set)
      if (!normalizeImageValue(token.picture) && typeof token.email === 'string' && token.email) {
        token.picture = await findUserImageByEmail(token.email);
      }
      return token;
    },
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === 'google' && user.email) {
          const googleProfileImage =
            normalizeImageValue(profile?.picture) ||
            normalizeImageValue(profile?.image) ||
            normalizeImageValue(user.image) ||
            null;

          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, user.email),
          });

          if (!existingUser) {
            await db.insert(users).values({
              email: user.email,
              name: user.name || null,
              image: googleProfileImage,
              role: 'user',
              emailVerified: new Date(),
            });
          } else {
            await db.update(users)
              .set({ 
                lastLoginAt: new Date(),
                name: user.name || existingUser.name,
                image: googleProfileImage || existingUser.image,
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

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
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
            });
          }
        }
        return true;
      } catch (error) {
        console.error('SignIn error:', error);
        return true;
      }
    },
    async session({ session, token }) {
      try {
        if (session.user?.email) {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.email, session.user.email),
          });
          if (dbUser) {
            session.user.id = dbUser.id.toString();
          }
        }
      } catch (error) {
        console.error('Session error:', error);
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

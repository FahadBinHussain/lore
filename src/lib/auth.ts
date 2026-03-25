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
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, session.user.email),
        });
        
        if (dbUser) {
          session.user.id = dbUser.id.toString();
          session.user.role = dbUser.role;
          session.user.username = dbUser.username;
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        token.id = user.id;
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
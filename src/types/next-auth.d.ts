import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'admin' | 'user';
      username?: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role?: 'admin' | 'user';
    username?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'user';
    username?: string | null;
  }
}
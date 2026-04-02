import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import type { UserRole } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      username?: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role?: UserRole;
    username?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole;
    username?: string | null;
  }
}

import NextAuth, { 
  AuthOptions, 
  Session, 
  User 
} from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { query } from '@/lib/db-utils';
import bcrypt from 'bcryptjs';

// Extend the default Session type
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      department?: string;
    }
  }
}

// Extend the default JWT type
declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    department?: string;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Check user in database
          const userResult = await query(
            'SELECT id, name, email, password, role, department FROM users WHERE email = $1',
            [credentials.email]
          );

          if (userResult.rows.length === 0) {
            return null;
          }

          const user = userResult.rows[0];

          // Verify password
          const isPasswordValid = await bcrypt.compare(
            credentials.password, 
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          // Return user object for session
          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT, user?: User }) {
      if (user) {
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }: { session: Session, token: JWT }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.department = token.department;
      }
      return session;
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

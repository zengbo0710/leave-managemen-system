import NextAuth from 'next-auth';
import { 
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

const authOptions: AuthOptions = {
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

          // If no user found
          if (userResult.rows.length === 0) {
            return null;
          }

          const user = userResult.rows[0];

          // Check password
          const isPasswordValid = await bcrypt.compare(
            credentials.password, 
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          // Return user object for session
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub || '';
        session.user.role = token.role;
        session.user.department = token.department;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as User & { role?: string }).role;
        token.department = (user as User & { department?: string }).department;
      }
      return token;
    }
  },
  pages: {
    signIn: '/login'
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

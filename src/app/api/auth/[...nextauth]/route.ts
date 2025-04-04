import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { query } from '@/lib/db-utils';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

export const authOptions: NextAuthOptions = {
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
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.department = token.department;
      }
      return session;
    }
  }
};

const handler = NextAuth(authOptions);

// Explicitly define GET and POST methods
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

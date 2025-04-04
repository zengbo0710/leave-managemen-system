import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Replace this with your own authentication logic
        if (credentials?.username === 'admin' && credentials?.password === 'password') {
          // Note: NextAuth User requires id to be a string
          return {
            id: '1',
            name: 'Admin User',
            email: 'admin@example.com'
          };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
};

export default NextAuth(authOptions);

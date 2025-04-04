import NextAuth from 'next-auth';
import Providers from 'next-auth/providers';

export const authOptions = {
  providers: [
    Providers.Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        // Replace this with your own authentication logic
        if (credentials?.username === 'admin' && credentials?.password === 'password') {
          return { id: 1, name: 'Admin', email: 'admin@example.com' };
        }
        return null;
      },
    }),
  ],
  session: {
    jwt: true,
  },
};

export default NextAuth(authOptions);

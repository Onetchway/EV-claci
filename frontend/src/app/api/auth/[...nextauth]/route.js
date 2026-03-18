import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'zivahgroup.com';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const domain = user.email?.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) return `/login?error=unauthorized_domain`;
      return true;
    },
    async jwt({ token, account }) {
      // On first sign in, fetch backend JWT
      if (account?.access_token) {
        try {
          const res = await fetch(
            `${process.env.NEXTAUTH_URL}/api/backend/auth/google/token`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: account.access_token }) }
          );
          if (res.ok) {
            const data = await res.json();
            token.backendToken = data.token;
            token.role = data.role;
          }
        } catch (_) {}
      }
      return token;
    },
    async session({ session, token }) {
      session.backendToken = token.backendToken;
      session.user.role    = token.role;
      return session;
    },
  },
  pages: {
    signIn:  '/login',
    error:   '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'zivahgroup.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const providers = [
  CredentialsProvider({
    name: 'Email and password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials?.email, password: credentials?.password }),
      });
      if (!res.ok) return null;
      const { data } = await res.json();
      return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        backendToken: data.token,
      };
    },
  }),
];

// Google is optional — only offered when configured (see .env.example).
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }));
}

export const authOptions = {
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true; // credentials login already gated by the backend
      const domain = user.email?.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) return `/login?error=unauthorized_domain`;
      return true;
    },
    async jwt({ token, user, account }) {
      // Credentials login: authorize() already returned the backend token.
      if (user?.backendToken) {
        token.backendToken = user.backendToken;
        token.role = user.role;
        return token;
      }
      // Google login: exchange the Google access token for a backend JWT.
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

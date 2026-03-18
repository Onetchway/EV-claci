export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/stations/:path*',
    '/chargers/:path*',
    '/franchise/:path*',
    '/revenue/:path*',
    '/settlements/:path*',
    '/users/:path*',
  ],
};

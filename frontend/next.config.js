/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['lh3.googleusercontent.com'] },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

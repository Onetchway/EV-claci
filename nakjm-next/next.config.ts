import type { NextConfig } from "next";

/**
 * Static export so the whole site can be served from Firebase Hosting's CDN
 * with no server runtime. Anything dynamic (the enquiry form) posts to a
 * Firebase Function instead — see functions/index.js and the rewrite in
 * firebase.json.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // A static export has no image optimisation server, so images are
    // pre-encoded to AVIF/WebP at build-prep time and served as-is.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [420, 640, 828, 1080, 1280, 1600, 1920],
  },

  compiler: {
    // Strip console noise from production bundles, keeping real errors.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  experimental: {
    optimizePackageImports: ["framer-motion", "gsap"],
  },
};

export default nextConfig;

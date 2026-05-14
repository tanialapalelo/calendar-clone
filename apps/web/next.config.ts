import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enables `next build` to produce a minimal self-contained server
  // (used by the Dockerfile for production deployments)
  output: 'standalone',

  // Allow the dev server to proxy images from external sources if needed
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile pictures
    ],
  },
};

export default nextConfig;

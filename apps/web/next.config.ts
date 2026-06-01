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

  // Proxy API calls under the web origin so cookies are first-party.
  // In production on Vercel this will make requests to /v1/* go to your API
  // (set NEXT_PUBLIC_API_URL to your Render API e.g. https://api.example.com).
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

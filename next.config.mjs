/** @type {import('next').NextConfig} */
const nextConfig = {
  // JSON is UTF-8 by spec, but without an explicit charset some browsers guess
  // Latin-1 and render Thai text as mojibake when viewing a route directly.
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'resources.premierleague.com',
      },
    ],
  },
};

export default nextConfig;

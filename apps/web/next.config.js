/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kdlgoods/shared"],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ygvtasgunxkukebhmiok.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;

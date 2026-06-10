/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "pg",
    ],
  },
  async redirects() {
    return [
      { source: "/tong/import", destination: "/crate/import", permanent: false },
      { source: "/tong/export", destination: "/crate/export", permanent: false },
      { source: "/tong/stock", destination: "/crate/stock", permanent: false },
    ];
  },
};

export default nextConfig;

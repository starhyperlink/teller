import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/Settings",
        destination: "/settings",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

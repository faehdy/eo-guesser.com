import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "planetarycomputer.microsoft.com",
        pathname: "/api/data/**",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "**.ncl.com" },
      { protocol: "https", hostname: "**.presspage.com" },
    ],
  },
};

export default nextConfig;

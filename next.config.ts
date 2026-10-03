import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Container builds (Cloud Run, see Dockerfile) set BUILD_STANDALONE=1 to get a self-contained server in .next/standalone.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "thumb.wikimedia.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "www.techpowerup.com" },
      { protocol: "https", hostname: "storage-asset.msi.com" },
      { protocol: "https", hostname: "assets.corsair.com" },
      { protocol: "https", hostname: "shop.sandisk.com" },
      { protocol: "https", hostname: "www.sandisk.com" },
      { protocol: "https", hostname: "www.arctic.de" },
      { protocol: "https", hostname: "cdn.hstatic.net" },
      { protocol: "https", hostname: "phanteks.com" },
    ],
  },
};

export default nextConfig;

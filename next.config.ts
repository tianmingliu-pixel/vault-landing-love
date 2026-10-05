import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Container builds (Cloud Run, see Dockerfile) set BUILD_STANDALONE=1 to get a self-contained server in .next/standalone.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // satellite.js 7 re-exports an optional WASM/pthreads propagator that imports node:worker_threads; the site only uses
  // the plain SGP4 functions, so production (webpack) builds swap that module for an empty one.
  // `next dev` uses Turbopack, which bundles that module without trouble; this tells Next the webpack hook is intentional.
  turbopack: {},
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/satellite\.js[\\/]dist[\\/]wasm[\\/]index\.js$/, path.resolve("src/app/lib/empty-module.js")),
    );
    return config;
  },
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

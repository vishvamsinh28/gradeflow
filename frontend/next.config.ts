import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a build run without clobbering the .next directory a dev server is
  // using. Set NEXT_DIST_DIR to build alongside `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false
};

export default nextConfig;

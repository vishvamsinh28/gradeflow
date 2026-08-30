import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("./src", import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a build run without clobbering the .next directory a dev server is
  // using. Set NEXT_DIST_DIR to build alongside `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  // `@/...` resolves to src/. Next normally reads this from jsconfig.json, but
  // that file exists only to hold this one mapping, so it lives here instead.
  turbopack: {
    resolveAlias: { "@/*": "./src/*" },
  },
};

export default nextConfig;

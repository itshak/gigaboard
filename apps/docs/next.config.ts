import type { NextConfig } from "next";

/**
 * Next.js 15 configuration for the Ultra Chess React docs app.
 *
 * Notes:
 * - Transpile the workspace packages so changes are picked up during `dev`.
 * - `reactStrictMode` is on by default; keep it that way — any double-render
 *   the board can't tolerate is a bug worth catching.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ultrachess/core",
    "@ultrachess/react",
    "@ultrachess/pieces",
    "@ultrachess/themes",
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;

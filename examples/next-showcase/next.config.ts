import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "gigaboard",
    "@gigaboard/core",
    "@gigaboard/pieces",
    "@gigaboard/themes",
  ],
};

export default nextConfig;

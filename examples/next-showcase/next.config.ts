import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ultrachess/react",
    "@ultrachess/core",
    "@ultrachess/pieces",
    "@ultrachess/themes",
  ],
};

export default nextConfig;

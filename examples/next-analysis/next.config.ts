import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ultrachess/react", "@ultrachess/core"],
};

export default nextConfig;

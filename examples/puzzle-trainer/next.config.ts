import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["gigaboard", "@gigaboard/core"],
};

export default nextConfig;

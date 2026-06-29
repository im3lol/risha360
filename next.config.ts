import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-runtime",
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;

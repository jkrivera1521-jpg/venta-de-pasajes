import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  transpilePackages: ["@venta-pasajes/shared-types"]
};

export default nextConfig;

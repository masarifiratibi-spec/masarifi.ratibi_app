import type { NextConfig } from "next";
import { resolve } from "node:path";
import { resolveAdminRuntime } from "./src/core/config/runtime";
import { validateAdminServerRuntime } from "./src/core/config/server-runtime";

resolveAdminRuntime();
validateAdminServerRuntime();

const nextConfig: NextConfig = {
  turbopack: { root: resolve(__dirname, "../..") },
  outputFileTracingRoot: resolve(__dirname, "../.."),
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
};

export default nextConfig;

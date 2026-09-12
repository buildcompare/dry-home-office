import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "glorious-acorn-p7p9gg45j76437wrp-3000.app.github.dev",
  ],

  experimental: {
    serverActions: {
      allowedOrigins: [
        "glorious-acorn-p7p9gg45j76437wrp-3000.app.github.dev",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
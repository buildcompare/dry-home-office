import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "glorious-acorn-p7p9gg45j76437wrp-3000.app.github.dev",
  ],

  // Mail libraries use Node sockets/streams; keep them out of the bundle.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],

  experimental: {
    serverActions: {
      // Email attachments (Vercel caps request bodies at about 4.5 MB).
      bodySizeLimit: "4mb",
      allowedOrigins: [
        "glorious-acorn-p7p9gg45j76437wrp-3000.app.github.dev",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
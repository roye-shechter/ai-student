import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist (Node-only, dynamic requires). Load it via
  // native require at runtime instead of bundling it into the server build.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;

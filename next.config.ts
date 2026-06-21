import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf2json is a pure-JS PDF parser (no native/canvas bindings) and loads its
  // own glyph/encoding data files from node_modules at runtime. Keep it out of
  // the server bundle so it is resolved via native require and those data files
  // remain available inside the serverless function.
  serverExternalPackages: ["pdf2json"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/tools/bca-estatement/parse": [
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**",
      "./node_modules/pdf-parse/**",
    ],
  },
};

export default nextConfig;

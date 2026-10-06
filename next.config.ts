import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build run beside a running dev server without sharing `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // next/image is not supported in static export without a loader
  images: {
    unoptimized: true,
  },

  // Trailing slash ensures correct asset paths
  trailingSlash: true,

  experimental: {
    cpus: 4,
  },

  devIndicators: false,


  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

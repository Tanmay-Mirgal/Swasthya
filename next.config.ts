import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Capacitor: generates a fully static HTML/JS/CSS bundle in /out
  // Conditional so that API routes work in development
  output: process.env.CAPACITOR_BUILD === "true" ? "export" : undefined,

  // next/image is not supported in static export without a loader
  images: {
    unoptimized: true,
  },

  // Trailing slash ensures correct asset paths inside Capacitor WebView
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

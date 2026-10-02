import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Capacitor: generates a fully static HTML/JS/CSS bundle in /out
  output: "export",

  // next/image is not supported in static export without a loader
  images: {
    unoptimized: true,
  },

  // Trailing slash ensures correct asset paths inside Capacitor WebView
  trailingSlash: true,
};

export default nextConfig;

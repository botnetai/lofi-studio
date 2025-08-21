import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react"],
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Enable compression
  compress: true,

  // Optimize CSS
  swcMinify: true,

  // Bundle analyzer (optional - can be enabled during builds)
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      // Add bundle analyzer in production if needed
      // const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      // config.plugins.push(new BundleAnalyzerPlugin());
    }

    return config;
  },
};

export default nextConfig;

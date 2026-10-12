import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Leave room for a 10 MiB file and multipart headers. The upload handler
  // enforces its own bounded stream and file limits before Storage writes.
  experimental: { proxyClientMaxBodySize: "12mb" },
};

export default createNextIntlPlugin()(nextConfig);

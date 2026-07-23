import {
  buildSecurityHeaders,
  validateMarketingPublicEnvironment
} from "./lib/security-headers.mjs";

validateMarketingPublicEnvironment();

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "dist",
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders()
      }
    ];
  }
};

export default nextConfig;

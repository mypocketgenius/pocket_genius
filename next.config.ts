import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
    // Note: For production, configure remotePatterns with specific domains
    // For now, we'll use unoptimized prop on Image components for external avatars
  },
};

// Wrap Next.js config with Sentry
// This enables source maps upload and Sentry webpack plugin
// Only configure Sentry if DSN is provided (optional for development)
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps if auth token is provided
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

// Only wrap with Sentry if DSN is configured
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;


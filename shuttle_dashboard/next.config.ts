import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/shuttle/:path*",
        destination: `${backendUrl}/api/v1/shuttle/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

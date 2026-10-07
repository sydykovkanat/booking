import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

/**
 * Next blocks cross-origin requests to dev assets/HMR by default. Allow this machine's
 * LAN addresses so the dev server can be opened from a phone on the same network.
 * Extra hosts can be added via DEV_ALLOWED_ORIGINS (comma-separated hostnames). Dev only.
 */
function lanHostnames(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net?.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
}

const extraDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [...lanHostnames(), ...extraDevOrigins],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

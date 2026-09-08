import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

/**
 * Hostnames allowed to load `/_next/*` dev resources.
 *
 * `next dev` blocks cross-origin requests to its dev endpoints by default, so
 * opening the app from a phone on the same Wi-Fi (http://<laptop-ip>:3000)
 * gets a 403 for every JS chunk and the page never hydrates.
 *
 * Enumerating this machine's own LAN addresses keeps that working after a
 * DHCP lease change, without hard-coding an IP that goes stale. Set
 * DEV_ALLOWED_ORIGINS (comma-separated) to add anything else, e.g. a tunnel
 * hostname.
 *
 * Development only - `next start` has no such restriction.
 */
function localNetworkOrigins(): string[] {
  const origins = new Set<string>(["localhost", "127.0.0.1"]);

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        origins.add(address.address);
      }
    }
  }

  for (const extra of (process.env.DEV_ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed);
  }

  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: localNetworkOrigins(),
};

export default nextConfig;

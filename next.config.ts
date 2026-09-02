import os from "node:os";
import type { NextConfig } from "next";

/**
 * Every non-internal IPv4 address on this machine.
 *
 * Next dev blocks cross-origin requests for internal dev assets (/_next/*)
 * unless the requesting origin is allowlisted. When testing from a phone we
 * hit the laptop by its LAN IP, which is exactly such an origin — so seed the
 * allowlist with whatever IPs this machine currently has. Dev-only; this has
 * no effect on `next build` / `next start`.
 */
function lanHosts(): string[] {
  return Object.values(os.networkInterfaces())
    .flatMap((addrs) => addrs ?? [])
    .filter((net) => net.family === "IPv4" && !net.internal)
    .map((net) => net.address);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts(),
};

export default nextConfig;

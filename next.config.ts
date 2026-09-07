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

  // The landing page lives at /home; `/` is just its front door. Handled here
  // rather than with a placeholder app/page.tsx so there is no second file to
  // keep in step, and the redirect happens before any rendering.
  async redirects() {
    return [{ source: "/", destination: "/home", permanent: false }];
  },
};

export default nextConfig;

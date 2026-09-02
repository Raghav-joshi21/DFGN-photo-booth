#!/usr/bin/env node
/**
 * dev:lan launcher
 *
 * Starts `next dev` over HTTPS bound to 0.0.0.0 so a phone on the same Wi-Fi
 * can reach the laptop by its LAN IP. HTTPS matters because getUserMedia
 * (camera access) needs a secure context, and a bare LAN IP over http:// is
 * not considered secure by mobile browsers.
 *
 * Why we mint our own cert instead of just using `--experimental-https`:
 * Next's built-in flag shells out to mkcert, whose `-install` step needs an
 * interactive password, and the cert it produces only covers
 * `localhost 127.0.0.1 ::1 0.0.0.0` — NOT the LAN IP the phone actually dials.
 * So a phone would get a cert-name mismatch even on the happy path. Instead we
 * generate a self-signed cert with openssl whose SANs include every LAN IPv4 on
 * this machine, and hand it to Next via --experimental-https-key/-cert.
 *
 * The cert is self-signed, so the phone (and laptop) show a one-time browser
 * warning you must accept — see the README. That's expected in dev.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CERT_DIR = path.join(ROOT, "certificates");
const KEY_FILE = path.join(CERT_DIR, "localhost-key.pem");
const CERT_FILE = path.join(CERT_DIR, "localhost.pem");
// Records which SANs the current cert was minted for, so we can regenerate
// automatically when you move to a different network and your IP changes.
const SANS_FILE = path.join(CERT_DIR, "sans.json");

const PORT = process.env.PORT ?? "3000";

/** Non-internal IPv4 addresses, Wi-Fi/Ethernet interfaces first. */
function getLanIps() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const net of addrs ?? []) {
      if (net.family !== "IPv4" || net.internal) continue;
      // Deprioritize virtual/VM interfaces; prefer en*/wl*/eth* (real NICs).
      candidates.push({ address: net.address, preferred: /^(en|wl|eth)/i.test(name) });
    }
  }
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred));
  return candidates.map((c) => c.address);
}

const lanIps = getLanIps();
const sans = [
  "DNS:localhost",
  "IP:127.0.0.1",
  "IP:0:0:0:0:0:0:0:1",
  ...lanIps.map((ip) => `IP:${ip}`),
];

/** True when a usable cert already exists for exactly this set of SANs. */
function certIsCurrent() {
  if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE)) return false;
  try {
    const previous = JSON.parse(fs.readFileSync(SANS_FILE, "utf8"));
    return JSON.stringify(previous) === JSON.stringify(sans);
  } catch {
    return false;
  }
}

/** Mint a self-signed cert covering `sans`. Returns false if openssl is absent. */
function generateCert() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const result = spawnSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-days", "365", "-nodes",
      "-keyout", KEY_FILE,
      "-out", CERT_FILE,
      "-subj", "/CN=DFGN Photo Booth dev",
      "-addext", `subjectAltName=${sans.join(",")}`,
      "-addext", "basicConstraints=critical,CA:FALSE",
      "-addext", "keyUsage=digitalSignature,keyEncipherment",
      "-addext", "extendedKeyUsage=serverAuth",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (result.error || result.status !== 0) {
    console.warn(
      `\n⚠ Could not generate a cert with openssl${
        result.stderr?.length ? `: ${result.stderr.toString().trim()}` : ""
      }\n  Falling back to Next's --experimental-https (localhost only).\n`,
    );
    return false;
  }
  fs.writeFileSync(SANS_FILE, JSON.stringify(sans, null, 2));
  return true;
}

const haveCert = certIsCurrent() || generateCert();

// --- Banner ---------------------------------------------------------------

const ip = lanIps[0] ?? null;
const scheme = "https";
const lanUrl = ip ? `${scheme}://${ip}:${PORT}` : null;

const line = "─".repeat(58);
console.log(`\n┌${line}┐`);
console.log("│  DFGN Photo Booth — LAN dev server (HTTPS)");
console.log(`├${line}┤`);
console.log(`│  Local:    ${scheme}://localhost:${PORT}`);
if (lanUrl) {
  console.log(`│  Network:  ${lanUrl}   ← open this on your phone`);
  console.log("│");
  console.log(`│  Booth:    ${lanUrl}/booth`);
  console.log(`│  Upload:   ${lanUrl}/upload`);
} else {
  console.log("│  Network:  (no LAN IPv4 found — are you on Wi-Fi?)");
}
console.log("│");
if (haveCert) {
  console.log(`│  Cert covers: ${["localhost", "127.0.0.1", ...lanIps].join(", ")}`);
}
console.log("│  Self-signed cert → accept the one-time browser warning.");
console.log(`└${line}┘\n`);

// --- Launch ---------------------------------------------------------------

// --experimental-https is what actually switches the server to TLS; the
// key/cert flags only tell it which cert to use instead of minting one via
// mkcert. Passing key/cert alone is silently ignored and you get plain http.
const httpsArgs = haveCert
  ? [
      "--experimental-https",
      "--experimental-https-key", KEY_FILE,
      "--experimental-https-cert", CERT_FILE,
    ]
  : ["--experimental-https"];

const child = spawn(
  "next",
  ["dev", ...httpsArgs, "-H", "0.0.0.0", "-p", String(PORT)],
  { stdio: "inherit", env: process.env, shell: process.platform === "win32" },
);

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

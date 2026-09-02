import type { MetadataRoute } from "next";

/**
 * Web App Manifest (served at /manifest.webmanifest; Next auto-links it).
 *
 * The installable PWA is aimed at the guest phone flow, so `start_url` points
 * at /upload. iOS add-to-home-screen also relies on the apple-* meta tags and
 * apple-touch-icon set in app/layout.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DFGN Photo Booth",
    short_name: "DFGN Booth",
    description:
      "Upload a selfie to the RTU Design Factory event photo wall.",
    start_url: "/upload",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#7C3AED",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

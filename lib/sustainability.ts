/**
 * Shared sustainability messaging for the potato mascot.
 *
 * Used by the floating bot on the site (`components/site/PotatoBot`) and the
 * panel under the booth QR code (`app/booth/page`). Kept here so the two stay
 * in sync — the event's green story is told the same way everywhere.
 */

/**
 * Animated mascot art: a transparent-background VP9 WebM (alpha) plus a still
 * frame for prefers-reduced-motion / no-WebM fallback. Rendered through
 * `components/site/Clip`. Source was a 40MB GIF — converted so it doesn't bloat
 * the repo (see .gitignore's note on large binaries).
 */
export const SUS_MASCOT_SRC = "/art/sus-man.webm";
export const SUS_MASCOT_POSTER = "/art/sus-man.png";
/** Intrinsic size of the mascot clip, so the reduced-motion still reserves the same box. */
export const SUS_MASCOT_W = 854;
export const SUS_MASCOT_H = 480;

export const SUSTAINABILITY_FACTS = [
  "This booth is 100% digital — no printed strips, no plastic frames, no landfill. 🌱",
  "DFGN UnBoxed 2026 is our most sustainable event yet: every photo stays digital. ♻️",
  "Skip the print and you skip the plastic sleeve, the ink and the paper. Tiny choice, big pile avoided. 📸",
  "Plastic bottles take 450+ years to break down. Your digital spud selfie takes none. ⏳",
  "Recycling one plastic bottle saves enough energy to charge a phone many times over. 📱",
  "Refill at the water station — one reusable cup replaces dozens of single-use ones. 🥤",
  "We sorted tonight into recycle, compost and landfill bins. Drop yours in the right one! 🗑️",
  "Recycling a tonne of plastic keeps hundreds of litres of oil in the ground. 🛢️",
  "Every QR upload here replaces a printed strip. Thousands of guests, zero prints. ✨",
  "The greenest photo is the one you never printed — so you're already helping. 💚",
];

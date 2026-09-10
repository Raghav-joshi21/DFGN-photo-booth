import { PotatoSticker, type PotatoVariant } from "./PotatoSticker";

/**
 * Ambient backdrop of potatoes drifting down the page.
 *
 * Pure CSS (see globals.css) rather than Framer Motion: this loops forever in
 * the background, so it should stay off the main thread and cost nothing in JS.
 *
 * Values are hand-picked rather than random so the layout is deterministic —
 * server and client render identically (no hydration mismatch) and the drops
 * stay spread out instead of clumping. Negative delays start each one partway
 * through its fall, so the screen isn't empty on first paint.
 *
 * Fall, sway and spin durations are all varied per drop. Sharing them makes the
 * whole field pulse in lockstep, which reads as one animation rather than many
 * independent potatoes.
 */
type Drop = {
  /** Horizontal position, % of the container. */
  left: number;
  /** Tailwind size pair — literal strings so Tailwind can see them. */
  size: string;
  /** Seconds for one full top-to-bottom fall. */
  duration: number;
  /** Negative = already mid-fall when the page loads. */
  delay: number;
  opacity: number;
  /** Seconds for the side-to-side sway and the rotation, respectively. */
  sway: number;
  spin: number;
  variant: PotatoVariant;
};

const DROPS: Drop[] = [
  { left: 2, size: "h-16 w-16", duration: 19, delay: -2, opacity: 0.5, sway: 5, spin: 14, variant: "jumper" },
  { left: 5, size: "h-9 w-9", duration: 32, delay: -17, opacity: 0.3, sway: 6, spin: 19, variant: "badge" },
  { left: 8, size: "h-8 w-8", duration: 33, delay: -24, opacity: 0.28, sway: 7, spin: 22, variant: "scientist" },
  { left: 11, size: "h-14 w-14", duration: 25, delay: -7, opacity: 0.4, sway: 4.5, spin: 15, variant: "party" },
  { left: 14, size: "h-10 w-10", duration: 26, delay: -14, opacity: 0.35, sway: 6, spin: 18, variant: "party" },
  { left: 17, size: "h-6 w-6", duration: 40, delay: -28, opacity: 0.24, sway: 8, spin: 27, variant: "jumper" },
  { left: 20, size: "h-20 w-20", duration: 22, delay: -9, opacity: 0.45, sway: 4.5, spin: 12, variant: "badge" },
  { left: 23, size: "h-11 w-11", duration: 29, delay: -20, opacity: 0.32, sway: 5.5, spin: 21, variant: "scientist" },
  { left: 27, size: "h-12 w-12", duration: 30, delay: -21, opacity: 0.3, sway: 8, spin: 25, variant: "scientist" },
  { left: 30, size: "h-7 w-7", duration: 21, delay: -4, opacity: 0.26, sway: 6.5, spin: 13, variant: "badge" },
  { left: 33, size: "h-6 w-6", duration: 36, delay: -6, opacity: 0.24, sway: 5.5, spin: 16, variant: "jumper" },
  { left: 36, size: "h-14 w-14", duration: 24, delay: -25, opacity: 0.42, sway: 7, spin: 20, variant: "party" },
  { left: 39, size: "h-16 w-16", duration: 24, delay: -5, opacity: 0.4, sway: 6.5, spin: 20, variant: "party" },
  { left: 42, size: "h-9 w-9", duration: 34, delay: -12, opacity: 0.28, sway: 4, spin: 24, variant: "scientist" },
  { left: 45, size: "h-10 w-10", duration: 29, delay: -18, opacity: 0.32, sway: 4, spin: 11, variant: "badge" },
  { left: 48, size: "h-12 w-12", duration: 20, delay: -30, opacity: 0.36, sway: 8.5, spin: 17, variant: "jumper" },
  { left: 51, size: "h-14 w-14", duration: 20, delay: -12, opacity: 0.42, sway: 7.5, spin: 24, variant: "scientist" },
  { left: 54, size: "h-8 w-8", duration: 37, delay: -22, opacity: 0.26, sway: 5, spin: 14, variant: "party" },
  { left: 57, size: "h-8 w-8", duration: 34, delay: -27, opacity: 0.26, sway: 5, spin: 15, variant: "jumper" },
  { left: 60, size: "h-18 w-18", duration: 23, delay: -3, opacity: 0.44, sway: 6, spin: 18, variant: "badge" },
  { left: 63, size: "h-20 w-20", duration: 21, delay: -11, opacity: 0.45, sway: 6, spin: 13, variant: "party" },
  { left: 66, size: "h-9 w-9", duration: 31, delay: -19, opacity: 0.28, sway: 7.5, spin: 22, variant: "scientist" },
  { left: 69, size: "h-12 w-12", duration: 27, delay: -3, opacity: 0.35, sway: 8.5, spin: 26, variant: "badge" },
  { left: 72, size: "h-6 w-6", duration: 39, delay: -15, opacity: 0.22, sway: 4.5, spin: 19, variant: "jumper" },
  { left: 75, size: "h-6 w-6", duration: 38, delay: -16, opacity: 0.22, sway: 4.5, spin: 19, variant: "scientist" },
  { left: 78, size: "h-14 w-14", duration: 26, delay: -26, opacity: 0.38, sway: 5.5, spin: 16, variant: "party" },
  { left: 80, size: "h-16 w-16", duration: 23, delay: -19, opacity: 0.42, sway: 7, spin: 17, variant: "party" },
  { left: 83, size: "h-10 w-10", duration: 33, delay: -8, opacity: 0.3, sway: 4, spin: 23, variant: "badge" },
  { left: 86, size: "h-10 w-10", duration: 31, delay: -8, opacity: 0.3, sway: 5.5, spin: 21, variant: "jumper" },
  { left: 89, size: "h-7 w-7", duration: 22, delay: -29, opacity: 0.24, sway: 6.5, spin: 12, variant: "scientist" },
  { left: 91, size: "h-14 w-14", duration: 25, delay: -30, opacity: 0.38, sway: 6.5, spin: 14, variant: "badge" },
  { left: 94, size: "h-12 w-12", duration: 30, delay: -10, opacity: 0.34, sway: 7, spin: 25, variant: "party" },
  { left: 96, size: "h-8 w-8", duration: 35, delay: -13, opacity: 0.26, sway: 4, spin: 23, variant: "party" },
  { left: 99, size: "h-12 w-12", duration: 28, delay: -22, opacity: 0.32, sway: 7, spin: 12, variant: "scientist" },
];

export function FallingPotatoes() {
  return (
    <div
      aria-hidden
      className="potato-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    >
      {DROPS.map((d) => (
        <span
          key={d.left}
          className="potato-drop absolute top-0"
          style={{
            left: `${d.left}%`,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
            opacity: d.opacity,
          }}
        >
          <span
            className="potato-drop-inner block"
            // Two animations on this element (sway, spin) — the comma-separated
            // values line up with their declaration order in the CSS.
            style={{
              animationDuration: `${d.sway}s, ${d.spin}s`,
              animationDelay: `${d.delay / 2}s, ${d.delay}s`,
            }}
          >
            <PotatoSticker variant={d.variant} className={d.size} />
          </span>
        </span>
      ))}
    </div>
  );
}

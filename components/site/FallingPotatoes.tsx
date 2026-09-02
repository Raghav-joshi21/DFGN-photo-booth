import { PotatoSticker, type PotatoVariant } from "./PotatoSticker";

/**
 * Ambient backdrop of single potatoes drifting down the page.
 *
 * Pure CSS (see globals.css) rather than Framer Motion: this loops forever in
 * the background, so it should stay off the main thread and cost nothing in JS.
 *
 * Values are hand-picked rather than random so the layout is deterministic —
 * server and client render identically (no hydration mismatch) and the drops
 * stay spread out instead of clumping. Negative delays start each one partway
 * through its fall, so the screen isn't empty on first paint.
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
  variant: PotatoVariant;
};

const DROPS: Drop[] = [
  { left: 4, size: "h-16 w-16", duration: 19, delay: -2, opacity: 0.5, variant: "jumper" },
  { left: 13, size: "h-10 w-10", duration: 26, delay: -14, opacity: 0.35, variant: "party" },
  { left: 23, size: "h-20 w-20", duration: 22, delay: -9, opacity: 0.45, variant: "badge" },
  { left: 34, size: "h-12 w-12", duration: 30, delay: -21, opacity: 0.3, variant: "scientist" },
  { left: 45, size: "h-16 w-16", duration: 24, delay: -5, opacity: 0.4, variant: "party" },
  { left: 56, size: "h-10 w-10", duration: 28, delay: -17, opacity: 0.32, variant: "jumper" },
  { left: 66, size: "h-20 w-20", duration: 21, delay: -11, opacity: 0.45, variant: "scientist" },
  { left: 77, size: "h-12 w-12", duration: 27, delay: -3, opacity: 0.35, variant: "badge" },
  { left: 86, size: "h-16 w-16", duration: 23, delay: -19, opacity: 0.42, variant: "party" },
  { left: 94, size: "h-10 w-10", duration: 31, delay: -8, opacity: 0.3, variant: "jumper" },
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
          <span className="potato-drop-inner block">
            <PotatoSticker variant={d.variant} className={d.size} />
          </span>
        </span>
      ))}
    </div>
  );
}

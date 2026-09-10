import { IdfwSticker, type IdfwStickerVariant } from "./IdfwSticker";

/**
 * Ambient backdrop of IDFW '26 sticker-sheet art drifting down the page,
 * alongside FallingPotatoes rather than instead of it — two independent
 * layers, same fall/sway/spin keyframes (see globals.css), so they read as
 * one weather system instead of competing animations.
 *
 * Same determinism rationale as FallingPotatoes: hand-picked values, not
 * random, so server/client markup matches and drops stay spread out.
 */
type Drop = {
  left: number;
  size: string;
  duration: number;
  delay: number;
  opacity: number;
  sway: number;
  spin: number;
  variant: IdfwStickerVariant;
};

const DROPS: Drop[] = [
  { left: 5, size: "h-10 w-10", duration: 27, delay: -4, opacity: 0.4, sway: 6, spin: 17, variant: "star-yellow" },
  { left: 12, size: "h-14 w-14", duration: 32, delay: -19, opacity: 0.32, sway: 7.5, spin: 23, variant: "oak-leaf" },
  { left: 18, size: "h-8 w-8", duration: 24, delay: -10, opacity: 0.3, sway: 5, spin: 15, variant: "star-navy" },
  { left: 24, size: "h-16 w-16", duration: 35, delay: -6, opacity: 0.4, sway: 8, spin: 27, variant: "potato-astronaut" },
  { left: 31, size: "h-9 w-9", duration: 22, delay: -15, opacity: 0.28, sway: 4.5, spin: 13, variant: "star-maroon" },
  { left: 37, size: "h-12 w-12", duration: 30, delay: -23, opacity: 0.36, sway: 6.5, spin: 20, variant: "wheat-bundle" },
  { left: 44, size: "h-16 w-16", duration: 26, delay: -8, opacity: 0.42, sway: 5.5, spin: 16, variant: "astronaut-helmet" },
  { left: 50, size: "h-8 w-8", duration: 33, delay: -2, opacity: 0.26, sway: 7, spin: 24, variant: "star-tan" },
  { left: 56, size: "h-10 w-10", duration: 25, delay: -17, opacity: 0.34, sway: 5, spin: 18, variant: "moon-stars" },
  { left: 62, size: "h-14 w-14", duration: 29, delay: -12, opacity: 0.38, sway: 8.5, spin: 21, variant: "cheese-wedge" },
  { left: 68, size: "h-9 w-9", duration: 21, delay: -25, opacity: 0.3, sway: 4, spin: 12, variant: "star-navy" },
  { left: 74, size: "h-12 w-12", duration: 34, delay: -5, opacity: 0.32, sway: 6, spin: 19, variant: "mitten" },
  { left: 80, size: "h-8 w-8", duration: 23, delay: -20, opacity: 0.28, sway: 7.5, spin: 14, variant: "star-yellow" },
  { left: 86, size: "h-13 w-13", duration: 31, delay: -9, opacity: 0.36, sway: 5.5, spin: 22, variant: "wooden-spoon" },
  { left: 92, size: "h-10 w-10", duration: 28, delay: -14, opacity: 0.3, sway: 6.5, spin: 16, variant: "sun-face" },
  { left: 97, size: "h-9 w-9", duration: 36, delay: -3, opacity: 0.26, sway: 4.5, spin: 25, variant: "star-maroon" },
];

export function FallingStickers() {
  return (
    <div
      aria-hidden
      className="potato-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    >
      {DROPS.map((d, i) => (
        <span
          key={i}
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
            style={{
              animationDuration: `${d.sway}s, ${d.spin}s`,
              animationDelay: `${d.delay / 2}s, ${d.delay}s`,
            }}
          >
            <IdfwSticker variant={d.variant} className={d.size} />
          </span>
        </span>
      ))}
    </div>
  );
}

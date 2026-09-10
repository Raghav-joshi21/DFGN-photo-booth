import Image from "next/image";

/**
 * Sticker art lifted straight from the official "IDFW '26 — Latvia" sticker
 * sheet (public/stickers), cut out and made transparent per-sticker. Distinct
 * from PotatoSticker: these are the event's own illustrations (landmarks,
 * folk motifs, the spacesuit potato), not the booth's mascot art.
 *
 * Each entry's w/h is the source PNG's real pixel size, so Next can reserve
 * the right box without a layout shift.
 */
const STICKERS = {
  "st-peters-cathedral": { src: "/stickers/idfw-st-peters-cathedral.png", w: 506, h: 560 },
  "st-johns-cathedral": { src: "/stickers/idfw-st-johns-cathedral.png", w: 560, h: 525 },
  "riga-landscape": { src: "/stickers/idfw-riga-landscape.png", w: 560, h: 379 },
  "manor-house": { src: "/stickers/idfw-manor-house.png", w: 480, h: 367 },
  "potato-astronaut": { src: "/stickers/idfw-potato-astronaut.png", w: 355, h: 420 },
  "potato-rocket": { src: "/stickers/idfw-potato-rocket.png", w: 389, h: 420 },
  "astronaut-helmet": { src: "/stickers/idfw-astronaut-helmet.png", w: 475, h: 480 },
  "rocket": { src: "/stickers/idfw-rocket.png", w: 300, h: 298 },
  "amber-necklace": { src: "/stickers/idfw-amber-necklace.png", w: 265, h: 320 },
  "sun-sceptre": { src: "/stickers/idfw-sun-sceptre.png", w: 373, h: 380 },
  "sun-face": { src: "/stickers/idfw-sun-face.png", w: 252, h: 248 },
  "moon-stars": { src: "/stickers/idfw-moon-stars.png", w: 234, h: 244 },
  "floral-wreath": { src: "/stickers/idfw-floral-wreath.png", w: 480, h: 363 },
  "flower-basket": { src: "/stickers/idfw-flower-basket.png", w: 460, h: 455 },
  "mitten": { src: "/stickers/idfw-mitten.png", w: 222, h: 340 },
  "folk-rug": { src: "/stickers/idfw-folk-rug.png", w: 204, h: 340 },
  "folk-clogs": { src: "/stickers/idfw-folk-clogs.png", w: 420, h: 310 },
  "oak-leaf": { src: "/stickers/idfw-oak-leaf.png", w: 286, h: 380 },
  "wheat-bundle": { src: "/stickers/idfw-wheat-bundle.png", w: 183, h: 380 },
  "cheese-wedge": { src: "/stickers/idfw-cheese-wedge.png", w: 300, h: 283 },
  "wooden-spoon": { src: "/stickers/idfw-wooden-spoon.png", w: 100, h: 280 },
  "weathervane-rooster": { src: "/stickers/idfw-weathervane-rooster.png", w: 210, h: 300 },
  "star-yellow": { src: "/stickers/idfw-star-yellow.png", w: 84, h: 83 },
  "star-maroon": { src: "/stickers/idfw-star-maroon.png", w: 83, h: 83 },
  "star-tan": { src: "/stickers/idfw-star-tan.png", w: 84, h: 83 },
  "star-navy": { src: "/stickers/idfw-star-navy.png", w: 84, h: 82 },
} as const;

export type IdfwStickerVariant = keyof typeof STICKERS;

export function IdfwSticker({
  variant,
  className = "",
  rotate = 0,
  priority = false,
}: {
  variant: IdfwStickerVariant;
  /** Must set an explicit width AND height (e.g. "h-16 w-16"). */
  className?: string;
  /** Degrees — matches the sticker-sheet look of art scattered at odd angles. */
  rotate?: number;
  priority?: boolean;
}) {
  const { src, w, h } = STICKERS[variant];

  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={w}
      height={h}
      priority={priority}
      className={`object-contain ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    />
  );
}

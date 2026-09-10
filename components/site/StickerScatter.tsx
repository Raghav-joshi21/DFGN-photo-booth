import type { CSSProperties } from "react";

import { IdfwSticker, type IdfwStickerVariant } from "./IdfwSticker";

/**
 * A hand-placed scatter of IDFW sticker-sheet art around a hero section —
 * the "stuck to the poster board" look, as opposed to FallingPotatoes' falling
 * field. Positions are per-page (see home/gallery), not a shared global list,
 * since every hero has a different shape and the stickers need to sit clear
 * of the actual content.
 */
export type ScatterSticker = {
  variant: IdfwStickerVariant;
  /** Tailwind position classes, e.g. "-left-6 top-4". Include a size (h- and w-) too. */
  className: string;
  rotate?: number;
  /** Seconds for the idle bob loop; varied so the set doesn't pulse in lockstep. */
  duration?: number;
  delay?: number;
  hideOnMobile?: boolean;
};

export function StickerScatter({ stickers }: { stickers: ScatterSticker[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {stickers.map((s, i) => (
        <span
          key={i}
          className={`idfw-sticker absolute drop-shadow-[2px_3px_0_rgba(90,22,24,0.15)] ${
            s.hideOnMobile ? "hidden sm:block" : ""
          } ${s.className}`}
          style={
            {
              animationDuration: `${s.duration ?? 6}s`,
              animationDelay: `${s.delay ?? 0}s`,
              "--sticker-rotate": `${s.rotate ?? 0}deg`,
            } as CSSProperties
          }
        >
          <IdfwSticker variant={s.variant} className="h-full w-full" />
        </span>
      ))}
    </div>
  );
}

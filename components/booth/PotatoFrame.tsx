import Image from "next/image";

import type { Photo } from "@/types";

/**
 * A photo in the booth's house frame: a chunky print with the DFGN mark on the
 * caption strip and a potato peeking over the corner.
 *
 * The booth wall fixes the print at 4:3 so the marquee's rows are predictable.
 * The gallery passes `natural`, which lets each print take the shape of the
 * photo inside it — a landscape shot stays landscape instead of being squared
 * off, which is the whole point of shooting one.
 */
export function PotatoFrame({
  photo,
  rotation = 0,
  natural = false,
}: {
  photo?: Photo;
  rotation?: number;
  /** Size the print to the photo's own aspect instead of a fixed 4:3. */
  natural?: boolean;
}) {
  const src = photo ? (photo.editedUrl ?? photo.originalUrl) : null;

  return (
    <div
      className="relative w-full rounded-lg border-[3px] border-ink bg-white p-2 pb-7 shadow-[5px_5px_0_var(--color-ink)]"
      style={{ rotate: `${rotation}deg` }}
    >
      <div
        className={`relative overflow-hidden rounded-sm bg-sage ${
          natural ? "" : "aspect-[4/3]"
        }`}
      >
        {src && natural ? (
          // Intrinsic sizing, so the box grows to the photo's own ratio. A
          // plain <img> rather than next/image: `fill` needs a parent of known
          // height, which is exactly what this mode does not have.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" aria-hidden className="block h-auto w-full" />
        ) : src ? (
          <Image
            src={src}
            alt=""
            aria-hidden
            fill
            sizes="320px"
            className="object-cover"
            unoptimized
          />
        ) : (
          // Placeholder print: keeps the wall looking like a wall before the
          // first guest, without resorting to explanatory text on a kiosk.
          <div className="flex h-full w-full items-center justify-center opacity-25">
            <Image
              src="/art/potatoes.png"
              alt=""
              aria-hidden
              width={512}
              height={512}
              className="h-1/2 w-auto"
            />
          </div>
        )}
      </div>

      {/* Caption strip */}
      <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between">
        {/* The new DFGN mark is white-on-transparent, made for a dark or
            colour ground (see the footer) — inverted here since this strip
            sits on a plain white card. */}
        <Image
          src="/art/dfgn-logo-white.png"
          alt=""
          aria-hidden
          width={66}
          height={64}
          className="h-3.5 w-auto opacity-70 invert"
        />
        <span className="font-display text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
          UnBoxed 2026
        </span>
      </div>

      {/* Potato peeking over the corner. */}
      <Image
        src="/art/potatoes.png"
        alt=""
        aria-hidden
        width={512}
        height={512}
        className="pointer-events-none absolute -right-3 -top-3 h-9 w-9 -rotate-12 drop-shadow"
      />
    </div>
  );
}

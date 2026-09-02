import Image from "next/image";

/**
 * The potato sticker used across the landing page.
 *
 * Backed by a single illustration (public/art/potatoes.png), so `variant` no
 * longer selects a different character the way the mockup's four stickers do —
 * it varies tilt and mirroring instead, which keeps repeated stickers from
 * reading as copy-paste. Callers keep the same API.
 *
 * If per-character art arrives later, map each variant to its own file here and
 * nothing at the call sites needs to change.
 */
export type PotatoVariant = "scientist" | "jumper" | "badge" | "party";

/** Tilt (deg) and whether to mirror, per variant. */
const POSE: Record<PotatoVariant, { tilt: number; flip: boolean }> = {
  scientist: { tilt: -8, flip: false },
  jumper: { tilt: 6, flip: true },
  badge: { tilt: -3, flip: false },
  party: { tilt: 11, flip: true },
};

export function PotatoSticker({
  variant = "jumper",
  className = "",
  priority = false,
}: {
  variant?: PotatoVariant;
  /** Must set an explicit width AND height (e.g. "h-16 w-16"). */
  className?: string;
  priority?: boolean;
}) {
  const { tilt, flip } = POSE[variant];

  return (
    <Image
      src="/art/potatoes.png"
      alt=""
      aria-hidden
      width={512}
      height={512}
      priority={priority}
      className={`object-contain ${className}`}
      style={{ transform: `rotate(${tilt}deg)${flip ? " scaleX(-1)" : ""}` }}
    />
  );
}

/**
 * The tilted sheet of stickers that decorates the hero. Purely decorative.
 */
export function StickerSheet({
  variants,
  className = "",
}: {
  variants: PotatoVariant[];
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`grid grid-cols-2 gap-2 rounded-lg bg-white/85 p-3 shadow-lg shadow-ink/10 ring-1 ring-ink/10 ${className}`}
    >
      {variants.map((v, i) => (
        <PotatoSticker key={`${v}-${i}`} variant={v} className="h-16 w-16" />
      ))}
    </div>
  );
}

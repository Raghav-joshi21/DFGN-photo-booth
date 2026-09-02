/**
 * Placeholder potato-character sticker.
 *
 * The real DFGN UnBoxed artwork isn't in the repo yet, so these stand in at the
 * right size and palette to hold the layout. Each `variant` mirrors one of the
 * characters in the design (lab coat, knitted jumper, ID badge, party).
 *
 * To swap in the real art: replace the <svg> with an <Image> pointing at the
 * asset. Nothing else needs to change — callers only set size and variant.
 */
export type PotatoVariant = "scientist" | "jumper" | "badge" | "party";

const SKIN: Record<PotatoVariant, string> = {
  scientist: "#e8d5c4",
  jumper: "#dcc9a8",
  badge: "#cfd6bc",
  party: "#d9b3ae",
};

const ACCENT: Record<PotatoVariant, string> = {
  scientist: "#8fb8d4",
  jumper: "#c9a227",
  badge: "#7fa045",
  party: "#ee8b2b",
};

export function PotatoSticker({
  variant = "jumper",
  className = "",
}: {
  variant?: PotatoVariant;
  className?: string;
}) {
  const skin = SKIN[variant];
  const accent = ACCENT[variant];

  return (
    <svg viewBox="0 0 100 120" className={className} role="presentation">
      {/* Body — an irregular potato blob. */}
      <path
        d="M50 6c22 0 34 16 36 38 2 22-4 46-14 60-7 10-31 10-40 1C21 93 12 68 14 45 16 22 28 6 50 6Z"
        fill={skin}
        stroke="#5a1618"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Accessory band: goggles / jumper stripe / badge / hat, per variant. */}
      {variant === "scientist" ? (
        <>
          <rect x="24" y="36" width="52" height="14" rx="7" fill={accent} stroke="#5a1618" strokeWidth="3" />
          <path d="M50 36v14" stroke="#5a1618" strokeWidth="3" />
        </>
      ) : null}
      {variant === "jumper" ? (
        <>
          <path d="M20 62h60" stroke={accent} strokeWidth="7" strokeLinecap="round" />
          <path d="M20 74h60" stroke={accent} strokeWidth="7" strokeLinecap="round" />
        </>
      ) : null}
      {variant === "badge" ? (
        <rect x="56" y="62" width="18" height="24" rx="3" fill={accent} stroke="#5a1618" strokeWidth="3" />
      ) : null}
      {variant === "party" ? (
        <path d="M34 20 50 2l16 18Z" fill={accent} stroke="#5a1618" strokeWidth="3" strokeLinejoin="round" />
      ) : null}

      {/* Face. */}
      <circle cx="38" cy={variant === "scientist" ? 43 : 46} r="3.4" fill="#5a1618" />
      <circle cx="62" cy={variant === "scientist" ? 43 : 46} r="3.4" fill="#5a1618" />
      <path
        d={`M40 ${variant === "scientist" ? 56 : 58}q10 8 20 0`}
        stroke="#5a1618"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
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
      className={`grid grid-cols-2 gap-3 rounded-lg bg-white/85 p-4 shadow-lg shadow-ink/10 ring-1 ring-ink/10 ${className}`}
    >
      {variants.map((v, i) => (
        <PotatoSticker key={`${v}-${i}`} variant={v} className="h-16 w-auto" />
      ))}
    </div>
  );
}

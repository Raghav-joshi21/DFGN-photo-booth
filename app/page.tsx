import Link from "next/link";

import { PotatoSticker, StickerSheet } from "@/components/site/PotatoSticker";
import { TopNav } from "@/components/site/TopNav";

/**
 * Landing page — the DFGN UnBoxed 2026 front door.
 *
 * Two routes out: the kiosk capture flow and the live gallery wall. Guests
 * arriving by QR code skip this and land straight on /upload.
 */
export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream font-body text-ink">
      <TopNav />

      <main className="relative flex-1 overflow-hidden">
        {/* Soft sage wash in the corners, matching the design's warm ground. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />

        {/* Decorative sticker sheets, hidden on small screens where they'd crowd. */}
        <StickerSheet
          variants={["scientist", "jumper", "badge", "party"]}
          className="absolute left-6 top-6 hidden w-52 -rotate-3 lg:grid"
        />
        <StickerSheet
          variants={["jumper", "party"]}
          className="absolute -right-10 bottom-10 hidden w-40 rotate-6 xl:grid"
        />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-5 py-12 sm:py-16">
          {/* Hero */}
          <div className="relative">
            <h1 className="text-shadow-brand text-center font-display text-5xl font-extrabold tracking-tight text-ink sm:text-6xl md:text-7xl">
              DF Photo Booth
            </h1>
            <StarBadge className="absolute -right-7 -top-6 h-14 w-14 sm:-right-12 sm:-top-7 sm:h-16 sm:w-16" />
          </div>

          <p className="mt-5 max-w-2xl text-center text-base text-ink/75 sm:text-lg">
            Welcome to the fertile ground of memory-making. Choose your
            experience.
          </p>

          {/* The two ways in */}
          <div className="mt-12 grid w-full gap-7 sm:mt-14 md:grid-cols-2">
            {/* Capture */}
            <ChoiceCard
              href="/booth"
              title="Photo Booth"
              cta="Snap a Pic"
              ctaClass="bg-ink text-cream-light"
              icon={<CameraIcon className="h-4 w-4" />}
              className="bg-brand-yellow"
            >
              <div className="relative flex h-44 items-center justify-center">
                <div className="flex h-44 w-44 items-center justify-center overflow-hidden border-[5px] border-brand-orange bg-gradient-to-b from-cream-light to-sage [border-radius:48%_52%_45%_55%/55%_45%_55%_45%]">
                  <PotatoSticker variant="badge" priority className="h-32 w-32" />
                </div>
              </div>
            </ChoiceCard>

            {/* Gallery */}
            <ChoiceCard
              href="/gallery"
              title="IDFW Gallery"
              cta="View Spuds"
              ctaClass="bg-brand-green text-white"
              icon={<CheckIcon className="h-4 w-4" />}
              className="bg-cream-light"
            >
              <div className="relative flex h-44 items-center justify-center">
                {/* Stack of prints peeking out behind the badge. */}
                <div aria-hidden className="absolute flex -translate-y-5 translate-x-3 items-center">
                  {[-16, -5, 10].map((deg, i) => (
                    <div
                      key={deg}
                      style={{ rotate: `${deg}deg`, marginLeft: i ? "-2.25rem" : 0 }}
                      className="flex h-28 w-24 items-end justify-center rounded-md border border-ink/15 bg-white p-2 pb-4 shadow-md shadow-ink/10"
                    >
                      <PotatoSticker
                        variant={(["scientist", "party", "jumper"] as const)[i]}
                        className="h-16 w-16"
                      />
                    </div>
                  ))}
                </div>
                <div className="relative flex h-24 w-24 translate-y-5 -translate-x-6 items-center justify-center rounded-full border-[3px] border-ink bg-brand-orange shadow-[3px_3px_0_var(--color-ink)]">
                  <GridIcon className="h-10 w-10 text-white" />
                </div>
              </div>
            </ChoiceCard>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * One of the two big entry cards: art on top, title, and a pill CTA. The whole
 * card is the link, so the pill is a visual affordance rather than a nested
 * anchor (which would be invalid markup and a second tab stop).
 */
function ChoiceCard({
  href,
  title,
  cta,
  ctaClass,
  icon,
  className = "",
  children,
}: {
  href: string;
  title: string;
  cta: string;
  ctaClass: string;
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col items-center overflow-hidden rounded-[26px] border-[3px] border-ink p-6 shadow-[6px_6px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange ${className}`}
    >
      {children}
      <h2 className="mt-2 text-center font-display text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      <span
        className={`mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 font-display text-sm font-bold shadow-sm transition-transform group-hover:scale-[1.03] ${ctaClass}`}
      >
        {icon}
        {cta}
      </span>
    </Link>
  );
}

function StarBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full border-[3px] border-ink bg-brand-orange shadow-[3px_3px_0_var(--color-ink)] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" role="presentation">
        <path
          d="M12 3.5 14.4 9l6 .5-4.6 4 1.4 5.9L12 16.3 6.8 19.4l1.4-5.9-4.6-4 6-.5Z"
          fill="#5a1618"
        />
      </svg>
    </span>
  );
}

function CameraIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} role="presentation">
      <path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.8h5.4L14.8 6h3.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} role="presentation">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="m8 12.3 2.7 2.7L16 9.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="presentation">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" fill="currentColor" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.6" fill="currentColor" />
    </svg>
  );
}

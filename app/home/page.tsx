import Image from "next/image";
import Link from "next/link";

import { FallingPotatoes } from "@/components/site/FallingPotatoes";
import { PotatoSticker } from "@/components/site/PotatoSticker";
import { StickerScatter } from "@/components/site/StickerScatter";
import { TopNav } from "@/components/site/TopNav";

/**
 * Landing page (/home) — the DFGN UnBoxed 2026 front door.
 *
 * Two routes out: the kiosk capture flow and the live gallery wall. Guests
 * arriving by QR code skip this and land straight on /upload. `/` redirects
 * here (see next.config.ts), so the front door has one address.
 */
export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream font-body text-ink">
      <TopNav />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Soft sage wash in the corners, matching the design's warm ground. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />

        <FallingPotatoes />

        {/* Latvia / IDFW '26 sticker sheet, pinned around the hero's outer
            margins — kept clear of the h1's own potato-sleep accent and the
            two choice cards. */}
        <StickerScatter
          stickers={[
            { variant: "astronaut-helmet", className: "left-3 top-4 h-16 w-16 sm:left-8 sm:top-8 sm:h-24 sm:w-24", rotate: -6, duration: 7, hideOnMobile: false },
            { variant: "potato-astronaut", className: "right-3 bottom-6 h-20 w-20 sm:right-10 sm:bottom-10 sm:h-28 sm:w-28", rotate: 5, duration: 6.5, delay: -1.5 },
            { variant: "wheat-bundle", className: "left-4 bottom-4 h-16 w-16 sm:left-12 sm:bottom-16 sm:h-24 sm:w-24", rotate: -4, duration: 8, hideOnMobile: true },
            { variant: "oak-leaf", className: "right-4 top-24 h-14 w-14 sm:right-14 sm:top-32 sm:h-20 sm:w-20", rotate: 10, duration: 7.5, delay: -2, hideOnMobile: true },
            { variant: "star-yellow", className: "left-[8%] top-16 h-6 w-6 sm:h-8 sm:w-8", rotate: -12, duration: 5, hideOnMobile: true },
            { variant: "star-maroon", className: "right-[10%] bottom-24 h-6 w-6 sm:h-8 sm:w-8", rotate: 14, duration: 5.5, delay: -1, hideOnMobile: true },
            { variant: "star-navy", className: "left-[12%] bottom-10 h-5 w-5 sm:h-7 sm:w-7", rotate: 8, duration: 6, delay: -3, hideOnMobile: true },
          ]}
        />

        <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-10 sm:py-14">
          {/* Hero */}
          <div className="relative">
            <h1 className="text-shadow-brand text-center font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl md:text-6xl">
              DF Photo Booth
            </h1>
            {/* `unoptimized` is required: Next's image optimizer would
                otherwise re-encode this to a still first frame. */}
            <Image
              src="/art/potato-sleep.gif"
              alt=""
              aria-hidden
              width={160}
              height={100}
              unoptimized
              priority
              className="pointer-events-none absolute -right-32 -top-12 hidden w-28 sm:block sm:-right-44 sm:-top-16 sm:w-40"
            />
          </div>

          <p className="mt-4 max-w-xl text-center text-sm text-ink/75 sm:text-base">
            Welcome to the fertile ground of memory-making. Choose your
            experience.
          </p>

          {/* The two ways in */}
          <div className="mt-8 grid w-full gap-5 sm:mt-10 sm:gap-6 md:grid-cols-2">
            {/* Capture */}
            <ChoiceCard
              href="/booth"
              title="Photo Booth"
              cta="Snap a Pic"
              ctaClass="bg-ink text-cream-light"
              icon={<CameraIcon className="h-4 w-4" />}
              className="bg-brand-yellow"
            >
              <div className="relative flex h-32 items-center justify-center">
                <div className="h-32 w-32 overflow-hidden border-[4px] border-brand-orange bg-cream-light [border-radius:48%_52%_45%_55%/55%_45%_55%_45%]">
                  {/* The source had a transparency checkerboard baked in (h264
                      carries no alpha), so it is keyed out and flattened onto
                      cream — hence the matching solid background here. */}
                  <video
                    className="motion-video h-full w-full object-cover"
                    src="/art/potato-booth.mp4"
                    poster="/art/potato-booth-poster.jpg"
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-hidden
                  />
                  <Image
                    src="/art/potato-booth-poster.jpg"
                    alt=""
                    aria-hidden
                    width={360}
                    height={360}
                    className="motion-still h-full w-full object-cover"
                  />
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
              <div className="relative flex h-32 w-full items-center justify-center">
                {/* Two prints stacked behind the clip. Same footprint as the
                    front print but rotated and nudged sideways, so only their
                    corners show — a photo pile rather than a fan. */}
                {[
                  { deg: -8, x: -26 },
                  { deg: 8, x: 26 },
                ].map(({ deg, x }) => (
                  <div
                    key={deg}
                    aria-hidden
                    style={{ rotate: `${deg}deg`, translate: `${x}px` }}
                    className="absolute flex h-[6.5rem] w-44 items-center justify-center rounded-md border border-ink/15 bg-white pb-2 shadow-md shadow-ink/10"
                  >
                    <PotatoSticker variant="scientist" className="h-10 w-10" />
                  </div>
                ))}

                {/* The clip as the front print, centred on the stack. It ships
                    its own designed background, so nothing is keyed out — the
                    frame is what makes the video's rectangle read as a photo. */}
                <div className="relative rotate-1 rounded-md border border-ink/15 bg-white p-1.5 pb-4 shadow-lg shadow-ink/25">
                  <video
                    className="motion-video block w-44 rounded-sm"
                    src="/art/potato-clicking.mp4"
                    poster="/art/potato-clicking-poster.jpg"
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-hidden
                  />
                  <Image
                    src="/art/potato-clicking-poster.jpg"
                    alt=""
                    aria-hidden
                    width={400}
                    height={226}
                    className="motion-still block w-44 rounded-sm"
                  />
                </div>

                <span className="absolute -bottom-3 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-brand-orange shadow-[3px_3px_0_var(--color-ink)]">
                  <GridIcon className="h-5 w-5 text-white" />
                </span>
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
      className={`group relative flex flex-col items-center overflow-hidden rounded-[22px] border-[3px] border-ink p-5 shadow-[5px_5px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange ${className}`}
    >
      {children}
      {/* mt-7, not mt-2: the gallery art has a badge hanging below its box, and
          both titles must sit on the same line across the two cards. */}
      <h2 className="mt-6 text-center font-display text-2xl font-extrabold uppercase tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <span
        className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-sm font-bold shadow-sm transition-transform group-hover:scale-[1.03] ${ctaClass}`}
      >
        {icon}
        {cta}
      </span>
    </Link>
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

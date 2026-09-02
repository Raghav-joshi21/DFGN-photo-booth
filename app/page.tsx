import Image from "next/image";
import Link from "next/link";

import { FallingPotatoes } from "@/components/site/FallingPotatoes";
import { PotatoSticker } from "@/components/site/PotatoSticker";
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

      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Soft sage wash in the corners, matching the design's warm ground. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />

        <FallingPotatoes />

        <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 py-12 sm:py-16">
          {/* Hero */}
          <div className="relative">
            <h1 className="text-shadow-brand text-center font-display text-5xl font-extrabold tracking-tight text-ink sm:text-6xl md:text-7xl">
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
              className="pointer-events-none absolute -right-40 -top-16 w-36 sm:-right-56 sm:-top-20 sm:w-52"
            />
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
                <div className="h-44 w-44 overflow-hidden border-[5px] border-brand-orange bg-cream-light [border-radius:48%_52%_45%_55%/55%_45%_55%_45%]">
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
              <div className="relative h-44 w-full">
                {/* Two plain prints, tucked behind and to the left. */}
                <div aria-hidden className="absolute left-1 top-5 flex items-center">
                  {[-15, 8].map((deg, i) => (
                    <div
                      key={deg}
                      style={{ rotate: `${deg}deg`, marginLeft: i ? "-1.5rem" : 0 }}
                      className="flex h-24 w-20 items-end justify-center rounded-md border border-ink/15 bg-white p-2 pb-3.5 shadow-md shadow-ink/10"
                    >
                      <PotatoSticker
                        variant={(["scientist", "party"] as const)[i]}
                        className="h-14 w-14"
                      />
                    </div>
                  ))}
                </div>

                {/* The clip as the front print. This cut ships its own designed
                    background, so nothing is keyed out — the frame around it is
                    what makes the video's rectangle read as a photo border. */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 rotate-2 rounded-md border border-ink/15 bg-white p-1.5 pb-4 shadow-lg shadow-ink/20">
                  <video
                    className="motion-video block w-48 rounded-sm"
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
                    className="motion-still block w-48 rounded-sm"
                  />
                </div>

                <span className="absolute bottom-2 left-24 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink bg-brand-orange shadow-[3px_3px_0_var(--color-ink)]">
                  <GridIcon className="h-6 w-6 text-white" />
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

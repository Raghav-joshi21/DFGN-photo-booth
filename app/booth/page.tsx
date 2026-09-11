"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";
import Link from "next/link";

import { ScrollingWall } from "@/components/booth/ScrollingWall";
import { SelfCamera } from "@/components/booth/SelfCamera";
import { Clip } from "@/components/site/Clip";
import { useApprovedPhotos } from "@/lib/hooks/use-approved-photos";
import {
  SUS_MASCOT_H,
  SUS_MASCOT_MP4,
  SUS_MASCOT_POSTER,
  SUS_MASCOT_SRC,
  SUS_MASCOT_W,
  SUSTAINABILITY_FACTS,
} from "@/lib/sustainability";

/**
 * Booth (kiosk) route.
 *
 * Deliberately chrome-free: no site header, no nav links. This screen is a
 * fixed display people walk up to, not a page they browse, so anything they
 * cannot act on from arm's length is just clutter.
 *
 * Three columns, left to right: the live wall, the camera, the phone-upload
 * panel. The camera is the middle and the largest — it is what the guest is
 * actually there for.
 *
 * The camera is always live on idle — there is no separate capture screen,
 * and the AR mini-game (see SelfCamera's "Catch game" toggle) runs right in
 * that same preview rather than a screen of its own.
 */
export default function BoothPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream font-body text-ink">
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />

        {/* Same potato-sheet art as home/gallery. This layout is a packed
            three-column kiosk screen with almost no open background — the
            wall and rail columns are opaque and sit right at the page edges —
            so these four are a bonus that only shows once those columns hide
            below `lg`. The one that's always visible (the "centre" one) lives
            inside IdleScreen's camera column instead, where there's real open
            margin above the header. */}
        <Image
          src="/art/potato-hero.png"
          alt=""
          aria-hidden
          width={392}
          height={348}
          className="pointer-events-none absolute -left-10 -top-10 hidden w-28 rotate-[10deg] opacity-40 sm:block md:w-36"
        />
        <Image
          src="/art/potato-hero-alt.png"
          alt=""
          aria-hidden
          width={277}
          height={246}
          className="pointer-events-none absolute -right-8 -top-8 hidden w-24 -scale-x-100 rotate-[8deg] opacity-40 sm:block md:w-32"
        />
        <Image
          src="/art/potato-hero.png"
          alt=""
          aria-hidden
          width={392}
          height={348}
          className="pointer-events-none absolute -bottom-10 -right-10 hidden w-28 -scale-x-100 rotate-[-10deg] opacity-40 sm:block md:w-36"
        />
        <Image
          src="/art/potato-hero-alt.png"
          alt=""
          aria-hidden
          width={277}
          height={246}
          className="pointer-events-none absolute -bottom-8 -left-8 hidden w-24 rotate-[-4deg] opacity-40 sm:block md:w-32"
        />

        <IdleScreen />
      </main>
    </div>
  );
}

function IdleScreen() {
  const { photos } = useApprovedPhotos();

  // The QR points guests at THIS host's /upload. When the booth is opened via
  // the LAN URL, window.location.origin is already the right https://<ip>:port.
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  useEffect(() => {
    setUploadUrl(`${window.location.origin}/upload`);
  }, []);

  // Rotating sustainability line for the panel under the QR code.
  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setFactIdx((i) => (i + 1) % SUSTAINABILITY_FACTS.length),
      7000,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full gap-[clamp(0.75rem,1.4vw,1.5rem)] p-[clamp(0.75rem,1.4vw,1.5rem)]">
      <Link
        href="/home"
        aria-label="Back to home"
        className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-full border-[3px] border-ink bg-cream-light/90 px-3 py-1.5 font-display text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] backdrop-blur-sm transition-transform hover:-translate-y-0.5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M15 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </Link>

      {/* Wall — ambient, wordless, always moving. */}
      <section className="hidden h-full w-[clamp(9rem,13vw,17rem)] shrink-0 lg:block">
        <ScrollingWall photos={photos} />
      </section>

      {/* Camera — the main event. */}
      {/* pt on small screens clears the Back button, which sits over this
          column once the wall and rail are hidden. */}
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center pt-11 sm:pt-0">
        {/* The "centre" potato: the header + camera block is vertically
            centred in this column, so whatever's shorter than the column
            leaves open margin above the header — that's genuinely visible
            background, unlike the corner ones above which sit behind the
            opaque wall/rail columns at this width. */}
        <Image
          src="/art/potato-hero-alt.png"
          alt=""
          aria-hidden
          width={277}
          height={246}
          // -z-10: absolutely positioned elements otherwise paint above
          // normal-flow siblings regardless of DOM order, which put this
          // decoration on top of (covering) the header text below it.
          className="pointer-events-none absolute left-1/2 top-1 -z-10 hidden w-16 -translate-x-1/2 rotate-[-5deg] opacity-60 drop-shadow-sm sm:top-2 sm:block sm:w-20 md:w-24"
        />

        <header className="relative z-10 mb-[clamp(0.5rem,1.2vh,1rem)] flex translate-y-[20%] shrink-0 items-center gap-3">
          <div className="h-[clamp(2.25rem,4vh,3rem)] w-[clamp(2.25rem,4vh,3rem)] shrink-0 overflow-hidden rounded-full border-[3px] border-brand-orange bg-cream-light">
            <Clip
              src="/art/potato-booth.mp4"
              poster="/art/potato-booth-poster.jpg"
              width={360}
              height={360}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-display text-[clamp(1.15rem,2.4vh,1.875rem)] font-extrabold uppercase leading-tight tracking-tight text-ink">
              Step up &amp; smile
            </h1>
            <p className="text-[clamp(0.7rem,1.4vh,0.875rem)] text-ink/60">
              Scroll the filters, tap the middle one to shoot.
            </p>
          </div>
        </header>

        <SelfCamera />
      </section>

      {/* Right rail — split 60/40: phone upload on top, the event's
          sustainability story pinned across the bottom. */}
      <aside className="hidden h-full w-[clamp(15rem,23vw,30rem)] shrink-0 flex-col overflow-hidden rounded-[26px] border-[3px] border-ink bg-cream-light text-center shadow-[6px_6px_0_var(--color-ink)] lg:flex">
        {/* Top section — send one from your phone. Sizes to its content (plus
            the pt- offset that pushes the stack down); the sustainability
            block below takes whatever height is left. */}
        <div className="flex shrink-0 flex-col items-center justify-start gap-[clamp(0.25rem,1vh,0.5rem)] px-[clamp(0.75rem,1.5vw,1.25rem)] pb-3 pt-[clamp(1rem,6vh,4rem)]">
          <Image
            src="/art/idfw26-latvia-logo.png"
            alt="Latvia — IDFW '26"
            width={2203}
            height={863}
            priority
            className="w-[clamp(7rem,55%,12rem)] rounded-lg border-2 border-ink bg-cream-light px-2 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
          />

          <p className="font-display text-[clamp(1rem,2.6vh,1.875rem)] font-extrabold uppercase leading-tight tracking-tight text-ink">
            Send one from your phone
          </p>

          {/* The potato points down at the code. */}
          <Clip
            src="/art/potato-point-qr.webm"
            mp4Alpha="/art/potato-point-qr.mp4"
            poster="/art/potato-point-qr.png"
            width={300}
            height={380}
            className="-mb-3 h-[clamp(3.5rem,13vh,7.4rem)] w-auto drop-shadow-md"
          />

          <div className="w-[clamp(6.5rem,60%,13rem)] rounded-2xl border-[3px] border-ink bg-white p-[clamp(0.4rem,0.8vw,0.75rem)]">
            {uploadUrl ? (
              <QRCodeSVG
                value={uploadUrl}
                size={196}
                marginSize={0}
                // Rendered at a fixed 196 and scaled by CSS: the SVG stays
                // crisp at any size, and the box never jumps.
                className="h-auto w-full"
              />
            ) : (
              // Reserve the square so the panel doesn't jump once it resolves.
              <div className="aspect-square w-full" />
            )}
          </div>

          <p className="font-display text-[clamp(0.65rem,1.4vh,0.875rem)] font-bold uppercase tracking-wide text-ink/50">
            Scan to join the wall
          </p>
          <p className="hidden max-w-[15rem] text-xs leading-snug text-ink/45 sm:[@media(min-height:800px)]:block">
            Anything you capture at the event shows up on the wall.
          </p>
        </div>

        {/* Bottom section — sustainability, edge to edge; fills the remaining
            height under the QR block. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden border-t-[3px] border-ink bg-brand-green/10 px-5 py-4">
          <Clip
            src={SUS_MASCOT_SRC}
            mp4Alpha={SUS_MASCOT_MP4}
            poster={SUS_MASCOT_POSTER}
            width={SUS_MASCOT_W}
            height={SUS_MASCOT_H}
            className="min-h-0 w-auto max-w-full flex-shrink object-contain drop-shadow-md [max-height:clamp(4rem,18vh,11rem)]"
          />
          <p className="shrink-0 font-display text-[clamp(0.95rem,2.2vh,1.875rem)] font-extrabold uppercase leading-none tracking-tight text-brand-green">
            Our most sustainable event
          </p>
          <p className="line-clamp-3 shrink-0 text-[clamp(0.7rem,1.5vh,0.875rem)] leading-snug text-ink/70">
            {SUSTAINABILITY_FACTS[factIdx]}
          </p>
        </div>
      </aside>
    </div>
  );
}

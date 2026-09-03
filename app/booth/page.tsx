"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";

import { ScrollingWall } from "@/components/booth/ScrollingWall";
import { SelfCamera } from "@/components/booth/SelfCamera";
import { Clip } from "@/components/site/Clip";
import { useApprovedPhotos } from "@/lib/hooks/use-approved-photos";
import { useBoothStore } from "@/lib/stores/booth-store";
import {
  SUS_MASCOT_H,
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
 * Screen switching is driven by `useBoothStore().screen`; the camera is always
 * live on idle, so there is no separate capture screen.
 */
export default function BoothPage() {
  const screen = useBoothStore((s) => s.screen);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream font-body text-ink">
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />
        {screen === "game" ? <GameScreen /> : <IdleScreen />}
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
    <div className="relative flex h-full w-full gap-6 p-6">
      {/* Wall — ambient, wordless, always moving. */}
      <section className="hidden h-full w-56 shrink-0 xl:block 2xl:w-64">
        <ScrollingWall photos={photos} />
      </section>

      {/* Camera — the main event. */}
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <header className="mb-4 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-[3px] border-brand-orange bg-cream-light">
            <Clip
              src="/art/potato-booth.mp4"
              poster="/art/potato-booth-poster.jpg"
              width={360}
              height={360}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
              Step up &amp; smile
            </h1>
            <p className="text-sm text-ink/60">
              Pick a filter, then hit the countdown.
            </p>
          </div>
        </header>

        <SelfCamera />
      </section>

      {/* Right rail — split 60/40: phone upload on top, the event's
          sustainability story pinned across the bottom. */}
      <aside className="hidden h-full w-80 shrink-0 flex-col overflow-hidden rounded-[26px] border-[3px] border-ink bg-cream-light text-center shadow-[6px_6px_0_var(--color-ink)] lg:flex xl:w-[420px] 2xl:w-[480px]">
        {/* Top section (60%) — send one from your phone; stack centred
            horizontally, sitting in the upper-middle of the section. */}
        <div className="flex h-3/5 min-h-0 flex-col items-center justify-start gap-3 px-5 pb-4 pt-[20%]">
          <Image
            src="/art/latvia-idfw26.png"
            alt="Latvia — IDFW '26"
            width={205}
            height={78}
            priority
            className="w-48 rounded-lg border-2 border-ink shadow-[3px_3px_0_var(--color-ink)]"
          />

          <p className="font-display text-3xl font-extrabold uppercase leading-tight tracking-tight text-ink">
            Send one from your phone
          </p>

          {/* The potato points down at the code. */}
          <Clip
            src="/art/potato-point-qr.webm"
            poster="/art/potato-point-qr.png"
            width={300}
            height={380}
            className="-mb-3 h-[7.4rem] w-auto drop-shadow-md"
          />

          <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
            {uploadUrl ? (
              <QRCodeSVG value={uploadUrl} size={196} marginSize={0} />
            ) : (
              // Reserve the box so the panel doesn't jump once the URL resolves.
              <div className="h-[196px] w-[196px]" />
            )}
          </div>

          <p className="font-display text-sm font-bold uppercase tracking-wide text-ink/50">
            Scan to join the wall
          </p>
        </div>

        {/* Bottom section (40%) — sustainability, edge to edge. */}
        <div className="flex h-2/5 min-h-0 flex-col items-center justify-center gap-2 border-t-[3px] border-ink bg-brand-green/10 px-5 py-4">
          <Clip
            src={SUS_MASCOT_SRC}
            poster={SUS_MASCOT_POSTER}
            width={SUS_MASCOT_W}
            height={SUS_MASCOT_H}
            className="-mx-5 w-[calc(100%+2.5rem)] drop-shadow-md"
          />
          <p className="font-display text-2xl font-extrabold uppercase leading-none tracking-tight text-brand-green xl:text-3xl">
            Our most sustainable event
          </p>
          <p className="text-sm leading-snug text-ink/70">
            {SUSTAINABILITY_FACTS[factIdx]}
          </p>
        </div>
      </aside>
    </div>
  );
}

function GameScreen() {
  const setScreen = useBoothStore((s) => s.setScreen);
  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-5 py-8 text-center">
      <h2 className="text-shadow-brand font-display text-4xl font-extrabold uppercase tracking-tight text-ink">
        AR game
      </h2>
      <p className="text-base text-ink/70">
        Placeholder. The face-tracking &ldquo;catch the falling potatoes&rdquo;
        game mounts here — its logic lives in{" "}
        <code className="font-mono text-sm">lib/ar</code>.
      </p>
      <button
        onClick={() => setScreen("idle")}
        className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
      >
        Back
      </button>
    </div>
  );
}

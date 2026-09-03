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

      {/* Phone-upload panel — full height of the right side. */}
      <aside className="hidden h-full w-72 shrink-0 flex-col items-center justify-center gap-5 rounded-[26px] border-[3px] border-ink bg-cream-light p-6 text-center shadow-[6px_6px_0_var(--color-ink)] lg:flex">
        <Image
          src="/art/dfgn-logo.png"
          alt="DFGN"
          width={447}
          height={447}
          className="h-10 w-10"
        />

        <div>
          <p className="font-display text-2xl font-extrabold uppercase leading-tight tracking-tight text-ink">
            Send one from your phone
          </p>
          <p className="mt-2 text-sm text-ink/60">
            No queue, no waiting — it lands on the wall.
          </p>
        </div>

        {/* The potato points down at the code. */}
        <Clip
          src="/art/potato-pointing.mp4"
          poster="/art/potato-pointing-poster.jpg"
          width={320}
          height={328}
          className="w-28"
        />

        <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
          {uploadUrl ? (
            <QRCodeSVG value={uploadUrl} size={160} marginSize={0} />
          ) : (
            // Reserve the box so the panel doesn't jump once the URL resolves.
            <div className="h-[160px] w-[160px]" />
          )}
        </div>

        <p className="font-display text-sm font-bold uppercase tracking-wide text-ink/50">
          Scan to join the wall
        </p>

        {/* Sustainability: this digital booth is the low-waste choice. */}
        <div className="flex flex-col items-center gap-2 border-t-2 border-dashed border-ink/15 pt-4">
          <Clip
            src={SUS_MASCOT_SRC}
            poster={SUS_MASCOT_POSTER}
            width={SUS_MASCOT_W}
            height={SUS_MASCOT_H}
            className="h-24 w-auto drop-shadow-md"
          />
          <p className="font-display text-base font-extrabold uppercase leading-tight tracking-tight text-brand-green">
            Our most sustainable event
          </p>
          <p className="min-h-[3rem] text-xs leading-snug text-ink/60">
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

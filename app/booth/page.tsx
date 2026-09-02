"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { PhotoWall } from "@/components/booth/PhotoWall";
import { SelfCamera } from "@/components/booth/SelfCamera";
import { Clip } from "@/components/site/Clip";
import { FallingPotatoes } from "@/components/site/FallingPotatoes";
import { TopNav } from "@/components/site/TopNav";
import { useApprovedPhotos } from "@/lib/hooks/use-approved-photos";
import { useBoothStore } from "@/lib/stores/booth-store";

/**
 * Booth (kiosk) route.
 *
 * Screen switching is driven by `useBoothStore().screen`:
 *   - idle:   live photo wall + CTAs (self-camera, QR to /upload)
 *   - camera: self-camera capture
 *   - game:   AR mini-game (placeholder — see lib/ar)
 *
 * The chrome lives here rather than in each screen so the header, ground and
 * backdrop stay put while the screens swap underneath.
 */
export default function BoothPage() {
  const screen = useBoothStore((s) => s.screen);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream font-body text-ink">
      <TopNav />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />
        <FallingPotatoes />

        {screen === "camera" ? (
          <CameraScreen />
        ) : screen === "game" ? (
          <GameScreen />
        ) : (
          <IdleScreen />
        )}
      </main>
    </div>
  );
}

function IdleScreen() {
  const setScreen = useBoothStore((s) => s.setScreen);
  const { photos, loading, disabled } = useApprovedPhotos();

  // The QR points guests at THIS host's /upload. When the booth is opened via
  // the LAN URL, window.location.origin is already the right https://<ip>:port.
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  useEffect(() => {
    setUploadUrl(`${window.location.origin}/upload`);
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 py-8 lg:flex-row">
      {/* Live wall */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex items-baseline gap-3">
          <h1 className="text-shadow-brand font-display text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">
            The Spud Wall
          </h1>
          <p className="text-sm font-semibold text-ink/50">
            {loading
              ? "loading…"
              : `${photos.length} spud${photos.length === 1 ? "" : "s"}`}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto">
          <PhotoWall photos={photos} loading={loading} disabled={disabled} />
        </div>
      </section>

      {/* Ways in */}
      <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
        <button
          onClick={() => setScreen("camera")}
          className="group flex flex-col items-center rounded-[26px] border-[3px] border-ink bg-brand-yellow p-5 shadow-[6px_6px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
        >
          <div className="h-32 w-32 overflow-hidden border-[5px] border-brand-orange bg-cream-light [border-radius:48%_52%_45%_55%/55%_45%_55%_45%]">
            <Clip
              src="/art/potato-booth.mp4"
              poster="/art/potato-booth-poster.jpg"
              width={360}
              height={360}
              className="h-full w-full object-cover"
            />
          </div>
          <h2 className="mt-4 text-center font-display text-2xl font-extrabold uppercase tracking-tight text-ink">
            Take your photo
          </h2>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 font-display text-sm font-bold text-cream-light transition-transform group-hover:scale-[1.03]">
            Step up &amp; smile
          </span>
        </button>

        <div className="flex flex-col items-center rounded-[26px] border-[3px] border-ink bg-cream-light p-5 text-center shadow-[6px_6px_0_var(--color-ink)]">
          <div className="rotate-2 rounded-md border border-ink/15 bg-white p-1.5 pb-3 shadow-md shadow-ink/15">
            <Clip
              src="/art/potato-clicking.mp4"
              poster="/art/potato-clicking-poster.jpg"
              width={400}
              height={226}
              className="block w-40 rounded-sm"
            />
          </div>

          <p className="mt-4 font-display text-lg font-extrabold text-ink">
            Or send one from your phone
          </p>

          <div className="mt-3 rounded-xl border-[3px] border-ink bg-white p-2.5">
            {uploadUrl ? (
              <QRCodeSVG value={uploadUrl} size={150} marginSize={0} />
            ) : (
              // Reserve the box so the card doesn't jump once the URL resolves.
              <div className="h-[150px] w-[150px]" />
            )}
          </div>

          <p className="mt-3 text-sm text-ink/60">
            Scan to add your selfie to the wall
          </p>
        </div>
      </aside>
    </div>
  );
}

function CameraScreen() {
  const setScreen = useBoothStore((s) => s.setScreen);
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-5 py-8">
      <h2 className="text-shadow-brand font-display text-4xl font-extrabold uppercase tracking-tight text-ink">
        Say cheese!
      </h2>
      <SelfCamera onExit={() => setScreen("idle")} />
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
        game mounts here — its logic lives in <code className="font-mono text-sm">lib/ar</code>.
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

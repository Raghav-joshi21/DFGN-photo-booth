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
 *   - idle:   live camera on the left, photo wall + QR on the right
 *   - game:   AR mini-game (placeholder — see lib/ar)
 *
 * There is deliberately no separate camera screen: on a kiosk, making someone
 * press a button before the camera even turns on is a step for nothing. The
 * preview runs on the idle screen, so stepping up and hitting the countdown is
 * the whole interaction.
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

        {screen === "game" ? <GameScreen /> : <IdleScreen />}
      </main>
    </div>
  );
}

function IdleScreen() {
  const { photos, loading, disabled } = useApprovedPhotos();

  // The QR points guests at THIS host's /upload. When the booth is opened via
  // the LAN URL, window.location.origin is already the right https://<ip>:port.
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  useEffect(() => {
    setUploadUrl(`${window.location.origin}/upload`);
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-8 px-5 py-8 lg:flex-row">
      {/* Camera — live from the moment the booth opens, and the biggest thing
          on screen: it is what people walk up to. */}
      <section className="flex w-full shrink-0 flex-col lg:w-[34rem] xl:w-[40rem]">
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
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">
              Step up &amp; smile
            </h2>
            <p className="text-sm text-ink/60">
              Pick a filter, then hit the countdown.
            </p>
          </div>
        </header>

        <SelfCamera />
      </section>

      {/* Wall */}
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

      {/* Phone-upload rail: the potato points down at the code it is about. */}
      <aside className="flex w-full shrink-0 flex-col items-center lg:w-64">
        <div className="flex flex-col items-center rounded-[26px] border-[3px] border-ink bg-cream-light p-4 pt-2 text-center shadow-[6px_6px_0_var(--color-ink)]">
          {/* Inside the card, not above it: the clip is flattened onto the
              card's cream (video has no alpha), so on the page's gradient
              ground its rectangle would show. */}
          <Clip
            src="/art/potato-pointing.mp4"
            poster="/art/potato-pointing-poster.jpg"
            width={320}
            height={328}
            className="w-32"
          />

          <p className="font-display text-lg font-extrabold leading-tight text-ink">
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

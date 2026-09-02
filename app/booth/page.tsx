"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { PhotoWall } from "@/components/booth/PhotoWall";
import { SelfCamera } from "@/components/booth/SelfCamera";
import { useApprovedPhotos } from "@/lib/hooks/use-approved-photos";
import { useBoothStore } from "@/lib/stores/booth-store";

/**
 * Booth (kiosk) route.
 *
 * Screen switching is driven by `useBoothStore().screen`:
 *   - idle:   live photo wall + CTAs (self-camera, QR to /upload)
 *   - camera: self-camera capture
 *   - game:   AR mini-game (placeholder — see lib/ar)
 */
export default function BoothPage() {
  const screen = useBoothStore((s) => s.screen);

  if (screen === "camera") return <CameraScreen />;
  if (screen === "game") return <GameScreen />;
  return <IdleScreen />;
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
    <main className="flex flex-1 flex-col gap-8 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight">DFGN Photo Booth</h1>
        <p className="text-sm opacity-50">RTU Design Factory</p>
      </header>

      <div className="flex flex-1 flex-col gap-8 lg:flex-row">
        {/* Live wall */}
        <section className="flex-1 overflow-y-auto">
          <PhotoWall photos={photos} loading={loading} disabled={disabled} />
        </section>

        {/* CTAs */}
        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-72">
          <button
            onClick={() => setScreen("camera")}
            className="rounded-3xl bg-foreground px-6 py-8 text-xl font-semibold text-background transition-opacity hover:opacity-90"
          >
            📸 Take your photo
          </button>

          <div className="flex flex-col items-center gap-3 rounded-3xl border border-foreground/15 p-6 text-center">
            <p className="text-sm font-medium">Or upload from your phone</p>
            <div className="rounded-xl bg-white p-3">
              {uploadUrl ? (
                <QRCodeSVG value={uploadUrl} size={168} marginSize={0} />
              ) : (
                <div className="h-[168px] w-[168px]" />
              )}
            </div>
            <p className="text-xs opacity-50">
              Scan to add your selfie to the wall
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function CameraScreen() {
  const setScreen = useBoothStore((s) => s.setScreen);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h2 className="text-2xl font-bold tracking-tight">Say cheese!</h2>
      <SelfCamera onExit={() => setScreen("idle")} />
    </main>
  );
}

function GameScreen() {
  const setScreen = useBoothStore((s) => s.setScreen);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h2 className="text-2xl font-bold tracking-tight">AR game</h2>
      <p className="max-w-md text-sm opacity-60">
        Placeholder. The face-tracking &ldquo;catch the falling potatoes&rdquo;
        game mounts here — its logic lives in <code>lib/ar</code>.
      </p>
      <button
        onClick={() => setScreen("idle")}
        className="rounded-full border border-foreground/20 px-6 py-3 font-medium hover:bg-foreground/5"
      >
        Back
      </button>
    </main>
  );
}

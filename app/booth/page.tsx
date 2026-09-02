"use client";

import { motion } from "framer-motion";

import { useBoothStore } from "@/lib/stores/booth-store";

/**
 * Booth (kiosk) route.
 *
 * This is the big screen shown at the event. It will eventually host:
 *   - an idle loop showing the live wall of approved photos,
 *   - a self-camera capture mode,
 *   - AR mini-game screens (see `lib/ar`).
 *
 * The active screen is driven by `useBoothStore().screen`. For now this is a
 * placeholder shell that proves the store + animations are wired up.
 */
export default function BoothPage() {
  const screen = useBoothStore((s) => s.screen);
  const setScreen = useBoothStore((s) => s.setScreen);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold tracking-tight"
      >
        Booth — {screen}
      </motion.h1>

      <p className="max-w-md text-center text-sm opacity-60">
        Kiosk display shell. Idle photo wall, self-camera capture, and AR games
        will mount here based on the active screen.
      </p>

      <div className="flex gap-3">
        {(["idle", "camera", "game"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            className={`rounded-full border px-5 py-2 text-sm capitalize transition-colors ${
              screen === s
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 hover:bg-foreground/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </main>
  );
}

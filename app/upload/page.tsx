"use client";

import { motion } from "framer-motion";

/**
 * Upload route (mobile-facing).
 *
 * Guests reach this page by scanning a QR code shown on the booth. They pick /
 * take a selfie on their own phone; it is uploaded to Supabase Storage, sent
 * through `/api/moderate` and `/api/ai-edit`, and — once approved — appears on
 * the booth wall.
 *
 * This is a placeholder shell. The real flow (file input, upload progress,
 * status polling / Realtime) gets built on top of this. Designed mobile-first;
 * this route is also where the PWA manifest / installability will hang.
 */
export default function UploadPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold tracking-tight">Add your selfie</h1>
        <p className="text-sm opacity-60">
          Upload a photo from your phone. We&apos;ll give it an AI makeover and
          put it up on the big screen.
        </p>
      </motion.div>

      <button
        disabled
        className="w-full rounded-full bg-foreground px-6 py-3 font-medium text-background opacity-40"
      >
        Choose a photo (coming soon)
      </button>
    </main>
  );
}

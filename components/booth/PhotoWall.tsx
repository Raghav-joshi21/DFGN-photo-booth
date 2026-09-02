"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Polaroid } from "@/components/Polaroid";
import type { Photo } from "@/types";

/** Deterministic small tilt per photo so the wall looks hand-pinned but stable. */
function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // Range roughly [-6, 6] degrees.
  return ((Math.abs(hash) % 1300) / 100) - 6;
}

/**
 * The live wall of approved photos, laid out as a tilted Polaroid grid.
 * New photos animate in (they arrive prepended from the Realtime hook).
 */
export function PhotoWall({
  photos,
  loading,
  disabled,
}: {
  photos: Photo[];
  loading: boolean;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <EmptyState
        title="Supabase not configured"
        body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server."
      />
    );
  }

  if (loading) {
    return <EmptyState title="Loading the wall…" />;
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        title="No photos yet"
        body="Approved photos will appear here live. Take a photo or scan the QR code to be the first."
      />
    );
  }

  return (
    <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <AnimatePresence initial={false}>
        {photos.map((photo) => (
          <motion.div
            key={photo.id}
            layout
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          >
            <Polaroid photo={photo} rotation={tiltFor(photo.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-medium opacity-80">{title}</p>
      {body ? <p className="max-w-sm text-sm opacity-50">{body}</p> : null}
    </div>
  );
}

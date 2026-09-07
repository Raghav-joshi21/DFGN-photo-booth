"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { PotatoFrame } from "@/components/booth/PotatoFrame";
import type { Photo } from "@/types";

/** Deterministic small tilt per photo so the wall looks hand-pinned but stable. */
function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // Range roughly [-6, 6] degrees.
  return ((Math.abs(hash) % 1300) / 100) - 6;
}

/** Best filename we can offer for a saved photo. */
function fileNameFor(photo: Photo): string {
  const url = photo.editedUrl ?? photo.originalUrl;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = /^(jpg|jpeg|png|webp)$/.test(ext) ? ext : "jpg";
  return `unboxed-2026-${photo.id.slice(0, 8)}.${safeExt}`;
}

/**
 * The live wall of approved photos, in the booth's own house frame.
 *
 * Laid out in CSS columns rather than a grid: the prints keep each photo's own
 * aspect ratio, so rows of a grid would leave ragged gaps under the shorter
 * ones. Columns let a tall portrait and a wide landscape sit side by side and
 * still pack tightly.
 *
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
  const [preview, setPreview] = useState<Photo | null>(null);

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
    <>
      <div className="columns-2 gap-5 sm:columns-3 lg:columns-4 xl:columns-5">
        <AnimatePresence initial={false}>
          {photos.map((photo) => (
            <motion.div
              key={photo.id}
              layout
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              // A column child that splits across the break renders as two
              // half-prints; this keeps each one whole.
              className="mb-5 break-inside-avoid"
            >
              <button
                type="button"
                onClick={() => setPreview(photo)}
                aria-label="Open this photo"
                className="block w-full rounded-lg transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
              >
                <PotatoFrame photo={photo} rotation={tiltFor(photo.id)} natural />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Lightbox photo={preview} onClose={() => setPreview(null)} />
    </>
  );
}

/**
 * Full-screen view of one photo, with a save button.
 *
 * Rendered outside the columns so it is not clipped by them, and closed by
 * Escape or a click on the backdrop as well as the button — on a phone the
 * backdrop is the biggest target there is.
 */
function Lightbox({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll under the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [photo, onClose]);

  useEffect(() => setSaveError(null), [photo]);

  const save = useCallback(async () => {
    if (!photo) return;
    const url = photo.editedUrl ?? photo.originalUrl;
    setSaving(true);
    setSaveError(null);
    try {
      // Fetched into a blob first: `download` is ignored on a cross-origin
      // href, and the photos are served from Supabase, so linking straight at
      // the file would navigate to it instead of saving it.
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`fetch failed (${res.status})`);
      const objectUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileNameFor(photo);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick: revoking immediately can cancel the save.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      console.warn("[gallery] could not save the photo", err);
      // Opening the file is the honest fallback — from there a long-press or
      // right-click saves it, which is also what iOS wants for camera-roll.
      window.open(url, "_blank", "noopener");
      setSaveError("Opened the photo in a new tab — press and hold it to save.");
    } finally {
      setSaving(false);
    }
  }, [photo]);

  return (
    <AnimatePresence>
      {photo ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/85 p-4 backdrop-blur-sm sm:p-8"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            // The photo itself must not close the overlay from under a
            // long-press-to-save.
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-0 w-full max-w-3xl flex-col items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.editedUrl ?? photo.originalUrl}
              alt="Photo from the wall"
              className="max-h-[70vh] w-auto max-w-full rounded-xl border-[3px] border-cream-light object-contain shadow-2xl"
            />

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border-[3px] border-ink bg-brand-orange px-6 py-2.5 font-display font-bold text-white shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                <DownloadIcon className="h-4 w-4" />
                {saving ? "Saving…" : "Save photo"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Close
              </button>
            </div>

            {saveError ? (
              <p className="text-center text-sm text-cream-light/90">{saveError}</p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} role="presentation">
      <path
        d="M12 3.5v11m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16.5v1.8a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 2.2-2.2v-1.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-2 text-center">
      <p className="font-display text-xl font-extrabold text-ink">{title}</p>
      {body ? <p className="max-w-sm text-sm text-ink/60">{body}</p> : null}
    </div>
  );
}

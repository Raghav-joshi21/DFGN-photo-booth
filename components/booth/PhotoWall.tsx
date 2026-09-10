"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import Image from "next/image";

import { PotatoFrame } from "@/components/booth/PotatoFrame";
import { FallingPotatoes } from "@/components/site/FallingPotatoes";
import { FallingStickers } from "@/components/site/FallingStickers";
import type { Photo } from "@/types";

/**
 * Deterministic small tilt per photo so the wall looks hand-pinned but stable.
 *
 * Kept to a few degrees: a rotated print sticks out sideways beyond its column,
 * and at two columns on a phone the old +/-6 was enough to push the page into a
 * horizontal scroll.
 */
function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // Range roughly [-2.5, 2.5] degrees.
  return ((Math.abs(hash) % 500) / 100) - 2.5;
}

/**
 * Deterministic "featured" flag: roughly one print in five is promoted to a
 * double-width tile so the wall reads as a hand-arranged mosaic — some big,
 * some small — instead of a uniform grid. Keyed off the id so a given photo
 * keeps its size as the wall grows live.
 */
function featuredFor(id: string): boolean {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 131 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % 5 === 0;
}

/** Best filename we can offer for a saved photo. */
function fileNameFor(photo: Photo): string {
  const url = photo.editedUrl ?? photo.originalUrl;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = /^(jpg|jpeg|png|webp)$/.test(ext) ? ext : "jpg";
  return `unboxed-2026-${photo.id.slice(0, 8)}.${safeExt}`;
}

/** Grid metrics — must match the Tailwind classes on the mosaic container. */
const CELL_GAP = 12; // gap-3
const CELL_ROW = 8; // [grid-auto-rows:8px]

/**
 * The live wall of approved photos, in the booth's own house frame.
 *
 * Laid out as a dense CSS grid: each print measures its own height once the
 * image loads and claims that many row-tracks, so tall portraits and wide
 * landscapes pack tightly with no ragged gaps, and a few "featured" prints
 * span two columns to break the rhythm. The whole surface reacts to the
 * pointer — prints lean toward the cursor, a warm spotlight follows it — and
 * a Slideshow button hands the wall to a big screen.
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
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [slideshow, setSlideshow] = useState(false);
  const [slideStartId, setSlideStartId] = useState<string | null>(null);

  const startSlideshow = useCallback((id: string | null) => {
    setPreviewId(null);
    setSlideStartId(id);
    setSlideshow(true);
  }, []);

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
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <button
          type="button"
          onClick={() => startSlideshow(null)}
          className="inline-flex items-center gap-2 rounded-full border-[3px] border-ink bg-brand-yellow px-5 py-2 font-display text-sm font-extrabold uppercase tracking-wide text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
        >
          <PlayIcon className="h-4 w-4" />
          Slideshow
        </button>
      </div>

      <div
        className="gallery-surface relative"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
      >
        <div aria-hidden className="gallery-spotlight" />

        <div className="relative z-[1] grid gap-3 [grid-auto-rows:8px] [grid-template-columns:repeat(auto-fill,minmax(clamp(10.5rem,16vw,17rem),1fr))]">
          <AnimatePresence initial={false}>
            {photos.map((photo, index) => (
              <MasonryItem
                key={photo.id}
                photo={photo}
                index={index}
                featured={featuredFor(photo.id)}
                onOpen={() => setPreviewId(photo.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <Lightbox
        photos={photos}
        openId={previewId}
        onOpenId={setPreviewId}
        onClose={() => setPreviewId(null)}
        onPlay={startSlideshow}
      />

      <Slideshow
        photos={photos}
        open={slideshow}
        startId={slideStartId}
        onClose={() => setSlideshow(false)}
      />
    </>
  );
}

/**
 * One print in the mosaic.
 *
 * CSS grid packs tiles of different heights tightly only if each tile says how
 * many row-tracks it spans — there is no `masonry` value we can rely on in a
 * shipping browser yet. So the print is measured after its image loads and the
 * span is derived from that height; a ResizeObserver keeps it right through
 * viewport changes and across the featured tiles' extra width.
 */
function MasonryItem({
  photo,
  index,
  featured,
  onOpen,
}: {
  photo: Photo;
  index: number;
  featured: boolean;
  onOpen: () => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(30);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const recalc = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        setSpan(Math.max(4, Math.ceil((h + CELL_GAP) / (CELL_ROW + CELL_GAP))));
      }
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.85, y: -16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 24,
        delay: Math.min(index * 0.025, 0.35),
      }}
      style={{ gridRowEnd: `span ${span}` }}
      className={`min-w-0 ${featured ? "sm:col-span-2" : ""}`}
    >
      <div ref={measureRef}>
        <TiltCard onOpen={onOpen}>
          <PotatoFrame photo={photo} rotation={tiltFor(photo.id)} natural />
        </TiltCard>
      </div>
    </motion.div>
  );
}

/**
 * Wraps a print in a pointer-reactive 3D tilt: the card leans toward the
 * cursor and lifts, then eases back on leave. Driven entirely through CSS
 * custom properties so the work per pointer move is two `setProperty` calls
 * inside one rAF — no React re-render. The stylesheet disables it wholesale
 * under prefers-reduced-motion.
 */
function TiltCard({
  onOpen,
  children,
}: {
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const frame = useRef(0);

  const onMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(nx * 10).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-ny * 8).toFixed(2)}deg`);
      el.style.setProperty("--lift", "-8px");
    });
  }, []);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--lift", "0px");
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onBlur={reset}
      aria-label="Open this photo"
      className="tilt-card block w-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
    >
      {children}
    </button>
  );
}

/** How far, or how fast, a drag has to go before it counts as a swipe. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

/**
 * Full-screen view of one photo: swipe or arrow through the wall, save the one
 * you are looking at, or hand it to the slideshow.
 *
 * Addressed by photo id rather than list index. The wall grows live from the
 * Realtime hook, and every arriving photo prepends — with an index the viewer
 * would be silently moved to a different picture mid-look.
 *
 * Rendered outside the columns so it is not clipped by them, and closed by
 * Escape or a click on the backdrop as well as the button — on a phone the
 * backdrop is the biggest target there is.
 */
function Lightbox({
  photos,
  openId,
  onOpenId,
  onClose,
  onPlay,
}: {
  photos: Photo[];
  openId: string | null;
  onOpenId: (id: string) => void;
  onClose: () => void;
  onPlay: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // +1 when moving forward, -1 back: the photo slides in from the side it
  // came from, so the direction of travel is legible.
  const [direction, setDirection] = useState(1);

  const index = openId ? photos.findIndex((p) => p.id === openId) : -1;
  const photo = index >= 0 ? photos[index] : null;

  const go = useCallback(
    (delta: number) => {
      if (index < 0 || photos.length < 2) return;
      setDirection(delta);
      // Wraps, so neither end of the wall is a dead stop.
      onOpenId(photos[(index + delta + photos.length) % photos.length].id);
    },
    [index, photos, onOpenId],
  );

  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll under the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [photo, onClose, go]);

  // The open photo was removed from the wall underneath us.
  useEffect(() => {
    if (openId && index < 0) onClose();
  }, [openId, index, onClose]);

  useEffect(() => setSaveError(null), [openId]);

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
            {/* Swipe area.
                The drag sits on the wrapper and the entrance on the image so
                the two never share a transform, and the entrance is a CSS
                animation rather than a JS one: its resting state is the
                element's normal state, so the worst a failed animation can do
                is skip the slide — it cannot leave a photo stuck invisible.
                There is deliberately no exit animation; one image is mounted
                at a time, which keeps the swipe gesture unambiguous. */}
            <div className="relative flex w-full items-center justify-center">
              <motion.div
                drag={photos.length > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  const far = Math.abs(info.offset.x) > SWIPE_DISTANCE;
                  const fast = Math.abs(info.velocity.x) > SWIPE_VELOCITY;
                  if (!far && !fast) return;
                  // Dragging left pulls the next photo in from the right.
                  go(info.offset.x < 0 ? 1 : -1);
                }}
                className="flex cursor-grab touch-pan-y items-center justify-center active:cursor-grabbing"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={photo.id}
                  src={photo.editedUrl ?? photo.originalUrl}
                  alt="Photo from the wall"
                  // Chrome's native image drag would pre-empt the gesture.
                  draggable={false}
                  style={
                    {
                      "--photo-swap-from": `${direction * 40}px`,
                    } as React.CSSProperties
                  }
                  className="photo-swap max-h-[70vh] w-auto max-w-full rounded-xl border-[3px] border-cream-light object-contain shadow-2xl"
                />
              </motion.div>

              {photos.length > 1 ? (
                <>
                  <ArrowButton side="left" onClick={() => go(-1)} />
                  <ArrowButton side="right" onClick={() => go(1)} />
                </>
              ) : null}
            </div>

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
                onClick={() => onPlay(photo.id)}
                className="inline-flex items-center gap-2 rounded-full border-[3px] border-ink bg-brand-yellow px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                <PlayIcon className="h-4 w-4" />
                Slideshow
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Close
              </button>
            </div>

            {photos.length > 1 ? (
              <p className="font-display text-xs font-bold uppercase tracking-wide text-cream-light/60">
                {index + 1} / {photos.length}
                <span className="ml-2 font-body normal-case tracking-normal opacity-70">
                  swipe or use ← →
                </span>
              </p>
            ) : null}

            {saveError ? (
              <p className="text-center text-sm text-cream-light/90">{saveError}</p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Seconds each slide holds before the wall advances on its own. */
const SLIDE_MS = 5200;

/**
 * Full-bleed auto-advancing slideshow over the whole wall — the "big screen"
 * mode.
 *
 * Each slide crossfades in over a slow Ken Burns push, alternating pan
 * direction so consecutive photos don't drift the same way. Space toggles
 * play/pause, arrows step, Escape closes, and the backdrop is a close target.
 * Under prefers-reduced-motion the push and pan drop out and slides simply
 * fade. Addressed by index into a list that only grows at the front, so a
 * photo arriving mid-show nudges the index rather than swapping the picture.
 */
function Slideshow({
  photos,
  open,
  startId,
  onClose,
}: {
  photos: Photo[];
  open: boolean;
  startId: string | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const count = photos.length;

  // Real Fullscreen API, not just a fixed overlay — this is meant to be
  // handed to a big screen. Best-effort: some browsers (notably iOS Safari)
  // don't support it at all, so the toggle just no-ops there rather than
  // throwing, and the slideshow works fine without it either way.
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);
  // Leaving the slideshow shouldn't strand the browser in fullscreen.
  useEffect(() => {
    if (!open && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [open]);

  // Jump to the requested start photo (or the top of the wall) each time the
  // show opens.
  useEffect(() => {
    if (!open) return;
    const at = startId ? photos.findIndex((p) => p.id === startId) : 0;
    setI(at >= 0 ? at : 0);
    setPlaying(true);
  }, [open, startId, photos]);

  const go = useCallback(
    (delta: number) => {
      if (count < 1) return;
      setI((n) => (n + delta + count) % count);
    },
    [count],
  );

  // Auto-advance while playing.
  useEffect(() => {
    if (!open || !playing || count < 2) return;
    const t = window.setTimeout(() => go(1), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [open, playing, i, count, go]);

  // Keys + scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, go]);

  // The wall shrank past the current index.
  useEffect(() => {
    if (open && count > 0 && i >= count) setI(count - 1);
  }, [open, i, count]);

  const photo = count > 0 ? photos[Math.min(i, count - 1)] : null;
  const dir = i % 2 === 0 ? 1 : -1;

  // True full-bleed now — object-cover fills the whole screen edge to edge,
  // so the Ken Burns push can be bigger without ever showing a gap.
  const slide = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.6 } },
        transition: { duration: 0.6, ease: "easeInOut" as const },
      }
    : {
        initial: { opacity: 0, scale: 1.06 },
        animate: { opacity: 1, scale: 1.18, x: -26 * dir, y: -14 * dir },
        exit: { opacity: 0, transition: { duration: 0.9, ease: "easeInOut" as const } },
        transition: {
          opacity: { duration: 1, ease: "easeInOut" as const },
          default: { duration: SLIDE_MS / 1000 + 1.5, ease: "linear" as const },
        },
      };

  return (
    <AnimatePresence>
      {open && photo ? (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Gallery slideshow"
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-[radial-gradient(140%_120%_at_50%_45%,#3a0e10_0%,#1c0607_55%,#080202_100%)]"
        >
          {/* Ambient brand backdrop — the same falling potatoes/stickers as
              the rest of the site, dialled right down so the room reads as
              "the booth, at night" instead of a generic black lightbox. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-screen">
            <FallingPotatoes />
            <FallingStickers />
          </div>

          {/* Brand chip, top-left — this is still "the booth", just handed to
              a big screen. */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
            <Image
              src="/art/idfw26-latvia-logo-light.png"
              alt=""
              aria-hidden
              width={2263}
              height={870}
              className="h-6 w-auto opacity-90 sm:h-7"
            />
            <span className="hidden font-display text-xs font-bold uppercase tracking-wide text-cream-light/60 sm:inline">
              Gallery Slideshow
            </span>
          </div>

          {playing && count > 1 ? (
            <div className="absolute inset-x-4 top-4 z-10 h-1.5 overflow-hidden rounded-full bg-white/10 sm:inset-x-6">
              <motion.div
                key={`${i}-bar`}
                className="h-full origin-left rounded-full bg-gradient-to-r from-brand-orange to-brand-yellow"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
              />
            </div>
          ) : null}

          {/* Coverflow-style: the neighbours peek in from the sides, so the
              wall reads as one continuous strip rather than a single slide
              in a void. Hidden below `lg` — there's no room to spare, and the
              swipeable Lightbox already covers phones/tablets. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 px-3 lg:gap-6 lg:px-8">
            <SidePeek photo={prevPhoto} onClick={() => go(-1)} />

            <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
              <AnimatePresence initial={false}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  key={photo.id}
                  src={photo.editedUrl ?? photo.originalUrl}
                  alt=""
                  draggable={false}
                  initial={slide.initial}
                  animate={slide.animate}
                  exit={slide.exit}
                  transition={slide.transition}
                  style={{ rotate: `${tiltFor(photo.id) * 1.6}deg` }}
                  className="absolute max-h-[82vh] max-w-[86vw] rounded-lg border-[6px] border-cream-light object-contain shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)] lg:max-w-[64vw]"
                />
              </AnimatePresence>
            </div>

            <SidePeek photo={nextPhoto} onClick={() => go(1)} />
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border-[3px] border-ink bg-cream-light px-2 py-1.5 shadow-[3px_3px_0_rgba(0,0,0,0.4)]"
          >
            <SlideCtl label="Previous photo" onClick={() => go(-1)}>
              <Chevron side="left" />
            </SlideCtl>
            <SlideCtl
              label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </SlideCtl>
            <SlideCtl label="Next photo" onClick={() => go(1)}>
              <Chevron side="right" />
            </SlideCtl>
            <span className="px-2 font-display text-xs font-bold text-ink/70">
              {Math.min(i + 1, count)} / {count}
            </span>
            <span className="h-5 w-px bg-ink/15" aria-hidden />
            <SlideCtl
              label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
            >
              <FullscreenIcon className="h-4 w-4" exit={isFullscreen} />
            </SlideCtl>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close slideshow"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-cream-light text-lg text-ink shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition-transform hover:scale-105"
          >
            ✕
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A single round control in the slideshow's toolbar. */
function SlideCtl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/10"
    >
      {children}
    </button>
  );
}

/**
 * A neighbouring photo, peeking in from the slideshow's edge — the
 * "coverflow" side frame. Purely decorative-but-clickable: tapping one jumps
 * straight to it, same as the arrow it sits next to.
 */
function SidePeek({ photo, onClick }: { photo: Photo | null; onClick: () => void }) {
  if (!photo) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="Jump to this photo"
      className="pointer-events-auto relative hidden h-[64vh] w-[14vw] shrink-0 overflow-hidden rounded-lg border-4 border-cream-light/30 opacity-45 blur-[1.5px] grayscale-[0.15] transition-all duration-300 hover:opacity-70 hover:blur-0 hover:grayscale-0 lg:block"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.editedUrl ?? photo.originalUrl}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

/** Prev/next control, sitting just inside the photo's edge. */
function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/40 bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-105 sm:flex ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <Chevron side={side} className="h-6 w-6" />
    </button>
  );
}

function Chevron({
  side,
  className = "h-5 w-5",
}: {
  side: "left" | "right";
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="presentation">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="presentation">
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
    </svg>
  );
}

/** Four corner brackets — expand when off, pinch inward when already
 *  fullscreen (so the icon itself hints at "exit"). */
function FullscreenIcon({ className = "", exit = false }: { className?: string; exit?: boolean }) {
  const d = exit
    ? "M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4"
    : "M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4";
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} role="presentation">
      <path d={d} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

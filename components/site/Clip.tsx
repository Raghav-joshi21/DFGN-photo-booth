"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * A looping decorative clip, with a still swapped in under
 * prefers-reduced-motion (an autoplaying video is motion too).
 *
 * The clips are muted and `playsInline` because that is what browsers require
 * before they will autoplay at all, and `aria-hidden` because they carry no
 * information — the surrounding copy does.
 *
 * ## Transparency
 *
 * No single video format carries an alpha channel everywhere:
 *
 * - **VP9 in WebM** carries alpha for Chrome, Firefox and Android.
 * - **HEVC in MP4** carries alpha for WebKit — Safari, and every browser on
 *   iOS, since they are all WebKit underneath.
 *
 * Neither engine reads the other's. Listing both as `<source>` elements does
 * not work: Chrome can often *play* HEVC and would pick it, silently dropping
 * the alpha and painting a black box; iOS 17.4+ can play VP9 WebM but ignores
 * its alpha layer, painting the baked background instead. So the engine is
 * detected and the matching file chosen outright.
 *
 * `navigator.vendor` is the signal because it identifies the *engine*, which
 * is what actually decides here — every iOS browser reports Apple and every
 * iOS browser is WebKit, so they all want the MP4 and all get it right.
 *
 * Clips with no transparency (a plain MP4, no `mp4Alpha`) skip all of this.
 */
export function Clip({
  src,
  mp4Alpha,
  poster,
  width,
  height,
  className = "",
}: {
  /** Default source. For transparent clips this is the VP9/WebM one. */
  src: string;
  /** HEVC-with-alpha MP4, used on WebKit. Omit for clips without alpha. */
  mp4Alpha?: string;
  poster: string;
  /** Intrinsic size of the source, so the still reserves the same box. */
  width: number;
  height: number;
  className?: string;
}) {
  // Server-render the WebM and correct on mount: guessing the engine before
  // hydration would risk a mismatch, and the swap is one frame on WebKit only.
  const [isWebKit, setIsWebKit] = useState(false);
  useEffect(() => {
    setIsWebKit(/^Apple/.test(navigator.vendor ?? ""));
  }, []);

  const chosen = isWebKit && mp4Alpha ? mp4Alpha : src;

  return (
    <>
      <video
        // Keyed on the source so flipping to the MP4 reloads the element;
        // changing `src` alone does not restart an already-playing video.
        key={chosen}
        className={`motion-video ${className}`}
        src={chosen}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />
      <Image
        src={poster}
        alt=""
        aria-hidden
        width={width}
        height={height}
        className={`motion-still ${className}`}
      />
    </>
  );
}

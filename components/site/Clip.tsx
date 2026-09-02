import Image from "next/image";

/**
 * A looping decorative clip, with a still swapped in under
 * prefers-reduced-motion (an autoplaying video is motion too).
 *
 * The clips are muted and `playsInline` because that is what browsers require
 * before they will autoplay at all, and `aria-hidden` because they carry no
 * information — the surrounding copy does.
 */
export function Clip({
  src,
  poster,
  width,
  height,
  className = "",
}: {
  src: string;
  poster: string;
  /** Intrinsic size of the source, so the still reserves the same box. */
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <>
      <video
        className={`motion-video ${className}`}
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
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

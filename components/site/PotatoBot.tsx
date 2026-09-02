"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The potato mascot: lives on the header, slides along it, and pops a bubble
 * with a bad potato joke. Always upright — it slides, it never rolls.
 *
 * Notes on the implementation:
 *  - Renders nothing until mounted. Its position and joke are random or
 *    width-derived, so server-rendering would guarantee a hydration mismatch.
 *    A decorative overlay can afford to appear a tick late.
 *  - It hangs off the header's bottom edge rather than sitting inside the bar.
 *    At the header's 64px height a potato big enough to read would cover the
 *    nav links as it slid past them; hanging below keeps the whole width
 *    available to slide across without ever obscuring a control.
 *  - The slide is a transform transition on the wrapper while the bob is a
 *    separate keyframe on a child, so the two never fight over `transform`.
 *  - Honours prefers-reduced-motion: it stays put and still tells jokes, so the
 *    content is never gated behind the animation.
 */

const JOKES = [
  "Why did the potato cross the road? It saw a fork ahead! 🍴",
  "You look absolutely a-peeling today. 😍",
  "Spud you like to take a photo? 📸",
  "I'm rooting for you! 🌱",
  "Chip chip hooray! 🎉",
  "I yam what I yam. 💪",
  "Don't be a small fry — smile big! 😁",
  "I find this whole thing very a-mash-ing. 🥔",
  "Eyes on me. I've got plenty of them. 👀",
  "Baked, mashed or fried — I'm flattered either way. 🔥",
  "Just sliding through. 😎",
  "Let's get this party star-ch-ed. 🎊",
  "You're one in a mash-illion. ✨",
  "No filter needed. I'm naturally this good looking. 💅",
];

const BOT_PX = 46;
/** Must match the CSS transition below, so the joke lands after the slide. */
const SLIDE_MS = 2200;
const JOKE_MS = 7500;
const CYCLE_MS = 15000;

export function PotatoBot() {
  const [mounted, setMounted] = useState(false);
  // False for the first frame so the initial placement doesn't animate.
  const [placed, setPlaced] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reduced, setReduced] = useState(false);

  const [x, setX] = useState(0);
  const [joke, setJoke] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const jokeRef = useRef<number | null>(null);

  const maxX = Math.max(0, trackWidth - BOT_PX);

  useEffect(() => {
    setMounted(true);

    const measure = () => {
      const width = trackRef.current?.clientWidth ?? 0;
      setTrackWidth(width);
      const limit = Math.max(0, width - BOT_PX);
      if (xRef.current > limit) {
        xRef.current = limit;
        setX(limit);
      }
    };

    measure();
    // Park at the right-hand end of the header to begin with.
    const start = Math.max(0, (trackRef.current?.clientWidth ?? 0) - BOT_PX);
    xRef.current = start;
    setX(start);

    const raf = requestAnimationFrame(() => setPlaced(true));

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onMotion = (e: MediaQueryListEvent) => setReduced(e.matches);
    media.addEventListener("change", onMotion);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener("change", onMotion);
      window.removeEventListener("resize", measure);
    };
  }, []);

  /** Pick a joke that isn't the one already showing. */
  const speak = useCallback(() => {
    let next = Math.floor(Math.random() * JOKES.length);
    if (next === jokeRef.current) next = (next + 1) % JOKES.length;
    jokeRef.current = next;
    setJoke(next);
  }, []);

  // Autonomous loop: slide somewhere new, tell a joke, go quiet.
  useEffect(() => {
    if (!mounted || dismissed) return;

    let cancelled = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    };

    const tellThenHide = () => {
      speak();
      after(JOKE_MS, () => setJoke(null));
    };

    const cycle = () => {
      const limit = Math.max(0, (trackRef.current?.clientWidth ?? 0) - BOT_PX);
      if (reduced || limit === 0) {
        tellThenHide();
      } else {
        const target = Math.round(Math.random() * limit);
        xRef.current = target;
        setX(target);
        after(SLIDE_MS, tellThenHide);
      }
      after(CYCLE_MS, cycle);
    };

    after(1800, () => {
      tellThenHide();
      after(CYCLE_MS - JOKE_MS, cycle);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [mounted, dismissed, reduced, speak]);

  // Keep the bubble on screen when the bot is near either end of the track.
  const nearLeft = x < 130;
  const nearRight = maxX > 0 && x > maxX - 130;
  const bubblePosition = nearLeft
    ? "left-0"
    : nearRight
      ? "right-0"
      : "left-1/2 -translate-x-1/2";
  const tailPosition = nearLeft
    ? "left-7"
    : nearRight
      ? "right-7"
      : "left-1/2 -translate-x-1/2";

  return (
    <div
      ref={trackRef}
      aria-hidden={dismissed || undefined}
      className="pointer-events-none absolute inset-x-4 -bottom-4 z-30 h-0"
    >
      {mounted && !dismissed ? (
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translateX(${x}px)`,
            transition:
              reduced || !placed
                ? "none"
                : `transform ${SLIDE_MS}ms cubic-bezier(.42,.02,.34,1)`,
          }}
        >
          <div className="potato-bot-bob relative">
            <button
              type="button"
              onClick={speak}
              aria-label="Potato bot — tap for a joke"
              className="pointer-events-auto block rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
            >
              <Image
                src="/art/potato-bot.png"
                alt=""
                width={147}
                height={177}
                className="h-[46px] w-auto drop-shadow-md"
              />
            </button>

            {joke !== null ? (
              <div
                role="status"
                aria-live="polite"
                className={`potato-bot-bubble pointer-events-auto absolute top-full mt-2.5 w-56 rounded-2xl border-[3px] border-ink bg-cream-light px-3.5 py-2.5 shadow-[4px_4px_0_var(--color-ink)] ${bubblePosition}`}
              >
                <p className="font-body text-sm font-semibold leading-snug text-ink">
                  {JOKES[joke]}
                </p>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  aria-label="Hide the potato bot"
                  className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-cream-light text-xs font-bold text-ink transition-colors hover:bg-brand-orange hover:text-white"
                >
                  ✕
                </button>
                {/* Tail, pointing up at the bot. */}
                <span
                  aria-hidden
                  className={`absolute -top-2 h-3 w-3 rotate-45 border-l-[3px] border-t-[3px] border-ink bg-cream-light ${tailPosition}`}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

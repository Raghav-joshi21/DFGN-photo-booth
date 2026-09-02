"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The potato mascot: idles in the corner, rolls across the bottom of the
 * screen, and pops a bubble with a bad potato joke.
 *
 * Notes on the implementation:
 *  - Renders nothing until mounted. Everything about it (position, which joke)
 *    is random or viewport-derived, so rendering on the server would guarantee
 *    a hydration mismatch. It's a decorative overlay, so appearing a tick late
 *    costs nothing.
 *  - Transforms are split across three nested elements: the outer one slides,
 *    the middle bobs, the inner spins. Collapsing them would make the bob get
 *    rotated by the spin, which looks like a wobble rather than a roll.
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
  "Careful, I'm on a roll. 🌀",
  "Let's get this party star-ch-ed. 🎊",
  "You're one in a mash-illion. ✨",
  "No filter needed. I'm naturally this good looking. 😎",
];

const BOT_PX = 96;
const EDGE_PX = 16;
/** Must match the CSS transition below, so the joke lands after the roll. */
const ROLL_MS = 2200;
const JOKE_MS = 7500;
const CYCLE_MS = 15000;

export function PotatoBot() {
  const [mounted, setMounted] = useState(false);
  // False for the first frame so the initial placement doesn't animate — the
  // bot should simply be in the corner, not slide there from the left.
  const [placed, setPlaced] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reduced, setReduced] = useState(false);

  const [x, setX] = useState(0);
  const [spin, setSpin] = useState(0);
  const [joke, setJoke] = useState<number | null>(null);

  const xRef = useRef(0);
  const jokeRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState(1024);

  useEffect(() => {
    setMounted(true);
    setViewport(window.innerWidth);

    const start = Math.max(0, window.innerWidth - BOT_PX - EDGE_PX * 2);
    xRef.current = start;
    setX(start);
    const raf = requestAnimationFrame(() => setPlaced(true));

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onMotion = (e: MediaQueryListEvent) => setReduced(e.matches);
    media.addEventListener("change", onMotion);

    // Keep the bot on screen when the window narrows.
    const onResize = () => {
      setViewport(window.innerWidth);
      const max = Math.max(0, window.innerWidth - BOT_PX - EDGE_PX * 2);
      if (xRef.current > max) {
        xRef.current = max;
        setX(max);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /** Pick a joke that isn't the one already showing. */
  const speak = useCallback(() => {
    let next = Math.floor(Math.random() * JOKES.length);
    if (next === jokeRef.current) next = (next + 1) % JOKES.length;
    jokeRef.current = next;
    setJoke(next);
  }, []);

  // Autonomous loop: roll somewhere new, then tell a joke, then go quiet.
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
      if (reduced) {
        tellThenHide();
      } else {
        const max = Math.max(0, window.innerWidth - BOT_PX - EDGE_PX * 2);
        const target = Math.round(Math.random() * max);
        const distance = target - xRef.current;
        xRef.current = target;
        setX(target);
        // Roll direction follows travel direction; ~0.9deg per px reads as
        // the potato actually rolling rather than sliding while spinning.
        setSpin((s) => s + distance * 0.9);
        after(ROLL_MS, tellThenHide);
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

  if (!mounted || dismissed) return null;

  // Keep the bubble on screen when the bot is near either edge.
  const nearLeft = x < 150;
  const nearRight = x > viewport - BOT_PX - 150;
  const bubblePosition = nearLeft
    ? "left-0"
    : nearRight
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-50 print:hidden"
      style={{
        transform: `translateX(${x}px)`,
        transition:
          reduced || !placed
            ? "none"
            : `transform ${ROLL_MS}ms cubic-bezier(.42,.02,.34,1)`,
      }}
    >
      <div className="relative">
        {joke !== null ? (
          <div
            role="status"
            aria-live="polite"
            className={`potato-bot-bubble pointer-events-auto absolute bottom-full mb-3 w-56 rounded-2xl border-[3px] border-ink bg-cream-light px-3.5 py-2.5 shadow-[4px_4px_0_var(--color-ink)] ${bubblePosition}`}
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
            {/* Tail */}
            <span
              aria-hidden
              className={`absolute -bottom-2 h-3 w-3 rotate-45 border-b-[3px] border-r-[3px] border-ink bg-cream-light ${
                nearLeft ? "left-8" : nearRight ? "right-8" : "left-1/2 -translate-x-1/2"
              }`}
            />
          </div>
        ) : null}

        <div className="potato-bot-bob">
          <button
            type="button"
            onClick={speak}
            aria-label="Potato bot — tap for a joke"
            className="pointer-events-auto block rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
            style={{
              transform: `rotate(${spin}deg)`,
              transition:
          reduced || !placed
            ? "none"
            : `transform ${ROLL_MS}ms cubic-bezier(.42,.02,.34,1)`,
            }}
          >
            <Image
              src="/art/potato-bot.png"
              alt=""
              width={147}
              height={177}
              className="h-24 w-auto drop-shadow-md"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

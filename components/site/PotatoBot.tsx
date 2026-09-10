"use client";

import { useCallback, useEffect, useState } from "react";

import { Clip } from "./Clip";
import {
  SUS_MASCOT_H,
  SUS_MASCOT_MP4,
  SUS_MASCOT_POSTER,
  SUS_MASCOT_SRC,
  SUS_MASCOT_W,
  SUSTAINABILITY_FACTS,
} from "@/lib/sustainability";

/**
 * The potato mascot: sits in the bottom-right corner and animates in place —
 * a steady idle bob, plus a hop each time it speaks. It does not travel.
 *
 * It plays a looping "recycling" clip and talks up the event's sustainability
 * story: this is a zero-print, zero-plastic photo booth, and small guest
 * choices (skip the print, refill the cup, sort the bin) add up.
 *
 * Notes on the implementation:
 *  - Renders nothing until mounted. The message is chosen randomly, so
 *    rendering on the server would guarantee a hydration mismatch. A decorative
 *    overlay can afford to appear a tick late.
 *  - Bob and hop live on separate nested elements; on one element the two
 *    keyframes would contend for `transform` and the later one would win.
 *  - The mascot art is a transparent-background WebM played through <Clip>,
 *    which swaps in a still frame under prefers-reduced-motion.
 *  - Anchored bottom-RIGHT deliberately: bottom-left collides with Next's
 *    dev-tools badge in development.
 *  - Large screens only. On a phone a fixed corner mascot this size covers the
 *    content it is sitting on, and there is no room to move it. Gated on a
 *    media query rather than `hidden lg:block` so a phone never downloads the
 *    clip at all — most guests reach this on mobile data.
 *  - Honours prefers-reduced-motion: the bob/hop CSS is disabled via media
 *    query. It still cycles through the facts, so the content is never gated
 *    behind the animation.
 */

const FACTS = SUSTAINABILITY_FACTS;

const FACT_MS = 9000;
const CYCLE_MS = 17000;
/** Matches Tailwind's `lg` — the width at which the corner is spare room. */
const WIDE_ENOUGH = "(min-width: 1024px)";

export function PotatoBot({ liftForFooter = false }: { liftForFooter?: boolean } = {}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [fact, setFact] = useState<number | null>(null);
  // Bumped on each fact to restart the hop animation (a changing key on the
  // class alone won't retrigger it).
  const [hop, setHop] = useState(0);
  const [wideEnough, setWideEnough] = useState(false);

  useEffect(() => setMounted(true), []);

  // Tracked live rather than read once, so rotating a tablet or resizing a
  // window puts the mascot away (or brings it back) instead of stranding it.
  useEffect(() => {
    const mq = window.matchMedia(WIDE_ENOUGH);
    const sync = () => setWideEnough(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const speak = useCallback(() => {
    setFact((current) => {
      let next = Math.floor(Math.random() * FACTS.length);
      if (next === current) next = (next + 1) % FACTS.length;
      return next;
    });
    setHop((n) => n + 1);
  }, []);

  // Autonomous loop: speak, hold the bubble, go quiet, repeat.
  useEffect(() => {
    if (!mounted || dismissed || !wideEnough) return;

    let cancelled = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    };

    const cycle = () => {
      speak();
      after(FACT_MS, () => setFact(null));
      after(CYCLE_MS, cycle);
    };

    after(1800, cycle);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [mounted, dismissed, wideEnough, speak]);

  if (!mounted || dismissed || !wideEnough) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 print:hidden">
      <div className="relative">
        {fact !== null ? (
          <div
            role="status"
            aria-live="polite"
            className="potato-bot-bubble pointer-events-auto absolute bottom-full right-0 mb-3 w-64 rounded-2xl border-[3px] border-ink bg-cream-light px-3.5 py-2.5 shadow-[4px_4px_0_var(--color-ink)]"
          >
            <p className="font-body text-sm font-semibold leading-snug text-ink">
              {FACTS[fact]}
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Hide the potato bot"
              className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-cream-light text-xs font-bold text-ink transition-colors hover:bg-brand-orange hover:text-white"
            >
              ✕
            </button>
            {/* Tail, pointing down at the bot. */}
            <span
              aria-hidden
              className="absolute -bottom-2 right-8 h-3 w-3 rotate-45 border-b-[3px] border-r-[3px] border-ink bg-cream-light"
            />
          </div>
        ) : null}

        <div className="potato-bot-bob">
          <div key={hop} className="potato-bot-hop">
            <button
              type="button"
              onClick={speak}
              aria-label="Potato bot — tap for a sustainability fact"
              className="pointer-events-auto block rounded-2xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
            >
              <Clip
                src={SUS_MASCOT_SRC}
                mp4Alpha={SUS_MASCOT_MP4}
                poster={SUS_MASCOT_POSTER}
                width={SUS_MASCOT_W}
                height={SUS_MASCOT_H}
                className="h-48 w-auto drop-shadow-lg"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

/**
 * The potato mascot: sits in the bottom-right corner and animates in place —
 * a steady idle bob, plus a hop each time it speaks. It does not travel.
 *
 * Notes on the implementation:
 *  - Renders nothing until mounted. The joke is chosen randomly, so rendering
 *    on the server would guarantee a hydration mismatch. A decorative overlay
 *    can afford to appear a tick late.
 *  - Bob and hop live on separate nested elements; on one element the two
 *    keyframes would contend for `transform` and the later one would win.
 *  - Anchored bottom-RIGHT deliberately: bottom-left collides with Next's
 *    dev-tools badge in development.
 *  - Honours prefers-reduced-motion: it holds still and still tells jokes, so
 *    the content is never gated behind the animation.
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
  "Just chilling in my corner. 😎",
  "Let's get this party star-ch-ed. 🎊",
  "You're one in a mash-illion. ✨",
  "No filter needed. I'm naturally this good looking. 💅",
];

const JOKE_MS = 7500;
const CYCLE_MS = 15000;

export function PotatoBot() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [joke, setJoke] = useState<number | null>(null);
  // Bumped on each joke to restart the hop animation (a changing key on the
  // class alone won't retrigger it).
  const [hop, setHop] = useState(0);

  useEffect(() => setMounted(true), []);

  const speak = useCallback(() => {
    setJoke((current) => {
      let next = Math.floor(Math.random() * JOKES.length);
      if (next === current) next = (next + 1) % JOKES.length;
      return next;
    });
    setHop((n) => n + 1);
  }, []);

  // Autonomous loop: speak, hold the bubble, go quiet, repeat.
  useEffect(() => {
    if (!mounted || dismissed) return;

    let cancelled = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    };

    const cycle = () => {
      speak();
      after(JOKE_MS, () => setJoke(null));
      after(CYCLE_MS, cycle);
    };

    after(1800, cycle);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [mounted, dismissed, speak]);

  if (!mounted || dismissed) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 print:hidden">
      <div className="relative">
        {joke !== null ? (
          <div
            role="status"
            aria-live="polite"
            className="potato-bot-bubble pointer-events-auto absolute bottom-full right-0 mb-3 w-56 rounded-2xl border-[3px] border-ink bg-cream-light px-3.5 py-2.5 shadow-[4px_4px_0_var(--color-ink)]"
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
              aria-label="Potato bot — tap for a joke"
              className="pointer-events-auto block rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
            >
              <Image
                src="/art/potato-bot.png"
                alt=""
                width={147}
                height={177}
                className="h-20 w-auto drop-shadow-md"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

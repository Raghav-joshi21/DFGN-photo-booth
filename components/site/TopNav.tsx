"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PotatoBot } from "./PotatoBot";

const LINKS = [
  { href: "/home", label: "Home" },
  { href: "/booth", label: "Capture" },
  { href: "/gallery", label: "Gallery" },
];

/**
 * Site header: wordmark, primary nav, and a help popover.
 *
 * The active link is derived from the pathname rather than passed in, so this
 * drops into any route without configuration.
 *
 * `hideBot` drops the corner sustainability mascot — the gallery is a wall of
 * photos meant to be looked at, and a talking potato hopping over the corner
 * competes with it.
 */
export function TopNav({ hideBot = false }: { hideBot?: boolean } = {}) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="relative z-20 bg-ink">
      <div className="flex h-20 w-full items-center gap-2 px-4 sm:gap-6 sm:px-8">
        {/* Wordmark — the knockout (cream-on-transparent) cut of the logo,
            made for exactly this: sitting straight on the maroon bar with no
            card behind it, unlike the maroon-on-transparent cut used where
            the ground is light (see the booth rail panel). Sized up so it
            reads as the header's anchor, not a small corner icon. */}
        <Link href="/home" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/art/idfw26-latvia-logo-light.png"
            alt="Latvia — IDFW '26"
            width={2263}
            height={870}
            priority
            className="h-10 w-auto sm:h-12"
          />
          <span className="hidden font-display text-lg font-extrabold tracking-tight text-cream-light md:inline xl:text-xl">
            UnBoxed 2026
          </span>
        </Link>

        {/* Primary nav — dead-centred on the bar itself (not just the space
            left over between the logo and the help icon, which are different
            widths and would otherwise pull the "centre" off to one side). */}
        <nav className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-2 md:absolute md:left-1/2 md:ml-0 md:-translate-x-1/2">
          {LINKS.map(({ href, label }) => {
            // Every link is a distinct top-level path now, so a prefix match
            // is enough — no "/" special case to get wrong.
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 rounded-full px-2 py-1.5 font-body text-[0.8125rem] font-bold transition-colors after:absolute after:-bottom-1 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:bg-cream-light after:transition-all sm:px-3 sm:text-base ${
                  active
                    ? "text-cream-light after:w-5"
                    : "text-cream-light/70 after:w-0 hover:bg-white/10 hover:text-cream-light"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Help. `md:ml-auto` pushes it to the bar's far right now that nav
            is absolutely centred (and so no longer in flex flow to do that
            push itself) at that breakpoint. */}
        <div className="relative shrink-0 md:ml-auto">
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            aria-expanded={helpOpen}
            aria-label="How the photo booth works"
            className="flex h-9 w-9 items-center justify-center rounded-full text-cream-light/80 transition-colors hover:bg-white/10 hover:text-cream-light"
          >
            <QuestionMark className="h-6 w-6" />
          </button>

          {helpOpen ? (
            <div
              role="dialog"
              aria-label="How it works"
              className="absolute right-0 top-11 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border-2 border-ink bg-cream-light p-4 text-left shadow-[4px_4px_0_var(--color-ink)]"
            >
              <p className="font-display text-base font-extrabold text-ink">
                How it works
              </p>
              <ul className="mt-2 space-y-1.5 font-body text-sm text-ink/80">
                <li>
                  <strong>Capture</strong> — strike a pose at the booth screen.
                </li>
                <li>
                  <strong>Phone</strong> — scan the QR code at the booth to send
                  a selfie from your own phone.
                </li>
                <li>
                  <strong>Gallery</strong> — approved spuds appear on the wall
                  live.
                </li>
              </ul>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="mt-3 font-body text-sm font-bold text-brand-orange hover:underline"
              >
                Got it
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {hideBot ? null : <PotatoBot />}
    </header>
  );
}

function QuestionMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} role="presentation">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

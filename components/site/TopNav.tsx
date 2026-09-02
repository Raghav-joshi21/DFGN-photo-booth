"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PotatoBot } from "./PotatoBot";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/booth", label: "Capture" },
  { href: "/gallery", label: "Gallery" },
];

/**
 * Site header: wordmark, primary nav, and a help popover.
 *
 * The active link is derived from the pathname rather than passed in, so this
 * drops into any route without configuration.
 */
export function TopNav() {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="relative z-20 border-b-2 border-ink bg-gradient-to-r from-cream-light via-cream-light to-cream">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-5">
        {/* Wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/art/dfgn-logo.png"
            alt="DFGN"
            width={447}
            height={447}
            priority
            className="h-8 w-8"
          />
          <span className="hidden font-display text-xl font-extrabold tracking-tight text-ink sm:inline sm:text-2xl">
            DFGN UnBoxed 2026
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-ink sm:hidden">
            UnBoxed
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0 md:flex-1 md:justify-center">
          {LINKS.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 font-body text-sm font-bold transition-colors sm:text-base ${
                  active
                    ? "text-brand-orange"
                    : "text-ink/75 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Help */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            aria-expanded={helpOpen}
            aria-label="How the photo booth works"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <QuestionMark className="h-6 w-6" />
          </button>

          {helpOpen ? (
            <div
              role="dialog"
              aria-label="How it works"
              className="absolute right-0 top-11 w-72 rounded-2xl border-2 border-ink bg-cream-light p-4 text-left shadow-[4px_4px_0_var(--color-ink)]"
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

      <PotatoBot />
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

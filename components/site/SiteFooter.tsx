import Image from "next/image";

/**
 * Partner-strip footer, styled after the conference site's own (gold bar,
 * wordmark on the left, partner marks trailing off to the right).
 *
 * The reference footer carries real partner logos (RTU, RTU Innovations,
 * Aalto University) that we don't have image assets for here — recreating
 * their logo marks from a screenshot would misrepresent trademarks that
 * aren't ours to draw, so those three are plain text credits instead. Swap
 * `PartnerMark` for an <Image> the moment a real asset file shows up; DFGN's
 * own mark is already in the repo (public/art/dfgn-logo.png), so that one is
 * the real thing.
 */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-brand-yellow">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-5 px-6 py-6 sm:justify-between sm:px-8">
        <Image
          src="/art/idfw26-latvia-logo.png"
          alt="Latvia — IDFW '26"
          width={2203}
          height={863}
          className="h-9 w-auto sm:h-10"
        />

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <PartnerMark eyebrow="RTU" name="Riga Technical University" />
          <PartnerMark eyebrow="RTU" name="Innovations" />
          <PartnerMark eyebrow="Aalto" name="University" />
          <Image
            src="/art/dfgn-logo.png"
            alt="Design Factory Global Network"
            width={432}
            height={432}
            className="h-9 w-9 rounded-full sm:h-10 sm:w-10"
          />
        </div>
      </div>
    </footer>
  );
}

function PartnerMark({ eyebrow, name }: { eyebrow: string; name: string }) {
  return (
    <div className="flex flex-col leading-none text-ink">
      <span className="font-display text-base font-extrabold uppercase tracking-tight sm:text-lg">
        {eyebrow}
      </span>
      <span className="font-body text-[0.6rem] font-bold uppercase tracking-wide text-ink/70 sm:text-xs">
        {name}
      </span>
    </div>
  );
}

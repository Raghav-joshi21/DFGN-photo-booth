import Image from "next/image";

/**
 * Partner-strip footer, styled after the conference site's own (gold bar,
 * wordmark on the left, partner marks trailing off to the right).
 *
 * The reference footer carries real partner logos. We have the real RTU mark
 * and DFGN's own (public/art/rtu-logo.png, dfgn-logo.png) — RTU Innovations
 * and Aalto University don't have an asset file yet, so recreating their
 * logo marks from a screenshot would misrepresent trademarks that aren't
 * ours to draw; those two stay plain text credits until a real file shows up
 * (swap `PartnerMark` for an <Image> then).
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
          <Image
            src="/art/rtu-logo.png"
            alt="Riga Technical University"
            width={332}
            height={64}
            className="h-7 w-auto sm:h-8"
          />
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

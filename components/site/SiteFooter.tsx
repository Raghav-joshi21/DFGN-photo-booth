import Image from "next/image";

/**
 * Partner-strip footer, styled after the conference site's own (gold bar,
 * wordmark on the left, partner marks trailing off to the right).
 *
 * Real logo files for RTU, Aalto University, and DFGN (white cut, made for
 * sitting on a colour like this bar). RTU Innovations doesn't have a distinct
 * asset yet — the files supplied for it were duplicates of the plain RTU
 * mark — so it stays a plain text credit until a real one shows up (swap
 * `PartnerMark` for an <Image> then; recreating its logo mark from a
 * screenshot would misrepresent a trademark that isn't ours to draw).
 */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-brand-yellow">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-5 px-6 py-6 sm:px-8">
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
          <Image
            src="/art/aalto-logo.png"
            alt="Aalto University"
            width={112}
            height={91}
            className="h-8 w-auto sm:h-9"
          />
          <Image
            src="/art/dfgn-logo-white.png"
            alt="Design Factory Global Network"
            width={66}
            height={64}
            className="h-8 w-auto sm:h-9"
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

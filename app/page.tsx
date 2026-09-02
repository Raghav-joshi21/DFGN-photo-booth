import Link from "next/link";

/**
 * Root landing page.
 *
 * This is mostly a developer entry point / signpost. In production the kiosk
 * boots straight into `/booth`, and guests land on `/upload` from a QR code.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          DFGN Photo Booth
        </h1>
        <p className="max-w-md text-balance text-sm opacity-70">
          Live event photo wall for RTU Design Factory, part of the Design
          Factory Global Network.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/booth"
          className="rounded-full bg-foreground px-8 py-3 font-medium text-background transition-opacity hover:opacity-90"
        >
          Open Booth (kiosk)
        </Link>
        <Link
          href="/upload"
          className="rounded-full border border-foreground/20 px-8 py-3 font-medium transition-colors hover:bg-foreground/5"
        >
          Guest Upload (phone)
        </Link>
      </div>
    </main>
  );
}

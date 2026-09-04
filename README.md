# DFGN Photo Booth

A digital photo-booth kiosk for **RTU Design Factory** (part of the Design
Factory Global Network). A big kiosk screen — the **booth** — shows a live wall
of event photos, fed by two input paths:

1. **Self-camera** — the booth captures a photo of whoever is standing in front
   of it.
2. **Phone upload** — guests scan a QR code, upload a selfie from their phone,
   and it gets AI-stylized before appearing on the booth wall.

Built to grow: **AR mini-games** (starting with a face-tracking "catch the
falling potatoes" game via MediaPipe Face Landmarker, client-side off the
webcam) slot into the booth without restructuring — see [AR games](#ar-games).

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** (v4)
- **Supabase** — Postgres, Storage, Realtime
- **Zustand** — lightweight client state
- **Framer Motion** — UI animations
- **pnpm** — package manager

## Getting started

```bash
pnpm install
cp .env.local.example .env.local   # then fill in real values
pnpm dev                           # http://localhost:3000
```

Routes:

- `/` — dev landing / signpost
- `/booth` — the kiosk display
- `/upload` — the mobile guest upload flow

> **pnpm note:** this machine runs pnpm through Node's Corepack (there is a
> `pnpm` shim in `~/.local/bin`). If `pnpm` isn't found in a fresh shell, use
> `corepack pnpm <cmd>` or re-create the shim.

## Testing on your phone (HTTPS over LAN)

The self-camera (`/booth`) and the phone upload (`/upload`) both need camera
access via `getUserMedia`, which browsers only allow in a **secure context**.
`localhost` counts; a bare LAN IP over `http://` does **not**. So to test from
your phone you need HTTPS even on the local network.

```bash
pnpm dev:lan
```

This runs `next dev` with HTTPS bound to all interfaces and prints a banner with
the URL to open on your phone, e.g.:

```
│  Network:  https://192.168.1.42:3000   ← open this on your phone
│  Booth:    https://192.168.1.42:3000/booth
│  Upload:   https://192.168.1.42:3000/upload
│
│  Cert covers: localhost, 127.0.0.1, 192.168.1.42
│  Self-signed cert → accept the one-time browser warning.
```

### About the certificate

`pnpm dev:lan` mints its own cert with `openssl` into `certificates/`
(gitignored) rather than using Next's built-in cert generation. Two reasons:

1. Next's `--experimental-https` shells out to **mkcert**, whose `-install` step
   needs your **login password** — it fails in any non-interactive shell.
2. The cert mkcert produces covers only `localhost 127.0.0.1 ::1 0.0.0.0` — **not
   your LAN IP**. Your phone dialing `https://192.168.1.42:3000` would get a
   cert-name mismatch, which some mobile browsers refuse to let you click past.

The generated cert lists every LAN IPv4 on the machine in its SANs, so the name
always matches. It's regenerated automatically when your IP changes (e.g. you
join a different Wi-Fi) — the SAN set is tracked in `certificates/sans.json`.

Notes:

- Your phone must be on the **same Wi-Fi** as the laptop.
- The cert is **self-signed**, so the first visit (on laptop and phone) shows a
  browser warning ("Not secure" / "Your connection is not private"). This is
  **expected in dev** — tap _Advanced → Proceed_ to continue. Camera access
  works once you're past it. You'll see it again after the cert is regenerated.
- To find your IP manually: macOS `ipconfig getifaddr en0` (Wi-Fi) or
  System Settings → Wi-Fi → Details; or just read it off the `dev:lan` banner.
- The `/booth` QR code auto-targets `window.location.origin/upload`, so when you
  open the booth via the LAN URL the QR already points your phone at the right
  address — no config needed.
- `next.config.ts` adds this machine's LAN IPs to `allowedDevOrigins`. Without
  it Next dev rejects cross-origin requests for `/_next/*` assets, so the page
  loads from the phone but arrives unstyled and without JS.
- If `openssl` isn't on `PATH`, the script warns and falls back to
  `--experimental-https` (localhost only — phone testing won't work).

Dev scripts:

| Script | What it does |
| --- | --- |
| `pnpm dev` | Plain `next dev` (http, localhost only) |
| `pnpm dev:https` | `next dev --experimental-https` (localhost, HTTPS) |
| `pnpm dev:lan` | HTTPS (LAN-IP cert) + `0.0.0.0` + prints the LAN URL — use this for phone testing |

## Auto-commit hook

`.claude/settings.json` registers a `PostToolUse` hook so every file Claude Code
writes is committed and pushed to `origin` automatically:

```
Write | Edit | NotebookEdit  →  scripts/auto-commit.sh
```

The script runs `async` (it never blocks the edit) and is deliberately
defensive, because it fires unattended after every single edit:

- **Always exits 0.** A non-zero exit from a `PostToolUse` hook surfaces as a
  tool failure; bookkeeping must not break the actual work.
- **Skips mid-operation.** No commits during a merge, rebase, cherry-pick,
  revert, or bisect, and none on a detached HEAD.
- **Takes a lock.** Parallel edits fire parallel hooks; two `git commit` runs
  racing on one index fail with `index.lock exists`. A stale lock older than
  5 minutes is cleared automatically.
- **Tolerates push failure.** Offline or rejected pushes leave the commit safely
  on the local branch and print a note to stderr.
- **Ignores gitignore-only changes**, so touching `.env.local` commits nothing.

Commits are titled `chore(auto): update <files>`. Expect a noisy history — this
is one commit per edit, not per task. To review or disable the hook, run
`/hooks`; to turn it off permanently, delete the `PostToolUse` block from
`.claude/settings.json`.

> Because the push is unconditional, **anything Claude writes goes straight to
> the public repo.** `.env.local`, `certificates/`, and `.next/` are gitignored,
> so keys and certs stay local — but keep it that way when adding new files.

## Snap Camera Kit (live filters)

The booth's self-camera can run Snap lenses live on the preview, before the
countdown. Set `NEXT_PUBLIC_CAMERA_KIT_API_TOKEN` and
`NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID` (see [`.env.local.example`](./.env.local.example))
and a filter strip appears under the preview; the capture is then taken from
Camera Kit's rendered output, so the lens is baked into the photo.

`NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID` accepts a comma-separated list of group
ids — every group's lenses are loaded into the one strip, de-duplicated by id.

Snap lenses are optional. With no credentials — or if the SDK fails to load, the
token is rejected, or every lens group is empty — the booth falls back to the
plain webcam preview and the rest of the capture flow is unchanged. The SDK is
~7MB and is imported dynamically, so an unconfigured booth never downloads it.

The strip also carries a set of **built-in colour tints** (B&W, Sepia, Warm,
Cool, …) defined in [`lib/camera-kit/css-filters.ts`](./lib/camera-kit/css-filters.ts).
They are plain CSS filters, work with or without Camera Kit, stack on top of an
active lens, and are re-applied to the capture canvas so the saved photo
matches the preview.

Only potato-themed lenses are offered: lens names are matched against a
pattern in [`lib/camera-kit/index.ts`](./lib/camera-kit/index.ts). If a group
contains lenses but none match, all of them are shown and a warning is logged —
an empty filter strip would be worse than an unfiltered one.

> **Snap branding requirement.** Snap's guidelines require visible attribution
> whenever a Lens is active. The booth renders a small "Powered by Snap"
> watermark over the preview while a lens is applied. Snap's requirements change,
> so check the current wording and placement rules at
> <https://developers.snap.com/camera-kit> before running this at an event —
> and note the watermark is on the *preview*, not burned into the saved photo.

## Environment variables

See [`.env.local.example`](./.env.local.example). Summary:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Anon key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS; used by `app/api/*` |
| `IMAGE_AI_API_KEY` | **server only** | Image AI provider key for stylizing |

Anything without the `NEXT_PUBLIC_` prefix is server-only and never shipped to
the browser.

## Folder structure

```
app/
  page.tsx          Landing / signpost
  booth/            Kiosk display route: idle photo wall, self-camera capture,
                    and (later) AR game screens
  upload/           Mobile-facing route for the QR-code selfie upload flow
  api/
    ai-edit/        Server-only route → image AI API (stylize). Key stays server-side.
    moderate/       Server-only route → image moderation API (approve/reject).
lib/
  supabase/         Supabase client setup + DB types
    client.ts       Browser client (anon key)
    server.ts       Server client (anon) + admin client (service-role key)
    types.ts        Database types — regenerate with `supabase gen types`
  stores/           Zustand stores (e.g. booth-store.ts)
  ar/               AR / face-tracking + game logic (scaffold — see below)
components/         Shared UI components
  Polaroid.tsx      Polaroid-framed photo (used by the booth wall)
  PhotoCard.tsx     Plain square photo tile
  booth/            Booth-only components: PhotoWall (live grid), SelfCamera
lib/hooks/          React hooks (use-approved-photos = initial fetch + Realtime)
types/              Shared, framework-agnostic domain types
supabase/
  migrations/       SQL migrations (0001_init.sql = photos table)
```

## Data model

`supabase/migrations/0001_init.sql` creates a `photos` table:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, auto-generated |
| `source` | `photo_source` enum | `booth` \| `upload` |
| `original_url` | `text` | original capture/upload |
| `edited_url` | `text` (nullable) | AI-stylized version |
| `status` | `photo_status` enum | `pending` \| `approved` \| `rejected` |
| `created_at` | `timestamptz` | defaults to `now()` |

RLS is enabled; the anon key can only read `approved` photos. Writes and
moderation go through the server routes using the service-role key. The table is
added to the `supabase_realtime` publication so the booth wall can update live.

### Applying the migration

The migration is **not applied yet** — it needs a live Supabase project. Once
you've created one:

```bash
# Option A — Supabase CLI (from the repo root)
supabase link --project-ref <your-project-ref>
supabase db push

# Option B — no CLI: open the Supabase dashboard → SQL Editor,
# paste supabase/migrations/0001_init.sql, and run it.
```

Then fill in `.env.local` (copy from `.env.local.example`) with the project URL
and anon key, restart the dev server, and the booth wall switches from
"Supabase not configured" to the live wall.

### Verifying the setup

```bash
pnpm check:supabase
```

Checks the env vars, that the table and public bucket exist, that Realtime
subscribes — and actively tries to break the RLS rules with the anon key
(inserting a pre-approved photo, approving a pending one). Both must fail; if
either succeeds, any guest could push unmoderated photos to the big screen. It
cleans up its own test rows using the service-role key.

> **Gotcha worth knowing:** PostgREST implements `.select()` as a `RETURNING`
> clause, and Postgres enforces the SELECT policy on returned rows. Since ours
> exposes only approved photos, chaining `.select()` onto an insert of a
> `pending` row fails with *"new row violates row-level security policy"* — which
> reads like the INSERT was rejected when it actually succeeded. That is why
> `uploadGuestPhoto` mints the row id client-side and inserts without
> `.select()`. Don't add one back.

Optionally regenerate the DB types so they're derived from the real schema
instead of the hand-written stand-in:

```bash
supabase gen types typescript --project-id <ref> --schema public > lib/supabase/types.ts
```

## AR games

`lib/ar/` is scaffolded but intentionally empty (`index.ts` only reserves the
module boundary). This is where the AR mini-games plug in later:

- A thin wrapper around MediaPipe **Face Landmarker** running client-side off
  the booth webcam, emitting normalized face-landmark / head-pose data.
- Per-game logic — first up: falling potato sprites you catch by moving your
  face (game loop, collision, scoring).
- A canvas overlay renderer on top of the video feed.

It lives in its own module (no Next.js / server imports) so it stays a portable,
client-only library. The booth route imports from it to mount a game screen; the
active screen is already modeled in `lib/stores/booth-store.ts` (`idle` |
`camera` | `game`), so adding a game is "add a screen," not "restructure the
app." Load MediaPipe + WASM lazily (dynamic import) so the idle loop and upload
flow don't pay the cost.

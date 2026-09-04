# DFGN Photo Booth

A digital photo-booth kiosk for **RTU Design Factory** (part of the Design
Factory Global Network). A big kiosk screen — the **booth** — shows a live wall
of event photos, fed by three input paths:

1. **Self-camera** — the booth captures a photo of whoever is standing in
   front of it, with a live filter strip (Snap AR lenses, built-in colour
   tints, and home-grown face-tracked props) baked into the shot.
2. **Phone upload** — guests scan a QR code, upload a selfie from their
   phone, and it gets AI-stylized before appearing on the booth wall.
3. **AR mini-game** — "Catch the falling potatoes": open your mouth to eat
   the green ones for points; eat a red one and it's game over. Played
   right on the kiosk, face-tracked off the webcam.

## What's actually working right now

- ✅ Live photo wall (`/booth` and the public `/gallery`), backed by Supabase
  Realtime — a new approved photo appears on every open tab within about a
  second, no polling.
- ✅ Self-camera capture with a 3-2-1 countdown, retake, and a review screen
  (Start over / Retake / Use this photo).
- ✅ Phone upload flow (`/upload`), reached by scanning the booth's QR code.
- ✅ Three independent, stackable filter layers on the self-camera preview —
  see [Filters on the self-camera](#filters-on-the-self-camera) — all baked
  into the saved photo, not just the live view.
- ✅ The "Catch the falling potatoes" AR mini-game, reachable from the
  booth's idle screen.
- ✅ Dual photo backend: Supabase (Postgres + Storage + Realtime) when
  configured, or a zero-config local filesystem store for development — see
  [Photo storage](#photo-storage-two-backends).
- 🚧 AI stylizing of uploads (`app/api/ai-edit`) and moderation
  (`app/api/moderate`) are wired up but the actual AI calls are still stubs.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** (v4)
- **Supabase** — Postgres, Storage, Realtime
- **Zustand** — lightweight client state
- **Framer Motion** — UI animations
- **@snap/camera-kit** — optional live Snap AR lenses
- **@mediapipe/tasks-vision** — client-side face tracking (own AR lenses + the game), no Snap account needed
- **pnpm** — package manager

## Getting started

```bash
pnpm install
cp .env.local.example .env.local   # then fill in real values
pnpm dev                           # http://localhost:3000
```

Routes:

- `/` — dev landing / signpost
- `/booth` — the kiosk display (photo wall + self-camera + entry point to the game)
- `/upload` — the mobile guest upload flow
- `/gallery` — the same live wall as `/booth`, on its own shareable route

> **pnpm note:** this machine runs pnpm through Node's Corepack (there is a
> `pnpm` shim in `~/.local/bin`). If `pnpm` isn't found in a fresh shell, use
> `corepack pnpm <cmd>` or re-create the shim. If `corepack enable` itself
> fails with a permissions error, run it once from an elevated/admin shell —
> or fall back to running Next directly: `node node_modules/next/dist/bin/next dev`.

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
writes is committed **and pushed to `origin` automatically**:

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
  on the local branch and print a note to stderr — it is a plain `git push`,
  never `--force`, so it will never silently overwrite someone else's push.
- **Ignores gitignore-only changes**, so touching `.env.local` commits nothing.

Commits are titled `chore(auto): update <files>`. Expect a noisy history — this
is one commit per edit, not per task. To review or disable the hook, run
`/hooks`; to turn it off permanently, delete the `PostToolUse` block from
`.claude/settings.json`.

> **Because the push is unconditional and immediate, anything written to this
> repo reaches the public GitHub remote within seconds — there is no "commit
> now, decide about pushing later" window.** `.env.local`, `certificates/`,
> and `.next/` are gitignored, so keys and certs stay local, but that is the
> *only* safety net. Don't drop stray files (screenshots, downloaded stock
> art, anything not meant to ship) anywhere under the repo root — they get
> swept into the very next auto-commit. Large or non-shippable design sources
> belong in `/design-source/` (gitignored) instead.

## Filters on the self-camera

Three independent layers, all optional, all stackable, and — critically —
**all baked into the saved photo**, not just the live preview (the capture
crops from whichever canvas is actually showing, then re-applies the same
CSS `filter` string via `ctx.filter` so what you see is what you get):

1. **Snap Camera Kit lenses** — see [below](#snap-camera-kit-live-filters).
   Real Snap AR, needs a Camera Kit account.
2. **Built-in colour tints** — B&W, Noir, Sepia, Warm, Cool, Vivid, Faded
   (`lib/camera-kit/css-filters.ts`). Plain CSS filters, no dependency on
   Camera Kit at all, so they're always available.
3. **Our own face-tracked AR lenses** — see
   [Face-tracked AR lenses](#face-tracked-ar-lenses-no-snap-account-needed).
   Potato hat, shades, mustache, crown, googly eyes — tracked to your face
   with MediaPipe, no Snap account needed.

The strip shows whichever of these are actually available, in that order,
separated by dividers — a kiosk with no Snap credentials and no camera-kit
account still gets tints and AR props.

## Photo storage: two backends

`savePhoto()` (`lib/photos/save.ts`) is the **one** path every capture (booth
or phone upload) goes through, and it picks the backend automatically:

- **Supabase configured** (`hasSupabaseEnv()` true): the image bytes go
  straight from the browser to Supabase **Storage**, then only the resulting
  path is POSTed to `app/api/photos/publish` — a server route running with
  the **service-role key** that verifies the object exists and inserts an
  already-`approved` row. Routing bytes through the server route instead
  would break in production: Vercel caps a request body around ~4.5MB, and a
  base64 data URL inflates an image by a third. AI stylizing
  (`app/api/ai-edit`) is then kicked off fire-and-forget — the photo is
  already on the wall before that finishes.
- **No Supabase env vars**: the same call falls back to a zero-config
  filesystem store (`lib/local-store/photos.ts`) — image bytes land under
  `public/uploads/`, a flat JSON index at `.data/photos.json` tracks the
  newest-first list, and the wall polls `GET /api/photos` every 2.5s instead
  of subscribing to Realtime. Fine for a single kiosk laptop; it does no
  moderation (everything lands `approved`) and keeps only the most recent
  `MAX_PHOTOS` (200), pruning older files from disk too.

Both backends produce the same `Photo` shape, so nothing else in the app
needs to know which one is active.

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

Only potato-themed lenses lead the strip: lens names are matched against a
pattern in [`lib/camera-kit/index.ts`](./lib/camera-kit/index.ts) and sorted
first, with the first match auto-applied on start-up (this is a potato booth,
after all). If a group contains lenses but none match, all of them are shown
unsorted and a warning is logged — an empty filter strip would be worse than
an unfiltered one.

> **Snap branding requirement.** Snap's guidelines require visible attribution
> (a "Powered by Snap" mark or equivalent) whenever a Lens is active. That
> watermark has been **removed** from the preview at the operator's request —
> re-add it, or arrange attribution elsewhere on the kiosk, before running this
> with real Snap lenses at an event. Check the current wording and placement
> rules at <https://developers.snap.com/camera-kit>.

## Face-tracked AR lenses (no Snap account needed)

`lib/ar/` runs MediaPipe's `FaceLandmarker` entirely client-side off the
booth's webcam and hands back a 478-point face mesh every animation frame;
`lib/ar/draw.ts` turns that into five hand-drawn props anchored to the face
and scaled/rotated to head size and tilt:

| Lens | How it's drawn |
| --- | --- |
| 🥔 Potato hat | `public/art/potato-sprite.png`, anchored above the forehead |
| 🕶️ Shades | Canvas-drawn rounded rects + bridge + temples at the eye line |
| 👨 Mustache | Layered ellipses (centre bar + curled tips), above the upper lip |
| 👑 Crown | A gold 3-peak crown with gems, above the forehead |
| 👀 Googly eyes | Two circles with sinusoidally-wobbling pupils |

The potato hat leads and is auto-applied on start-up, same house-style rule
as the Snap lens above. All five stack with a Snap lens and a colour tint at
once, and are composited into the saved photo the same way tints are.

The `FaceLandmarker` (wasm runtime + a ~6MB model, both pulled from a CDN on
first use rather than bundled) is expensive to boot and cheap to keep warm,
so `startFaceAr()` caches it as a module-level singleton shared by both the
self-camera and the AR game below — whichever loads it first, the other
reuses the same instance instantly. Same "never block the booth" philosophy
as Camera Kit: if the model can't load (offline, no WebGL, a slow device),
`startFaceAr()` resolves `null` and the AR chips simply never appear.

> **Asset note:** `public/art/potato-sprite.png` is extracted from a
> licensed iStock illustration (asset `#1189117812`). It ships here on the
> basis that the project holds a license covering this use — swap it for
> original art before reusing this repo under a license that doesn't cover
> that asset.

## AR mini-game — Catch the falling potatoes

`components/booth/PotatoCatchGame.tsx`, reached via the "🥔 Play the catch
game" button on the booth's idle screen (`screen: "game"` in
`lib/stores/booth-store.ts`). Uses the same `lib/ar` face-tracking pipeline
as the self-camera lenses, but owns its own webcam stream — the two screens
are never mounted at once, so there's no contention.

Rules: green and red potatoes fall from the top of the frame. Open your
mouth under a green one to eat it and score; a gold ring around your mouth
shows when it's open enough to catch. Eat a **red** one and it's game over —
missing potatoes of either colour is free, only eating a red one is punished.
Spawn rate ramps up slightly as the score climbs.

Mechanically: mouth state comes from the gap between the inner-lip landmarks
normalized by inter-eye distance (so it's invariant to how close you're
standing), and the whole game canvas — video, potatoes, and the mouth ring —
is drawn through one mirrored transform, so reaching for a falling potato
feels like looking in a mirror rather than fighting a reversed image. The
potato sprite is tinted green/red once via an offscreen canvas
(`source-atop` composite) rather than per-frame, so the hot loop is just a
handful of `drawImage` calls.

## Environment variables

See [`.env.local.example`](./.env.local.example). Summary:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Anon key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS; used by `app/api/*` |
| `NEXT_PUBLIC_CAMERA_KIT_API_TOKEN` | client | Snap Camera Kit API token (optional) |
| `NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID` | client | Snap lens group id(s), comma-separated (optional) |
| `IMAGE_AI_API_KEY` | **server only** | Image AI provider key for stylizing (optional) |

Anything without the `NEXT_PUBLIC_` prefix is server-only and never shipped to
the browser. Every one of these is optional in the sense that the app
degrades gracefully with it unset — see each feature's section above for what
that degradation looks like.

## Folder structure

```
app/
  page.tsx              Landing / signpost
  booth/                Kiosk display route: idle photo wall + self-camera,
                        and the AR game screen
  upload/               Mobile-facing route for the QR-code selfie upload flow
  gallery/               Public read-only view of the same live wall
  api/
    photos/              Local-store photo list/create (GET/POST) — the no-Supabase path
    photos/publish/       Server-only route → publishes a Storage upload as an approved row
    ai-edit/              Server-only route → image AI API (stylize). Key stays server-side.
    moderate/             Server-only route → image moderation API (approve/reject).
lib/
  supabase/              Supabase client setup + DB types
    client.ts             Browser client (anon key)
    server.ts              Server client (anon) + admin client (service-role key)
    photos.ts               Storage upload, approved-photos fetch, AI-edit trigger
    types.ts                Database types — regenerate with `supabase gen types`
  local-store/            Filesystem-backed photo store (the no-Supabase fallback)
  photos/save.ts          savePhoto() — the one path both capture flows use to publish a photo
  camera-kit/             Snap Camera Kit wrapper (index.ts) + built-in CSS tints (css-filters.ts)
  ar/                     Face-tracked AR: FaceLandmarker wrapper (index.ts) + prop rendering (draw.ts)
  stores/                 Zustand stores (e.g. booth-store.ts)
  hooks/                  React hooks (use-approved-photos = initial fetch + Realtime/poll)
components/
  Polaroid.tsx             Polaroid-framed photo (used by the booth wall)
  PhotoCard.tsx             Plain square photo tile
  booth/
    SelfCamera.tsx           Countdown capture + the three filter layers
    PotatoCatchGame.tsx       The AR mini-game
    ScrollingWall.tsx         The ambient, always-scrolling booth wall
    PotatoFrame.tsx           One framed photo tile in the wall
    PhotoWall.tsx              Grid layout used by /gallery
types/                    Shared, framework-agnostic domain types
supabase/
  migrations/              SQL migrations (0001_init.sql = photos table + storage bucket + RLS)
public/art/                House art: potato mascot clips/stills, the AR game's sprite, branding
design-source/            Large/raw design exports kept locally only (gitignored — never commit)
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

RLS is enabled: the anon key can `SELECT` only `approved` rows, and may
`INSERT` only a row that is already `status = 'pending'` (so a guest's own
browser can never approve its own photo). Every row that actually reaches
`approved` is written server-side, with the service-role key, by
`app/api/photos/publish` — see [Photo storage](#photo-storage-two-backends).
The `photos` bucket in Storage is public-read, with an anon-insert policy so
the browser can upload bytes directly. The table is added to the
`supabase_realtime` publication so the booth wall can update live.

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
> exposes only approved photos, chaining `.select()` onto an anon insert of a
> `pending` row fails with *"new row violates row-level security policy"* —
> which reads like the INSERT was rejected when it actually succeeded. That is
> why `scripts/check-supabase.mjs`'s own test inserts skip `.select()`. The
> app itself doesn't hit this at all any more: the browser never inserts a DB
> row directly (only Storage bytes) — the `photos` row is always written
> server-side with the service-role key, which bypasses RLS entirely.

Optionally regenerate the DB types so they're derived from the real schema
instead of the hand-written stand-in:

```bash
supabase gen types typescript --project-id <ref> --schema public > lib/supabase/types.ts
```

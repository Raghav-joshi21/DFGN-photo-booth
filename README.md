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
components/         Shared UI components (e.g. PhotoCard.tsx)
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

Apply it with `supabase db push`, or paste it into the Supabase SQL editor.

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

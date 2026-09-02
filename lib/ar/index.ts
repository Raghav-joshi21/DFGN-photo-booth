/**
 * AR module (scaffold — intentionally empty for now).
 *
 * This is where the client-side AR mini-games will live. It is kept as its own
 * module so the games can be added later without restructuring the app.
 *
 * Planned contents:
 *   - A thin wrapper around MediaPipe `FaceLandmarker`, running client-side off
 *     the booth webcam, that emits normalized face-landmark / head-pose data.
 *   - Per-game logic. The first game: falling potato sprites that the player
 *     "catches" by moving their face — a game loop that maps face position to a
 *     basket/collider and does collision + scoring.
 *   - Shared rendering helpers (canvas overlay on top of the video feed).
 *
 * Design notes for when this gets built:
 *   - Everything here runs in the browser only. Load MediaPipe and the WASM
 *     runtime lazily (dynamic import) so the booth idle loop and upload flow
 *     don't pay the cost. Guard all of it behind `"use client"` entry points.
 *   - The booth route (`app/booth`) will import from here to mount a game
 *     screen; keep this module free of Next.js / server imports so it stays a
 *     portable, testable client library.
 *
 * Nothing is exported yet — this file exists to reserve the module boundary.
 */

export {};

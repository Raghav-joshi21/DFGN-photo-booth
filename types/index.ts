/**
 * Shared, app-wide domain types.
 *
 * Keep this file framework-agnostic — it is imported by both client
 * components (booth / upload) and server routes (api/*). Supabase-specific
 * row/insert types live in `lib/supabase/types.ts` and are derived from the
 * database schema; the types here are the friendlier domain shapes the UI
 * works with.
 */

/** Where a photo entered the system. */
export type PhotoSource = "booth" | "upload";

/** Moderation lifecycle. A photo is only shown on the wall once `approved`. */
export type PhotoStatus = "pending" | "approved" | "rejected";

/** A single photo as the UI thinks about it. */
export interface Photo {
  id: string;
  source: PhotoSource;
  /** Publicly reachable URL of the original capture/upload. */
  originalUrl: string;
  /** URL of the AI-stylized version, if one has been produced yet. */
  editedUrl: string | null;
  status: PhotoStatus;
  createdAt: string;
}

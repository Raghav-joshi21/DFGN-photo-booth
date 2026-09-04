import { createClient } from "./client";
import type { PhotoRow } from "./types";
import type { Photo, PhotoSource } from "@/types";

/** Storage bucket that holds raw uploaded/captured photos (see migration). */
export const PHOTOS_BUCKET = "photos";

/**
 * True when the public Supabase env vars are present. Lets the UI degrade
 * gracefully (empty wall, disabled upload) before `.env.local` is filled in,
 * instead of throwing at client-creation time.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Map a raw DB row to the friendlier domain shape used by the UI. */
export function mapRow(row: PhotoRow): Photo {
  return {
    id: row.id,
    source: row.source,
    originalUrl: row.original_url,
    editedUrl: row.edited_url,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Fetch approved photos, newest first (initial load for the booth wall). */
export async function fetchApprovedPhotos(limit = 60): Promise<Photo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Extension to use for a stored blob, keyed by MIME type. */
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Put image bytes in the Storage bucket and return where they landed.
 *
 * Uploads straight from the browser — the anon INSERT policy on the bucket
 * allows it (see the migration), and it keeps a multi-megabyte body out of the
 * serverless function that publishes the row.
 *
 * Creating the `photos` row is deliberately NOT done here. A client can only
 * insert 'pending' rows under RLS, so publishing happens server-side in
 * /api/photos/publish with the service-role key. That split is what lets a
 * photo be approved instantly without letting any browser approve its own.
 */
export async function uploadToStorage(
  blob: Blob,
  source: PhotoSource,
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = createClient();

  const contentType = blob.type || "image/jpeg";
  const ext = EXT_BY_TYPE[contentType] ?? "jpg";
  const storagePath = `${source}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, blob, { contentType, upsert: false });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

/**
 * Kick off the AI stylizing pass for a photo that is already on the wall.
 *
 * Fire-and-forget on purpose. The photo is published and visible before this
 * runs; when the edit lands the route writes `edited_url` and the wall picks
 * the change up over Realtime. A failure here costs the guest a filter, not
 * their photo, so errors are swallowed rather than surfaced.
 */
export async function triggerProcessing(
  photo: Pick<Photo, "id" | "originalUrl">,
): Promise<void> {
  try {
    await fetch("/api/ai-edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId: photo.id, imageUrl: photo.originalUrl }),
    });
  } catch {
    // See above: the wall already has the unstyled photo.
  }
}

import { createClient } from "./client";
import type { PhotoRow } from "./types";
import type { Photo } from "@/types";

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

/**
 * Upload a guest selfie: push the raw file to Storage, then insert a matching
 * 'pending' row in `photos` (source 'upload'). Returns the created photo.
 *
 * Moderation + AI edit happen afterwards via {@link triggerProcessing}; until a
 * server flips the row to 'approved' it will not appear on the booth wall.
 */
export async function uploadGuestPhoto(file: File): Promise<Photo> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `upload/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  const { data, error: insertError } = await supabase
    .from("photos")
    .insert({ source: "upload", original_url: publicUrl, status: "pending" })
    .select("*")
    .single();
  if (insertError) throw insertError;

  return mapRow(data);
}

/**
 * Kick off server-side moderation + AI stylizing for a freshly uploaded photo.
 *
 * STUB: the real work lives behind /api/moderate and /api/ai-edit, which need
 * provider API keys that aren't wired up yet. For now this fires the requests
 * (they return 501) so the flow is in place; failures are swallowed on purpose
 * so the guest still sees the "processing" state.
 *
 * TODO: once keys exist, have these routes update `photos.status` /
 * `edited_url`; the booth wall already listens for that via Realtime.
 */
export async function triggerProcessing(
  photo: Pick<Photo, "id" | "originalUrl">,
): Promise<void> {
  const body = JSON.stringify({
    photoId: photo.id,
    imageUrl: photo.originalUrl,
  });
  try {
    // Moderate first, then stylize. Both are stubs returning 501 today.
    await fetch("/api/moderate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    await fetch("/api/ai-edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch {
    // Non-fatal in dev — see TODO above.
  }
}

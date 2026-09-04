"use client";

import {
  hasSupabaseEnv,
  triggerProcessing,
  uploadToStorage,
} from "@/lib/supabase/photos";
import type { Photo, PhotoSource } from "@/types";

/**
 * The one way a photo gets onto the wall — used by both the booth capture and
 * the phone upload.
 *
 * The two callers used to choose a backend independently and disagreed: the
 * booth always wrote to the local filesystem store while the upload page wrote
 * to Supabase, so with Supabase configured (the normal case) the booth's photos
 * went somewhere the wall never reads. Deciding once, here, is what keeps them
 * pointed at the same place.
 *
 * Supabase path — the bytes go straight from the browser to Storage and only
 * the resulting path is POSTed to the publish route. Routing the image through
 * the route instead would break in production: Vercel caps a serverless request
 * body at ~4.5MB and a base64 data URL inflates an image by a third.
 *
 * Local path — no Supabase credentials, so the filesystem store takes the whole
 * data URL. Fine for a single kiosk; it cannot run on a read-only serverless
 * disk, which is exactly when `hasSupabaseEnv()` is true anyway.
 */
export async function savePhoto(input: {
  /** The image bytes. Preferred: it is a third smaller than the data URL. */
  blob: Blob;
  /** Same image as a data URL, for the local fallback store. */
  dataUrl: string;
  source: PhotoSource;
}): Promise<Photo> {
  if (!hasSupabaseEnv()) {
    return saveToLocalStore(input.dataUrl, input.source);
  }

  const { storagePath } = await uploadToStorage(input.blob, input.source);

  const res = await fetch("/api/photos/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storagePath, source: input.source }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? `Could not publish the photo (${res.status}).`);
  }

  const { photo } = (await res.json()) as { photo: Photo };

  // Stylizing runs after the photo is already on the wall, and updates it in
  // place when it lands. Deliberately not awaited: nobody should watch a
  // spinner for an AI round-trip when their photo is up there already.
  void triggerProcessing(photo);

  return photo;
}

/** No-Supabase fallback: hand the data URL to the filesystem-backed store. */
async function saveToLocalStore(dataUrl: string, source: PhotoSource): Promise<Photo> {
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: dataUrl, source }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? `Could not save the photo (${res.status}).`);
  }
  const { photo } = (await res.json()) as { photo: Photo };
  return photo;
}

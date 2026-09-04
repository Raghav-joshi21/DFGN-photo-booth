import { NextResponse } from "next/server";

import { PHOTOS_BUCKET } from "@/lib/supabase/photos";
import { createAdminClient } from "@/lib/supabase/server";
import type { Photo, PhotoSource } from "@/types";

/**
 * POST /api/photos/publish
 *
 * Publishes an already-uploaded image onto the wall.
 *
 *   ← { storagePath: "upload/<uuid>.jpg", source: "booth" | "upload" }
 *   → { photo: Photo }  (201)
 *
 * The browser puts the bytes in Storage itself and sends only the path, so no
 * image data passes through this function — Vercel would reject a body over
 * ~4.5MB.
 *
 * Runs with the service-role key because the row is inserted 'approved'. RLS
 * lets an anon client insert 'pending' rows only (see the migration), which is
 * what stops a guest from approving their own photo; doing the approval here
 * keeps that guarantee while still putting the photo up in about a second.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { storagePath?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const source: PhotoSource = body.source === "booth" ? "booth" : "upload";

  if (!storagePath) {
    return NextResponse.json({ error: "Missing `storagePath`." }, { status: 400 });
  }
  // The path is attacker-controlled: keep it inside the bucket's own folders.
  if (!/^(booth|upload)\/[A-Za-z0-9-]+\.(jpg|png|webp)$/.test(storagePath)) {
    return NextResponse.json({ error: "Invalid `storagePath`." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Confirm the object is really there before creating a row for it —
  // otherwise a bogus request leaves a permanent broken tile on the wall.
  const folder = storagePath.slice(0, storagePath.indexOf("/"));
  const name = storagePath.slice(storagePath.indexOf("/") + 1);
  const { data: found, error: listError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .list(folder, { search: name, limit: 1 });

  if (listError) {
    console.error("[api/photos/publish] could not check storage", listError);
    return NextResponse.json({ error: "Could not verify the upload." }, { status: 502 });
  }
  if (!found?.some((entry) => entry.name === name)) {
    return NextResponse.json({ error: "No such upload." }, { status: 404 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from("photos")
    .insert({ source, original_url: publicUrl, status: "approved" })
    .select()
    .single();

  if (error || !data) {
    console.error("[api/photos/publish] insert failed", error);
    return NextResponse.json({ error: "Could not publish the photo." }, { status: 500 });
  }

  const photo: Photo = {
    id: data.id,
    source: data.source,
    originalUrl: data.original_url,
    editedUrl: data.edited_url,
    status: data.status,
    createdAt: data.created_at,
  };

  return NextResponse.json({ photo }, { status: 201 });
}

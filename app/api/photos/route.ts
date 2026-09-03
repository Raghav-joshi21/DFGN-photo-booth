import { NextResponse } from "next/server";

import { addPhoto, listPhotos, MAX_IMAGE_BYTES } from "@/lib/local-store/photos";
import type { PhotoSource } from "@/types";

/**
 * Local photo store endpoint — the no-Supabase path.
 *
 *   GET  /api/photos            → { photos: Photo[] }   (newest first; the wall polls this)
 *   POST /api/photos            ← { image: dataUrl, source: "booth" | "upload" }
 *                               → { photo: Photo }      (201)
 *
 * Writes go to the filesystem, so this must run on the Node runtime, and the
 * list must never be cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await listPhotos();
  return NextResponse.json({ photos }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: { image?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  const source: PhotoSource = body.source === "booth" ? "booth" : "upload";

  if (!image) {
    return NextResponse.json({ error: "Missing `image`." }, { status: 400 });
  }
  // base64 inflates bytes by ~4/3; reject obviously-oversize payloads up front.
  if (image.length > MAX_IMAGE_BYTES * 1.5) {
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  }

  try {
    const photo = await addPhoto({ image, source });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    console.error("[api/photos] could not store photo", err);
    return NextResponse.json({ error: "Could not store the photo." }, { status: 500 });
  }
}

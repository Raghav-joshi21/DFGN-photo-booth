import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import type { Photo, PhotoSource } from "@/types";

/**
 * Local, filesystem-backed photo store — the zero-config stand-in for Supabase.
 *
 * Used whenever the Supabase env vars are absent (see `hasSupabaseEnv`). Image
 * bytes are written under `public/uploads/` so Next serves them straight off
 * `/uploads/<id>.<ext>`; a flat JSON file keeps the newest-first index.
 *
 * Scope: a single event kiosk. It is not clustered, holds a short in-process
 * write lock, does no moderation (every photo lands `approved`), and keeps only
 * the most recent {@link MAX_PHOTOS} — older files are pruned from disk too.
 *
 * Server-only: importing this from a client component will fail the build.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const INDEX_FILE = path.join(process.cwd(), ".data", "photos.json");

/** Hard cap on retained photos (index rows and their files). */
export const MAX_PHOTOS = 200;

/** Reject anything larger than this once base64-decoded (~8MB). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Serialise writes: parallel POSTs must not read-modify-write the index at once.
let tail: Promise<unknown> = Promise.resolve();
function serialise<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.catch(() => {});
  return run;
}

async function readIndex(): Promise<Photo[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(INDEX_FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as Photo[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(photos: Photo[]): Promise<void> {
  await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(photos, null, 2), "utf8");
}

/** Approved photos, newest first (the wall shows these directly). */
export async function listPhotos(limit = MAX_PHOTOS): Promise<Photo[]> {
  const all = await readIndex();
  return all.slice(0, limit);
}

/**
 * Decode a data URL (or bare base64), persist the file, and prepend an index
 * row. Returns the created {@link Photo}. Throws on an undecodable/oversize
 * image.
 */
export async function addPhoto(input: {
  image: string;
  source: PhotoSource;
}): Promise<Photo> {
  const { data, contentType } = decodeImage(input.image);
  if (data.length > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the size limit.");
  }
  const ext = EXT_BY_TYPE[contentType] ?? "jpg";
  const id = crypto.randomUUID();

  return serialise(async () => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, `${id}.${ext}`), data);

    const photo: Photo = {
      id,
      source: input.source,
      originalUrl: `/uploads/${id}.${ext}`,
      editedUrl: null,
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    const kept = [photo, ...(await readIndex())];
    const dropped = kept.splice(MAX_PHOTOS);
    await writeIndex(kept);

    // Best-effort cleanup of pruned files; never fail the write over it.
    await Promise.all(
      dropped.map((p) =>
        fs
          .unlink(path.join(process.cwd(), "public", p.originalUrl))
          .catch(() => {}),
      ),
    );

    return photo;
  });
}

function decodeImage(image: string): { data: Buffer; contentType: string } {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(image.trim());
  if (match) {
    return { contentType: match[1].toLowerCase(), data: Buffer.from(match[2], "base64") };
  }
  // Bare base64 with no header — assume JPEG (what the booth canvas produces).
  return { contentType: "image/jpeg", data: Buffer.from(image, "base64") };
}

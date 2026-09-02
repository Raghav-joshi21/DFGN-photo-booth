import { NextResponse } from "next/server";

/**
 * POST /api/moderate
 *
 * Server-only route that will call an external image moderation API to decide
 * whether a photo is safe to show on the public booth wall. On completion it
 * should flip the `photos.status` to `approved` or `rejected`.
 *
 * Keep any moderation-provider credentials server-only (no `NEXT_PUBLIC_`
 * prefix). This is a scaffold — wire up the provider + Supabase update later.
 */

export const dynamic = "force-dynamic";

interface ModerateRequest {
  /** ID of the `photos` row to moderate. */
  photoId?: string;
  /** URL of the image to run moderation against. */
  imageUrl?: string;
}

export async function POST(request: Request) {
  let body: ModerateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { photoId, imageUrl } = body;
  if (!photoId || !imageUrl) {
    return NextResponse.json(
      { error: "`photoId` and `imageUrl` are required." },
      { status: 400 },
    );
  }

  // TODO: call the moderation provider, then set `photos.status` to
  // "approved" | "rejected" via the admin client in `lib/supabase/server.ts`.

  return NextResponse.json(
    { photoId, status: "pending", note: "moderate stub" },
    { status: 501 },
  );
}

import { NextResponse } from "next/server";

/**
 * POST /api/ai-edit
 *
 * Server-only route that will call an external image AI API to stylize an
 * uploaded selfie before it appears on the booth wall.
 *
 * The AI provider API key is read from `IMAGE_AI_API_KEY` (server-only — it is
 * NOT prefixed with `NEXT_PUBLIC_`, so it is never shipped to the browser).
 *
 * This is a scaffold: wire up the actual provider call and Supabase update
 * later. For now it validates input and echoes back so the upload flow can be
 * developed against a real endpoint shape.
 */

// Never statically optimize a route that depends on secrets / request body.
export const dynamic = "force-dynamic";

interface AiEditRequest {
  /** ID of the `photos` row to stylize. */
  photoId?: string;
  /** URL of the original image to send to the AI provider. */
  imageUrl?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.IMAGE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "IMAGE_AI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: AiEditRequest;
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

  // TODO: call the image AI provider with `apiKey` and `imageUrl`, upload the
  // result to Supabase Storage, then update `photos.edited_url` via the admin
  // client in `lib/supabase/server.ts`.

  return NextResponse.json(
    { photoId, editedUrl: null, status: "pending", note: "ai-edit stub" },
    { status: 501 },
  );
}

import { NextResponse } from "next/server";

import { PHOTOS_BUCKET } from "@/lib/supabase/photos";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/ai-edit
 *
 *   ← { photoId, imageUrl }
 *   → { photoId, editedUrl }
 *
 * Stylizes a photo that is ALREADY on the wall, then writes `edited_url` on its
 * row. The wall components render `editedUrl ?? originalUrl` and the Realtime
 * subscription picks up the UPDATE, so the stylized version swaps itself in
 * under the guest with no reload.
 *
 * Because the photo is already visible, every failure here is non-fatal: the
 * row keeps `edited_url` null and the original stays up. Nothing in this route
 * should ever be able to take a photo off the wall.
 *
 * Provider is Google's Gemini image model, called over plain REST — it takes an
 * input image plus a prompt and returns an edited image, which is the shape
 * this needs. `IMAGE_AI_API_KEY` holds a Google AI Studio key and is
 * server-only (no NEXT_PUBLIC_ prefix), so it never reaches the browser.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Image generation regularly runs past the default serverless limit.
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Keep the guest recognisable — this is their photo, not a generated potato. */
const STYLE_PROMPT = [
  "Restyle this photo as a cheerful hand-drawn cartoon in a warm, chunky",
  "storybook style with bold outlines and a cream background.",
  "Keep the person's face, pose, expression and framing clearly recognisable.",
  "Add a small friendly cartoon potato mascot somewhere in the scene.",
  "Do not add any text, logos or watermarks.",
].join(" ");

interface AiEditRequest {
  photoId?: string;
  imageUrl?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.IMAGE_AI_API_KEY;
  if (!apiKey || apiKey.startsWith("your-")) {
    // Placeholder or missing key: say so plainly rather than failing obscurely
    // three calls deep. The photo is on the wall either way.
    return NextResponse.json(
      { error: "IMAGE_AI_API_KEY is not configured on the server." },
      { status: 501 },
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

  try {
    const original = await fetchImage(imageUrl);
    const edited = await stylize(original, apiKey);

    const supabase = createAdminClient();
    const ext = edited.contentType === "image/jpeg" ? "jpg" : "png";
    const storagePath = `edited/${photoId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(storagePath, edited.data, {
        contentType: edited.contentType,
        // A retry for the same photo should replace its edit, not 409.
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from("photos")
      .update({ edited_url: publicUrl })
      .eq("id", photoId);
    if (updateError) throw updateError;

    return NextResponse.json({ photoId, editedUrl: publicUrl });
  } catch (err) {
    console.error("[api/ai-edit] stylize failed", err);
    return NextResponse.json(
      { error: "Could not stylize the photo.", photoId, editedUrl: null },
      { status: 502 },
    );
  }
}

/** Pull the original bytes back down from Storage's public URL. */
async function fetchImage(url: string): Promise<{ data: Buffer; contentType: string }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`could not fetch the original (${res.status})`);
  return {
    data: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? "image/jpeg",
  };
}

/** Send the photo to Gemini and pull the edited image back out of the reply. */
async function stylize(
  original: { data: Buffer; contentType: string },
  apiKey: string,
): Promise<{ data: Buffer; contentType: string }> {
  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: STYLE_PROMPT },
            {
              inline_data: {
                mime_type: original.contentType,
                data: original.data.toString("base64"),
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`gemini responded ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
    }[];
  };

  // A refusal or a safety block comes back as a normal 200 with text parts and
  // no image, so the absence of one has to be handled as its own case.
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw new Error("gemini returned no image");
  }

  return {
    data: Buffer.from(part.inlineData.data, "base64"),
    contentType: part.inlineData.mimeType ?? "image/png",
  };
}

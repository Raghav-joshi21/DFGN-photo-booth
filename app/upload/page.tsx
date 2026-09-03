"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

import {
  hasSupabaseEnv,
  triggerProcessing,
  uploadGuestPhoto,
} from "@/lib/supabase/photos";

type Status = "idle" | "uploading" | "processing" | "error";

/** Read a File as a base64 data URL (for the local, no-Supabase upload path). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload route (mobile-facing PWA).
 *
 * Guests reach this from the booth QR code, pick/take a selfie, and upload it.
 * The raw file goes to Supabase Storage and a 'pending' row is inserted; then
 * moderation + AI-edit run server-side (stubbed for now). Once approved, the
 * photo appears on the booth wall via Realtime.
 */
export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const configured = hasSupabaseEnv();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setPreviewUrl(picked ? URL.createObjectURL(picked) : null);
    setStatus("idle");
    setErrorMsg(null);
  };

  const onSubmit = async () => {
    if (!file) return;
    setStatus("uploading");
    setErrorMsg(null);
    try {
      if (configured) {
        const photo = await uploadGuestPhoto(file);
        // Fire-and-forget the (stubbed) moderation + AI-edit pipeline.
        void triggerProcessing(photo);
      } else {
        // Local store: send the file straight to the wall's API route.
        const image = await fileToDataUrl(file);
        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image, source: "upload" }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: null }));
          throw new Error(error ?? `Upload failed (${res.status}).`);
        }
      }
      setStatus("processing");
    } catch (err) {
      console.error("[upload] failed", err);
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
    }
  };

  // Success / processing state.
  if (status === "processing") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-foreground/15 border-t-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">
            {configured ? "Your photo is being processed" : "Your photo is on its way"}
          </h1>
          <p className="text-sm opacity-60">
            {configured
              ? "We're giving it an AI makeover and a quick safety check. It'll pop up on the big screen once it's approved."
              : "It'll pop up on the big screen in a moment."}
          </p>
        </motion.div>
        <button
          onClick={() => {
            setFile(null);
            setPreviewUrl(null);
            setStatus("idle");
          }}
          className="rounded-full border border-foreground/20 px-6 py-3 text-sm font-medium hover:bg-foreground/5"
        >
          Upload another
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold tracking-tight">Add your selfie</h1>
        <p className="text-sm opacity-60">
          Upload a photo from your phone. We&apos;ll give it an AI makeover and put
          it up on the big screen.
        </p>
      </motion.div>

      {/* Hidden native input; uses the front camera on phones. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={onPick}
        className="hidden"
      />

      {/* Preview / picker */}
      <button
        onClick={() => inputRef.current?.click()}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-foreground/20 bg-foreground/[0.03]"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selfie preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm opacity-50">Tap to take or choose a photo</span>
        )}
      </button>

      {errorMsg ? (
        <p className="text-xs text-red-600">{errorMsg}</p>
      ) : null}

      <button
        onClick={onSubmit}
        disabled={!file || status === "uploading"}
        className="w-full rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {status === "uploading" ? "Uploading…" : "Upload to the wall"}
      </button>
    </main>
  );
}

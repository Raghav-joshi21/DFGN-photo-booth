"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  fetchApprovedPhotos,
  hasSupabaseEnv,
  mapRow,
} from "@/lib/supabase/photos";
import type { PhotoRow } from "@/lib/supabase/types";
import type { Photo } from "@/types";

interface UseApprovedPhotos {
  photos: Photo[];
  /** True until the initial fetch resolves. */
  loading: boolean;
  /**
   * True only when there is no photo backend at all. With the local filesystem
   * store (the default) the wall works, so this is `false`.
   */
  disabled: boolean;
}

/** How often to re-poll the local store for new photos. */
const LOCAL_POLL_MS = 2500;

/**
 * Live list of approved photos for the wall.
 *
 * Two backends, picked by whether Supabase is configured:
 *  - **Supabase**: initial fetch, then Realtime Postgres changes (INSERT of an
 *    already-approved row, or UPDATE whose new status is 'approved').
 *  - **Local store** (no env vars): poll `GET /api/photos` every
 *    {@link LOCAL_POLL_MS}. The route serves a filesystem-backed, newest-first
 *    list written by the booth capture and the guest upload.
 *
 * Newest photos are first so they animate in at the top of the wall.
 */
export function useApprovedPhotos(): UseApprovedPhotos {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = hasSupabaseEnv();

  useEffect(() => {
    let active = true;

    // --- Local filesystem store: poll the API route. ---------------------
    if (!supabase) {
      const load = async () => {
        try {
          const res = await fetch("/api/photos", { cache: "no-store" });
          if (!res.ok) return;
          const { photos: next } = (await res.json()) as { photos: Photo[] };
          if (active) setPhotos(next);
        } catch {
          // Offline or route missing — keep whatever is already on the wall.
        } finally {
          if (active) setLoading(false);
        }
      };

      load();
      const timer = window.setInterval(load, LOCAL_POLL_MS);
      return () => {
        active = false;
        window.clearInterval(timer);
      };
    }

    // --- Supabase: initial fetch + Realtime. ----------------------------
    const client = createClient();

    fetchApprovedPhotos()
      .then((initial) => {
        if (active) setPhotos(initial);
      })
      .catch((err) => console.error("[booth] initial fetch failed", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    const upsert = (row: PhotoRow) => {
      if (row.status !== "approved") return;
      const photo = mapRow(row);
      setPhotos((prev) => {
        const without = prev.filter((p) => p.id !== photo.id);
        return [photo, ...without];
      });
    };

    const channel = client
      .channel("approved-photos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos" },
        (payload) => upsert(payload.new as PhotoRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "photos" },
        (payload) => upsert(payload.new as PhotoRow),
      )
      .subscribe();

    return () => {
      active = false;
      client.removeChannel(channel);
    };
  }, [supabase]);

  return { photos, loading, disabled: false };
}

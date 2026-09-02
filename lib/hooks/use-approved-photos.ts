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
  /** True when Supabase env vars are missing (dev before .env.local). */
  disabled: boolean;
}

/**
 * Live list of approved photos for the booth wall.
 *
 * Does an initial fetch, then subscribes to Realtime Postgres changes on the
 * `photos` table:
 *   - INSERT of an already-approved row (e.g. a booth self-camera capture)
 *   - UPDATE whose new status is 'approved' (a guest upload that just passed
 *     moderation) — this is the common path.
 * Newest photos are prepended so they animate in at the top of the wall.
 */
export function useApprovedPhotos(): UseApprovedPhotos {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const disabled = !hasSupabaseEnv();

  useEffect(() => {
    if (disabled) {
      setLoading(false);
      return;
    }

    let active = true;
    const supabase = createClient();

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

    const channel = supabase
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
      supabase.removeChannel(channel);
    };
  }, [disabled]);

  return { photos, loading, disabled };
}

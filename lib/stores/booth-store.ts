import { create } from "zustand";

import type { Photo } from "@/types";

/**
 * Lightweight client state for the booth kiosk.
 *
 * Zustand is used for ephemeral UI/session state that several booth components
 * share (which screen is active, the live photo wall, etc.). Durable data lives
 * in Supabase; this store is just the in-memory view the kiosk renders from.
 */

/** Which screen the kiosk is currently showing. */
export type BoothScreen = "idle" | "camera" | "game";

interface BoothState {
  screen: BoothScreen;
  /** Approved photos currently displayed on the wall, newest first. */
  photos: Photo[];
  setScreen: (screen: BoothScreen) => void;
  setPhotos: (photos: Photo[]) => void;
  addPhoto: (photo: Photo) => void;
}

export const useBoothStore = create<BoothState>((set) => ({
  screen: "idle",
  photos: [],
  setScreen: (screen) => set({ screen }),
  setPhotos: (photos) => set({ photos }),
  addPhoto: (photo) =>
    set((state) => ({ photos: [photo, ...state.photos] })),
}));

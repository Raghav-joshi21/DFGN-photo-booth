/**
 * Database types.
 *
 * This file is a hand-written stand-in for the output of:
 *
 *   supabase gen types typescript --project-id <ref> --schema public > lib/supabase/types.ts
 *
 * Once you have a live Supabase project, regenerate this file with the CLI so
 * it stays in sync with `supabase/migrations`. Until then, it mirrors the
 * `photos` table defined in `supabase/migrations/0001_init.sql`.
 */

export type PhotoSource = "booth" | "upload";
export type PhotoStatus = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      photos: {
        Row: {
          id: string;
          source: PhotoSource;
          original_url: string;
          edited_url: string | null;
          status: PhotoStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: PhotoSource;
          original_url: string;
          edited_url?: string | null;
          status?: PhotoStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: PhotoSource;
          original_url?: string;
          edited_url?: string | null;
          status?: PhotoStatus;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      photo_source: PhotoSource;
      photo_status: PhotoStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

/** Convenience row alias used across the app. */
export type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];
export type PhotoInsert = Database["public"]["Tables"]["photos"]["Insert"];

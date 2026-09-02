import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Browser-side Supabase client.
 *
 * Safe to use in client components (`"use client"`). Uses the public anon key,
 * so all access is subject to Row Level Security. This is what the booth wall
 * and the guest upload flow use for reads/uploads and Realtime subscriptions.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

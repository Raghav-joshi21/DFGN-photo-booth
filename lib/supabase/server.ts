import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client (anon key, cookie-aware).
 *
 * Use inside Server Components, Route Handlers, and Server Actions where you
 * want access scoped to the current user/session via Row Level Security.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options }),
            );
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // if you have middleware refreshing sessions.
          }
        },
      },
    },
  );
}

/**
 * Privileged server-side Supabase client (service-role key).
 *
 * BYPASSES Row Level Security. Only ever import this from server-only code
 * (Route Handlers under `app/api/*`, Server Actions, cron jobs). Never expose
 * the service-role key to the browser. Used by the AI-edit and moderation
 * routes to update rows regardless of the requesting user.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        // Service-role client is stateless; it does not read/write auth cookies.
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}

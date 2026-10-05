import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, requireSupabaseEnv } from "./config";

// Server client for Server Components, Server Functions and Route Handlers.
// Create a new one per request; never share it.
export async function createServerSupabase() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so a skipped write here is harmless.
        }
      },
    },
  });
}

// The signed-in user for this request, checked with the Supabase auth server.
// null when signed out or when accounts are not set up. Cached per request so
// the shell and the page share one lookup.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

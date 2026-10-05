"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./config";

// Browser client. Call isSupabaseConfigured() first; this throws when the
// two public variables are absent.
export function createBrowserSupabase() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

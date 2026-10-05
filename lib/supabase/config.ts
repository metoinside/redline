// The one place that decides whether accounts exist on this server.
// Both values are public by design (the anon key is safe in the browser;
// row-level security is what protects the data). No server key is read here.

export type SupabaseEnv = { url: string; anonKey: string };

export function readSupabaseEnv(): SupabaseEnv | null {
  // Written out in full so Next.js can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Check isSupabaseConfigured() before creating a client.",
    );
  }
  return env;
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthFormState =
  | { kind: "idle" }
  | { kind: "error"; message: string; email: string }
  | { kind: "check-email"; email: string };

const ACCOUNTS_OFF = "Accounts aren’t set up on this server, so you can’t sign in here.";

function errorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "email_address_invalid":
    case "validation_failed":
      return "That doesn’t look like an email address. Check it and try again.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    default:
      return `We couldn’t send the sign-in link. ${fallback}`;
  }
}

async function siteOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Sign-in is by emailed link only. The same link creates the account the first
// time an email is used, so there is no separate sign-up.
export async function sendSignInLink(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(formData.get("next"));

  if (!isSupabaseConfigured()) return { kind: "error", message: ACCOUNTS_OFF, email };
  if (!email) return { kind: "error", message: "Enter your email.", email };

  const supabase = await createServerSupabase();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: origin ? `${origin}/auth/confirm?next=${encodeURIComponent(next)}` : undefined,
    },
  });
  if (error) return { kind: "error", message: errorMessage(error.code, error.message), email };
  return { kind: "check-email", email };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}

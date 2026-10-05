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

function errorMessage(code: string | undefined, fallback: string, intent: "sign-in" | "sign-up"): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password don’t match an account.";
    case "email_not_confirmed":
      return "This account isn’t confirmed yet. Open the link in the email we sent when you signed up, then sign in.";
    case "user_already_exists":
    case "email_exists":
      return "There’s already an account for this email. Sign in instead.";
    case "weak_password":
      return `That password is too weak. ${fallback}`;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    default:
      return intent === "sign-up"
        ? `We couldn’t create the account. ${fallback}`
        : `We couldn’t sign you in. ${fallback}`;
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

export async function authenticate(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const intent = formData.get("intent") === "sign-up" ? "sign-up" : "sign-in";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!isSupabaseConfigured()) return { kind: "error", message: ACCOUNTS_OFF, email };
  if (!email || !password) {
    return { kind: "error", message: "Enter your email and a password.", email };
  }

  const supabase = await createServerSupabase();

  if (intent === "sign-in") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { kind: "error", message: errorMessage(error.code, error.message, intent), email };
    redirect(next);
  }

  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin
      ? { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` }
      : undefined,
  });
  if (error) return { kind: "error", message: errorMessage(error.code, error.message, intent), email };

  // With email confirmation on (Supabase's default), there is no session yet.
  if (!data.session) return { kind: "check-email", email };
  redirect(next);
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}

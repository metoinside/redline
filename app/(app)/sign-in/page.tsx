import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../accounts-off";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  confirm: "That sign-in link has expired or was already used. Enter your email and we’ll send a new one.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!isSupabaseConfigured()) return <AccountsOff title="Sign in" />;

  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);

  const errorKey = typeof params.error === "string" ? params.error : null;
  const notice = errorKey ? (NOTICES[errorKey] ?? null) : null;

  return (
    <section className="sheet sheet--narrow" aria-labelledby="sign-in-title">
      <header className="sheet-head">
        <h1 id="sign-in-title">Sign in</h1>
        <p>Your library keeps the contracts you add. Only you can see them.</p>
      </header>
      <SignInForm next={next} notice={notice} />
    </section>
  );
}

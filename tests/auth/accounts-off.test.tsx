import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import LibraryPage from "@/app/(app)/library/page";
import SignInPage from "@/app/(app)/sign-in/page";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// With no Supabase project connected, the account pages must say so plainly
// instead of crashing or redirecting.
beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe("account pages on a server without accounts", () => {
  it("treats a half-configured server as not configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(isSupabaseConfigured()).toBe(false);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("the library says accounts are not set up", async () => {
    const html = renderToStaticMarkup(await LibraryPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Accounts aren’t set up on this server.");
    expect(html).not.toContain("<form");
  });

  it("sign-in says accounts are not set up and shows no form", async () => {
    const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({ next: "/library" }) }));
    expect(html).toContain("Accounts aren’t set up on this server.");
    expect(html).not.toContain("<form");
  });
});

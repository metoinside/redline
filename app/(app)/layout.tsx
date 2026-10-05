import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "./sign-in/actions";
import { ShellNav } from "./shell-nav";
import "./shell.css";

// The signed-in app's own root layout (the landing page has another, in
// app/(marketing)/). Manila is the frame; each page puts its work on a sheet.

export const metadata: Metadata = {
  title: { default: "Redline", template: "%s · Redline" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Later tickets add their own entries here, once their pages exist.
const NAV = [
  { href: "/new", label: "Add a document" },
  { href: "/library", label: "Library" },
  { href: "/red-lines", label: "Red lines" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  preload("/fonts/libre-franklin-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;

  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <div className="frame">
          <header className="rail">
            <a className="wordmark" href="/">
              <span>Redline</span>
              <svg className="stroke" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 8.5C22 5 48 4.2 70 5.4c17 .9 32 2.4 47 1.6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              </svg>
            </a>
            <ShellNav items={NAV} />
            {configured && (
              <div className="account">
                {user ? (
                  <>
                    <p className="account-who">
                      <strong>Signed in as</strong> {user.email}
                    </p>
                    <form action={signOut}>
                      <button type="submit" className="link-button">Sign out</button>
                    </form>
                  </>
                ) : (
                  <a href="/sign-in">Sign in</a>
                )}
              </div>
            )}
          </header>
          <main id="main" className="work">{children}</main>
        </div>
      </body>
    </html>
  );
}

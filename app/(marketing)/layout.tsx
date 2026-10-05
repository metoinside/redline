import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import "./landing.css";

// This route group is its own root layout, so the landing stylesheet (which
// styles html, body and bare elements) never reaches the signed-in app, which
// gets its own root layout in app/(app)/. Moving between the two root layouts
// is a full page load, so no stylesheet carries over.

export const metadata: Metadata = {
  title: "Redline: renewal and exit terms, before you sign",
  description:
    "Redline reads a vendor, SaaS or service contract and flags auto-renewals, notice windows, early termination fees, rollovers and multi-year terms, each with the exact sentence it came from.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  preload("/fonts/libre-franklin-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/fonts/source-serif-4-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

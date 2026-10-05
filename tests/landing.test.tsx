import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "@/app/(marketing)/page";

const html = renderToStaticMarkup(<LandingPage />);

describe("landing page", () => {
  it("gives every flag tab a cited sentence on the sample contract to scroll to", () => {
    const targets = [...html.matchAll(/data-target="([^"]+)"/g)].map((m) => m[1]);
    const cited = [...html.matchAll(/<mark id="([^"]+)"[^>]*class="cite"/g)].map((m) => m[1]);
    expect(targets.length).toBe(6);
    expect([...targets].sort()).toEqual([...cited].sort());
  });

  it("ranks the tabs negotiate first, then know, then outside terms", () => {
    const tiers = [...html.matchAll(/<li data-rank="(\d)"><button class="tab tab--(\w+)"/g)].map((m) => [
      Number(m[1]),
      m[2],
    ]);
    expect(tiers.map(([rank]) => rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tiers.map(([, tier]) => tier)).toEqual(["negotiate", "negotiate", "negotiate", "negotiate", "know", "outside"]);
  });

  it("sends both 'Try it on a document' actions to the upload screen", () => {
    const tries = [...html.matchAll(/<a class="try" href="([^"]+)"/g)].map((m) => m[1]);
    expect(tries).toEqual(["/new", "/new"]);
  });
});

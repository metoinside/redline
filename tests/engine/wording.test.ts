import { describe, expect, it } from "vitest";
import { findWordingDefects } from "@/lib/engine/wording";

// The wording check every piece of generated text goes through (ADR 0003,
// 0005). Later tickets run their summary, counter-offers and answers through
// the same function, so its behaviour is pinned here once.

describe("findWordingDefects", () => {
  it("names each defect with the field it was found in", () => {
    expect(
      findWordingDefects([
        { field: "flag 1 statement", text: "The contract renews each year." },
        { field: "flag 2 statement", text: "This might be below-market, and it could potentially renew." },
      ]),
    ).toEqual([
      { field: "flag 2 statement", term: "might" },
      { field: "flag 2 statement", term: "below market" },
      { field: "flag 2 statement", term: "could potentially" },
    ]);
  });

  it("is case-insensitive and matches whole words only", () => {
    expect(findWordingDefects([{ field: "f", text: "PERHAPS. Standards, mayor, couldn't, typically, untypical." }])).toEqual([
      { field: "f", term: "perhaps" },
    ]);
  });

  it("catches a phrase however its words are joined", () => {
    expect(
      findWordingDefects([{ field: "f", text: "A nonstandard, industry-standard term at an above-market price." }]).map((d) => d.term),
    ).toEqual(["non-standard", "standard", "above market"]);
  });

  it("reads May next to a day or a year as the month", () => {
    expect(findWordingDefects([{ field: "f", text: "Notice is due by 2 May 2027, or May 15, or in May 2028." }])).toEqual([]);
    expect(findWordingDefects([{ field: "f", text: "May 2027 renewals may cost more." }])).toEqual([{ field: "f", term: "may" }]);
  });
});

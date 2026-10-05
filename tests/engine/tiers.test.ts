import { describe, expect, it } from "vitest";
import { assignTier } from "@/lib/engine/tiers";
import type { RedLineBreach } from "@/lib/engine/types";

// The tier rule (ADR 0003, 0005) as later tickets call it: #10 works out
// red-line breaches and passes them in. The engine passes none until then.

const noExposure = { exposure: {}, readings: ["The add-on renews with the Services."] as [string] };

describe("assignTier", () => {
  it("puts a clause with no cited exposure, one reading and no breach in Know before signing", () => {
    expect(assignTier(noExposure, [])).toBe("know");
  });

  it("puts a clause that breaches a red line in Negotiate before signing, even with nothing else cited", () => {
    const breach: RedLineBreach = { redLine: { clauseType: "auto_renewal", limit: "no auto-renewal of any kind" } };
    expect(assignTier(noExposure, [breach])).toBe("negotiate");
  });

  it("lifts a clause on a cited sum, a cited lock-in or a cited notice period, but not on an exit note with no figure", () => {
    expect(assignTier({ ...noExposure, exposure: { money: "$48,000 per year" } }, [])).toBe("negotiate");
    expect(assignTier({ ...noExposure, exposure: { lockIn: "thirty-six (36) months" } }, [])).toBe("negotiate");
    expect(assignTier({ ...noExposure, exposure: { exitDifficulty: "no later than ninety (90) days before" } }, [])).toBe("negotiate");
    expect(assignTier({ ...noExposure, exposure: { exitDifficulty: "by certified mail" } }, [])).toBe("know");
  });

  it("lifts a clause that reads two ways", () => {
    expect(assignTier({ exposure: {}, readings: ["One way.", "Another way."] }, [])).toBe("negotiate");
  });
});

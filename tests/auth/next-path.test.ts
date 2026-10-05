import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

describe("where sign-in sends the buyer next", () => {
  it("returns them to a page on this site", () => {
    expect(safeNextPath("/library")).toBe("/library");
    expect(safeNextPath("/new?from=landing#paste")).toBe("/new?from=landing#paste");
    expect(safeNextPath(["/library", "/elsewhere"])).toBe("/library");
  });

  it("sends them to the library when there is nowhere else to go", () => {
    expect(safeNextPath(undefined)).toBe("/library");
    expect(safeNextPath("")).toBe("/library");
    expect(safeNextPath("/sign-in?next=/sign-in")).toBe("/library");
  });

  it("never sends them to another site", () => {
    for (const hostile of [
      "https://evil.example/library",
      "//evil.example/library",
      "/\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
      "library",
    ]) {
      expect(safeNextPath(hostile)).toBe("/library");
    }
  });
});

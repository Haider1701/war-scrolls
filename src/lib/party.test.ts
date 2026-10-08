import { describe, expect, it } from "vitest";
import { hpTier } from "./party";

describe("hpTier", () => {
  it("above 50% is green", () => expect(hpTier(11, 20)).toBe("healthy"));
  it("25-50% is yellow", () => expect(hpTier(10, 20)).toBe("wounded"));
  it("10-25% is orange", () => expect(hpTier(3, 20)).toBe("bloodied"));
  it("under 10% is red", () => expect(hpTier(1, 20)).toBe("critical"));
  it("0 HP is down", () => expect(hpTier(0, 20)).toBe("down"));
});

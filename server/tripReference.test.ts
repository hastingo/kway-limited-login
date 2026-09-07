import { describe, expect, it } from "vitest";
import { formatTripReference } from "./portalDb";

describe("formatTripReference", () => {
  it("creates short references beginning with TRIP", () => {
    expect(formatTripReference(1)).toBe("TRIP-0001");
    expect(formatTripReference(42)).toBe("TRIP-0042");
    expect(formatTripReference(12345)).toBe("TRIP-12345");
  });
});

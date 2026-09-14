import { describe, expect, it } from "vitest";
import { calculateInvoiceLineTotal, formatInvoiceNumber } from "./portalDb";

describe("invoice calculations", () => {
  it("generates a stable K-Way invoice number from the record ID and year", () => {
    expect(formatInvoiceNumber(27, Date.UTC(2026, 8, 14))).toBe("KWL-INV-2026-0027");
  });

  it("calculates the total from truck quantity and USD unit price", () => {
    expect(calculateInvoiceLineTotal(3, 1250.75)).toBe(3752.25);
  });

  it("rounds monetary totals to two decimal places", () => {
    expect(calculateInvoiceLineTotal(3, 10.005)).toBe(30.02);
  });
});

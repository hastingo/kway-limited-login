import { describe, expect, it } from "vitest";
import { expenseInput } from "./portalRouter";

const baseExpense = {
  tripReference: "TRIP-0001",
  assetType: "truck" as const,
  expenseDate: Date.now(),
  description: "Trip operating cost",
  amount: 1000,
  attachments: [],
};

describe("expenseInput", () => {
  it("requires fuel liters for fuel expenses", () => {
    const result = expenseInput.safeParse({ ...baseExpense, expenseType: "Fuel" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("Fuel volume");
  });

  it("accepts fuel expenses with a positive liter quantity", () => {
    expect(expenseInput.safeParse({ ...baseExpense, expenseType: "Fuel", fuelLiters: 120.5 }).success).toBe(true);
  });

  it("does not require liters for other expense types", () => {
    expect(expenseInput.safeParse({ ...baseExpense, expenseType: "Road toll" }).success).toBe(true);
  });

  it("does not accept a caller-selected truck as the expense allocation source", () => {
    const result = expenseInput.parse({ ...baseExpense, truckId: 999, expenseType: "Road toll" });
    expect("truckId" in result).toBe(false);
  });
});

import { test, expect } from "bun:test";
import { formatQuantity as formatFromFridge } from "../quantity.js";
import { formatQuantity as formatFromGrocery } from "../quantity.js";

test("fridge and grocery import the same formatQuantity module", () => {
    expect(formatFromFridge).toBe(formatFromGrocery);
    expect(formatFromFridge({ amount: 48, unit: "oz" })).toBe("48 oz");
});

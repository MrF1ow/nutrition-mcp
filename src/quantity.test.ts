import { test, expect } from "bun:test";
import { convertQuantity } from "./quantity.js";

test("convertQuantity turns 48 oz into grams", () => {
    expect(convertQuantity({ amount: 48, unit: "oz" }, "g")).toEqual({
        amount: 1360.8,
        unit: "g",
    });
});

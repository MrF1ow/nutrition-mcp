import { test, expect } from "bun:test";
import { convertQuantity, parseQuantity, formatQuantity } from "./quantity.js";

test("convertQuantity turns 48 oz into grams", () => {
    expect(convertQuantity({ amount: 48, unit: "oz" }, "g")).toEqual({
        amount: 1360.8,
        unit: "g",
    });
});

test("convertQuantity converts lb to g and g to oz", () => {
    expect(convertQuantity({ amount: 1, unit: "lb" }, "g")).toEqual({
        amount: 453.6,
        unit: "g",
    });
    expect(convertQuantity({ amount: 28.3495, unit: "g" }, "oz")).toEqual({
        amount: 1,
        unit: "oz",
    });
});

test("convertQuantity converts cup and fl oz to ml", () => {
    expect(convertQuantity({ amount: 1, unit: "cup" }, "ml")).toEqual({
        amount: 240,
        unit: "ml",
    });
    expect(convertQuantity({ amount: 1, unit: "fl oz" }, "ml")).toEqual({
        amount: 29.6,
        unit: "ml",
    });
});

test("convertQuantity keeps each and gramsPerEach", () => {
    expect(
        convertQuantity({ amount: 3, unit: "each", gramsPerEach: 40 }, "each"),
    ).toEqual({ amount: 3, unit: "each", gramsPerEach: 40 });
});

test("convertQuantity refuses cross-dimension conversion", () => {
    expect(() => convertQuantity({ amount: 1, unit: "cup" }, "g")).toThrow(
        /Cannot convert cup \(volume\) to g \(mass\)/,
    );
    expect(() => convertQuantity({ amount: 2, unit: "each" }, "ml")).toThrow(
        /Cannot convert each \(count\) to ml \(volume\)/,
    );
});

test("parseQuantity and formatQuantity round-trip labeled amounts", () => {
    expect(parseQuantity("48 oz")).toEqual({ amount: 48, unit: "oz" });
    expect(formatQuantity({ amount: 1360.8, unit: "g" })).toBe("1360.8 g");
});

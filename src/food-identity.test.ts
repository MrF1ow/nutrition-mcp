import { test, expect } from "bun:test";
import { identityKey, type FoodIdentity } from "./food-identity.js";

test("two manual food rows with different names share a barcode identityKey", () => {
    const a: FoodIdentity = {
        kind: "food",
        via: "barcode",
        barcode: "070177027764",
        displayName: "Cottage Cheese",
    };
    const b: FoodIdentity = {
        kind: "food",
        via: "barcode",
        barcode: "070177027764",
        displayName: "Good Culture Cottage Cheese",
    };
    expect(identityKey(a)).toBe("food:barcode:070177027764");
    expect(identityKey(b)).toBe(identityKey(a));
});

test("catalog source id keys are stable across display names", () => {
    const a: FoodIdentity = {
        kind: "food",
        via: "catalog",
        source: "openfoodfacts",
        sourceId: "737628064502",
        displayName: "Yogurt",
    };
    const b: FoodIdentity = {
        kind: "food",
        via: "catalog",
        source: "openfoodfacts",
        sourceId: "737628064502",
        displayName: "Plain Yogurt",
    };
    expect(identityKey(a)).toBe("food:catalog:openfoodfacts:737628064502");
    expect(identityKey(b)).toBe(identityKey(a));
});

test("household-manual ids do not collapse on display name", () => {
    const a: FoodIdentity = {
        kind: "food",
        via: "manual",
        householdManualId: "hm_cottage_1",
        displayName: "cottage cheese",
    };
    const b: FoodIdentity = {
        kind: "food",
        via: "manual",
        householdManualId: "hm_cottage_2",
        displayName: "cottage cheese",
    };
    expect(identityKey(a)).toBe("food:manual:hm_cottage_1");
    expect(identityKey(b)).toBe("food:manual:hm_cottage_2");
});

test("food and supply with the same barcode keep distinct keys", () => {
    const foodKey = identityKey({
        kind: "food",
        via: "barcode",
        barcode: "070177027764",
        displayName: "Cottage Cheese",
    });
    const supplyKey = identityKey({
        kind: "supply",
        via: "barcode",
        barcode: "070177027764",
        displayName: "Cottage Cheese",
    });
    expect(foodKey).toBe("food:barcode:070177027764");
    expect(supplyKey).toBe("supply:barcode:070177027764");
});

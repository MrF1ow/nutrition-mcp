import { test, expect } from "bun:test";
import type { FoodIdentity, SupplyIdentity } from "./food-identity.js";
import { alreadyHaveTag } from "./linking.js";

const cottageBarcode: FoodIdentity = {
    kind: "food",
    via: "barcode",
    barcode: "070852010016",
    displayName: "Good Culture Cottage Cheese",
};

const sameNameDifferentManual: FoodIdentity = {
    kind: "food",
    via: "manual",
    householdManualId: "hm-cottage-a",
    displayName: "cottage cheese",
};

const otherManual: FoodIdentity = {
    kind: "food",
    via: "manual",
    householdManualId: "hm-cottage-b",
    displayName: "cottage cheese",
};

test("full cover when fridge stock meets the grocery need", () => {
    const tag = alreadyHaveTag(
        {
            identity: cottageBarcode,
            quantity: { amount: 1360.8, unit: "g" },
        },
        [
            {
                identity: {
                    ...cottageBarcode,
                    displayName: "Cottage Cheese",
                },
                quantity: { amount: 1360.8, unit: "g" },
            },
        ],
    );
    expect(tag).toEqual({ cover: "full" });
});

test("partial cover converts fridge grams into grocery ounces", () => {
    const tag = alreadyHaveTag(
        {
            identity: cottageBarcode,
            quantity: { amount: 48, unit: "oz" },
        },
        [
            {
                identity: cottageBarcode,
                quantity: { amount: 680.4, unit: "g" },
            },
        ],
    );
    expect(tag).toEqual({
        cover: "partial",
        have: { amount: 24, unit: "oz" },
        need: { amount: 24, unit: "oz" },
    });
});

test("identity mismatch on the same display name does not silently net", () => {
    const tag = alreadyHaveTag(
        {
            identity: sameNameDifferentManual,
            quantity: { amount: 400, unit: "g" },
        },
        [
            {
                identity: otherManual,
                quantity: { amount: 400, unit: "g" },
            },
        ],
    );
    expect(tag).toBeNull();
});

test("supply stock with a matching identity covers the grocery line", () => {
    const foil: SupplyIdentity = {
        kind: "supply",
        via: "manual",
        householdManualId: "hm-foil",
        displayName: "Foil",
    };
    expect(
        alreadyHaveTag(
            { identity: foil, quantity: { amount: 2, unit: "roll" } },
            [{ identity: foil, quantity: { amount: 2, unit: "roll" } }],
        ),
    ).toEqual({ cover: "full" });
});

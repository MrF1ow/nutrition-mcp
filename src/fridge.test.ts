import { test, expect } from "bun:test";
import type { FoodResult } from "./foods.js";
import {
    addFoodByBarcode,
    addLocation,
    addSupply,
    createMemoryFridgeStore,
    deleteItem,
    listFridge,
    moveItem,
    updateItemQuantity,
} from "./fridge.js";
import { renderFridgePage } from "./app/fridge/page.js";
import { ACCENT_SWATCHES } from "./app/shell.js";

const HH = "hh-1";

function food(
    over: Partial<FoodResult> & Pick<FoodResult, "name" | "barcode">,
): FoodResult {
    return {
        brand: null,
        serving: "100 g",
        calories: 80,
        protein_g: 11,
        carbs_g: 3,
        fat_g: 2,
        fiber_g: 0,
        sugar_g: 3,
        alcohol_g: null,
        nutriscore_grade: null,
        nova_group: null,
        source: `off:${over.barcode}`,
        source_name: "openfoodfacts",
        ...over,
    };
}

test("add location Pantry then lists it", async () => {
    const store = createMemoryFridgeStore();
    const loc = await addLocation(store, HH, "Pantry");
    expect(loc.name).toBe("Pantry");
    const listed = await listFridge(store, HH);
    expect(listed.locations.map((l) => l.name)).toEqual(["Pantry"]);
    expect(listed.items).toEqual([]);
});

test("add location refuses a duplicate name", async () => {
    const store = createMemoryFridgeStore();
    await addLocation(store, HH, "Pantry");
    await expect(addLocation(store, HH, "Pantry")).rejects.toThrow(
        /already exists/i,
    );
});

test("add food by barcode mock stores grams", async () => {
    const store = createMemoryFridgeStore();
    const loc = await addLocation(store, HH, "Fridge");
    const hit = food({
        name: "Good Culture Cottage Cheese",
        barcode: "070852010016",
    });
    const item = await addFoodByBarcode(
        store,
        {
            householdId: HH,
            locationId: loc.id,
            barcode: "0708-5201 0016",
            amount: 1360.8,
        },
        {
            lookup: async (barcode) => {
                expect(barcode).toBe("070852010016");
                return hit;
            },
        },
    );
    expect(item.displayName).toBe("Good Culture Cottage Cheese");
    expect(item.kind).toBe("food");
    expect(item.quantity).toEqual({ amount: 1360.8, unit: "g" });
    expect(item.identity).toEqual({
        kind: "food",
        via: "barcode",
        barcode: "070852010016",
        displayName: "Good Culture Cottage Cheese",
    });
});

test("add supply manual requires amount and unit", async () => {
    const store = createMemoryFridgeStore();
    const loc = await addLocation(store, HH, "Pantry");
    await expect(
        addSupply(store, {
            householdId: HH,
            locationId: loc.id,
            name: "Foil",
            amount: 1,
            unit: "",
        }),
    ).rejects.toThrow(/unit/i);
    await expect(
        addSupply(store, {
            householdId: HH,
            locationId: loc.id,
            name: "Foil",
            amount: 0,
            unit: "roll",
        }),
    ).rejects.toThrow(/amount/i);

    const item = await addSupply(store, {
        householdId: HH,
        locationId: loc.id,
        name: "Foil",
        amount: 2,
        unit: "roll",
    });
    expect(item.kind).toBe("supply");
    expect(item.displayName).toBe("Foil");
    expect(item.quantity).toEqual({ amount: 2, unit: "roll" });
    expect(item.identity.kind).toBe("supply");
    expect(item.identity.via).toBe("manual");
});

test("edit quantity updates the stored amount", async () => {
    const store = createMemoryFridgeStore();
    const loc = await addLocation(store, HH, "Fridge");
    const item = await addSupply(store, {
        householdId: HH,
        locationId: loc.id,
        name: "Foil",
        amount: 2,
        unit: "roll",
    });
    const updated = await updateItemQuantity(store, HH, item.id, {
        amount: 1,
        unit: "roll",
    });
    expect(updated?.quantity).toEqual({ amount: 1, unit: "roll" });
    const listed = await listFridge(store, HH);
    expect(listed.items[0]?.quantity.amount).toBe(1);
});

test("delete item removes the row", async () => {
    const store = createMemoryFridgeStore();
    const loc = await addLocation(store, HH, "Fridge");
    const item = await addSupply(store, {
        householdId: HH,
        locationId: loc.id,
        name: "Foil",
        amount: 1,
        unit: "roll",
    });
    expect(await deleteItem(store, HH, item.id)).toBe(true);
    expect((await listFridge(store, HH)).items).toEqual([]);
    expect(await deleteItem(store, HH, item.id)).toBe(false);
});

test("move item changes location", async () => {
    const store = createMemoryFridgeStore();
    const fridge = await addLocation(store, HH, "Fridge");
    const pantry = await addLocation(store, HH, "Pantry");
    const item = await addSupply(store, {
        householdId: HH,
        locationId: fridge.id,
        name: "Foil",
        amount: 1,
        unit: "roll",
    });
    const moved = await moveItem(store, HH, item.id, pantry.id);
    expect(moved?.locationId).toBe(pantry.id);
});

test("empty fridge page prompts add location then add item", () => {
    const html = renderFridgePage({
        locations: [],
        items: [],
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
    });
    expect(html).toContain("<h1>Fridge</h1>");
    expect(html).not.toContain("Coming soon.");
    expect(html.toLowerCase()).toContain("add a location");
    expect(html.toLowerCase()).toContain("add an item");
    expect(html).toContain('action="/fridge/locations"');
    expect(html).toContain('href="/fridge" aria-current="page"');
});

test("fridge page reuses quantity field and food picker", () => {
    const html = renderFridgePage({
        locations: [
            {
                id: "loc-1",
                householdId: HH,
                name: "Pantry",
                sortOrder: 0,
            },
        ],
        items: [
            {
                id: "item-1",
                householdId: HH,
                locationId: "loc-1",
                kind: "food",
                displayName: "Cottage Cheese",
                quantity: { amount: 1360.8, unit: "g" },
                identity: {
                    kind: "food",
                    via: "barcode",
                    barcode: "070852010016",
                    displayName: "Cottage Cheese",
                },
            },
            {
                id: "item-2",
                householdId: HH,
                locationId: "loc-1",
                kind: "supply",
                displayName: "Foil",
                quantity: { amount: 2, unit: "roll" },
                identity: {
                    kind: "supply",
                    via: "manual",
                    householdManualId: "hm-foil",
                    displayName: "Foil",
                },
            },
        ],
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
    });
    expect(html).toContain('class="quantity-field"');
    expect(html).toContain('class="food-picker"');
    expect(html).toContain("Cottage Cheese");
    expect(html).toContain("1360.8 g");
    expect(html).toContain("Foil");
    expect(html).toContain("2 roll");
    expect(html).toContain('value="roll"');
    expect(html).toContain('action="/fridge/items"');
});

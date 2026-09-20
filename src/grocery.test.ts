import { test, expect } from "bun:test";
import type { FoodResult } from "./foods.js";
import {
    addFoodByBarcode,
    addLocation,
    createMemoryFridgeStore,
    listFridge,
} from "./fridge.js";
import {
    addGroceryFoodByBarcode,
    addGrocerySupply,
    checkGroceryLine,
    clearCheckedLines,
    createMemoryGroceryStore,
    groceryAllergenWarning,
    listGrocery,
    resolveGrocerySectionId,
} from "./grocery.js";
import { alreadyHaveTag } from "./linking.js";
import { createGroceryStore, createMemorySettingsStore } from "./settings.js";
import { renderGroceryPage } from "./app/grocery/page.js";
import { ACCENT_SWATCHES } from "./app/shell.js";
import { addAllergen, createMemoryRulesStore } from "./rules.js";

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

async function seedStore() {
    const settings = createMemorySettingsStore();
    const store = await createGroceryStore(settings, HH, "Safeway");
    const sections = await settings.listSections(store.id);
    const dairy = sections.find((row) => row.name === "Dairy")!;
    const other = sections.find((row) => row.isOther)!;
    return { settings, store, dairy, other };
}

test("add grocery line then lists it under the chosen section", async () => {
    const grocery = createMemoryGroceryStore();
    const { settings, store, dairy } = await seedStore();
    const line = await addGroceryFoodByBarcode(
        grocery,
        settings,
        {
            householdId: HH,
            storeId: store.id,
            sectionId: dairy.id,
            barcode: "070852010016",
            amount: 1360.8,
        },
        {
            lookup: async () =>
                food({
                    name: "Good Culture Cottage Cheese",
                    barcode: "070852010016",
                }),
        },
    );
    expect(line.displayName).toBe("Good Culture Cottage Cheese");
    expect(line.checked).toBe(false);
    expect(line.quantity).toEqual({ amount: 1360.8, unit: "g" });
    const listed = await listGrocery(grocery, settings, HH);
    expect(listed.lines).toHaveLength(1);
    expect(listed.lines[0]?.sectionId).toBe(dairy.id);
});

test("check line stays on the list and does not insert into fridge", async () => {
    const grocery = createMemoryGroceryStore();
    const fridge = createMemoryFridgeStore();
    const { settings, store, dairy } = await seedStore();
    await addLocation(fridge, HH, "Fridge");
    const line = await addGrocerySupply(grocery, settings, {
        householdId: HH,
        storeId: store.id,
        sectionId: dairy.id,
        name: "Foil",
        amount: 1,
        unit: "roll",
    });
    const checked = await checkGroceryLine(grocery, HH, line.id, true);
    expect(checked?.checked).toBe(true);
    const listed = await listGrocery(grocery, settings, HH);
    expect(listed.lines).toHaveLength(1);
    expect(listed.lines[0]?.checked).toBe(true);
    expect((await listFridge(fridge, HH)).items).toEqual([]);
});

test("clear checked removes only checked rows", async () => {
    const grocery = createMemoryGroceryStore();
    const { settings, store, dairy } = await seedStore();
    const keep = await addGrocerySupply(grocery, settings, {
        householdId: HH,
        storeId: store.id,
        sectionId: dairy.id,
        name: "Wipes",
        amount: 1,
        unit: "pack",
    });
    const drop = await addGrocerySupply(grocery, settings, {
        householdId: HH,
        storeId: store.id,
        sectionId: dairy.id,
        name: "Foil",
        amount: 1,
        unit: "roll",
    });
    await checkGroceryLine(grocery, HH, drop.id, true);
    const removed = await clearCheckedLines(grocery, HH);
    expect(removed).toBe(1);
    const listed = await listGrocery(grocery, settings, HH);
    expect(listed.lines.map((row) => row.id)).toEqual([keep.id]);
});

test("unknown section files the line under Other", async () => {
    const grocery = createMemoryGroceryStore();
    const { settings, store, other } = await seedStore();
    expect(await resolveGrocerySectionId(settings, store.id, "")).toBe(
        other.id,
    );
    const line = await addGrocerySupply(grocery, settings, {
        householdId: HH,
        storeId: store.id,
        name: "Batteries",
        amount: 4,
        unit: "each",
    });
    expect(line.sectionId).toBe(other.id);
});

test("matching fridge stock tags the grocery line already-have", async () => {
    const grocery = createMemoryGroceryStore();
    const fridge = createMemoryFridgeStore();
    const { settings, store, dairy } = await seedStore();
    const loc = await addLocation(fridge, HH, "Fridge");
    const fridgeItem = await addFoodByBarcode(
        fridge,
        {
            householdId: HH,
            locationId: loc.id,
            barcode: "070852010016",
            amount: 1360.8,
        },
        {
            lookup: async () =>
                food({
                    name: "Good Culture Cottage Cheese",
                    barcode: "070852010016",
                }),
        },
    );
    const line = await addGroceryFoodByBarcode(
        grocery,
        settings,
        {
            householdId: HH,
            storeId: store.id,
            sectionId: dairy.id,
            barcode: "070852010016",
            amount: 1360.8,
        },
        {
            lookup: async () =>
                food({
                    name: "Good Culture Cottage Cheese",
                    barcode: "070852010016",
                }),
        },
    );
    expect(alreadyHaveTag(line, [fridgeItem])).toEqual({ cover: "full" });
});

test("grocery allergen warning blocks peanut for an affected member", async () => {
    const rules = createMemoryRulesStore();
    await addAllergen(rules, {
        householdId: HH,
        userId: "bob",
        allergen: "peanut",
    });
    const allergens = await rules.listAllergens(HH, "bob");
    const warning = groceryAllergenWarning("Peanut Butter", [
        { displayName: "Bob", allergens },
    ]);
    expect(warning?.blocking).toBe(true);
    expect(warning?.text.toLowerCase()).toContain("peanut");
    expect(warning?.text).toContain("Bob");
});

test("grocery page groups by store then section and shows already-have", () => {
    const html = renderGroceryPage({
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
        stores: [
            {
                id: "st-1",
                householdId: HH,
                name: "Safeway",
                sortOrder: 0,
                rules: [],
                sections: [
                    {
                        id: "sec-dairy",
                        householdId: HH,
                        storeId: "st-1",
                        name: "Dairy",
                        sortOrder: 1,
                        hidden: false,
                        isOther: false,
                        lines: [
                            {
                                id: "line-1",
                                householdId: HH,
                                storeId: "st-1",
                                sectionId: "sec-dairy",
                                kind: "food",
                                displayName: "Cottage Cheese",
                                quantity: { amount: 1360.8, unit: "g" },
                                identity: {
                                    kind: "food",
                                    via: "barcode",
                                    barcode: "070852010016",
                                    displayName: "Cottage Cheese",
                                },
                                checked: false,
                                alreadyHave: { cover: "full" },
                            },
                        ],
                    },
                ],
            },
        ],
    });
    expect(html).toContain("<h1>Groceries</h1>");
    expect(html).not.toContain("Coming soon.");
    expect(html).toContain("Safeway");
    expect(html).toContain("Dairy");
    expect(html).toContain("Cottage Cheese");
    expect(html).toContain('class="already-have-tag"');
    expect(html).toContain("already have");
    expect(html).toContain('class="quantity-field"');
    expect(html).toContain('class="food-picker"');
    expect(html).toContain('href="/grocery" aria-current="page"');
    expect(html).toContain('action="/grocery/lines"');
    expect(html).toContain('action="/grocery/clear-checked"');
});

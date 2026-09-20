import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bottomNav as shellBottomNav } from "../shell.js";
import { bottomNav as componentBottomNav } from "./bottom-nav.js";
import { renderQuantityField } from "./quantity-field.js";
import {
    renderFoodPicker,
    searchPickerFoods,
    runBarcodeLookupAction,
} from "./food-picker.js";
import { renderFridgePage } from "../fridge/page.js";
import { renderGroceryPage } from "../grocery/page.js";
import { ACCENT_SWATCHES } from "../shell.js";
import {
    DEMO_HOUSEHOLD_MEMBERS,
    renderMemberMultiSelect,
} from "./member-multi-select.js";
import { renderStoreSectionList } from "./store-section-list.js";
import type { FoodResult } from "../../foods.js";

const appDir = join(import.meta.dir, "..");

function stubSource(file: string): string {
    return readFileSync(join(appDir, file), "utf8");
}

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

test("fridge page and grocery page import the same quantity-field and food-picker modules", () => {
    const fridgeSrc = stubSource("fridge/page.ts");
    const grocerySrc = stubSource("grocery/page.ts");
    expect(fridgeSrc).toContain('from "../components/quantity-field.js"');
    expect(grocerySrc).toContain('from "../components/quantity-field.js"');
    expect(fridgeSrc).toContain('from "../components/food-picker.js"');
    expect(grocerySrc).toContain('from "../components/food-picker.js"');

    const fridge = renderFridgePage({
        locations: [
            {
                id: "loc-1",
                householdId: "hh-1",
                name: "Pantry",
                sortOrder: 0,
            },
        ],
        items: [],
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
    });
    const grocery = renderGroceryPage({
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
        stores: [
            {
                id: "st-1",
                householdId: "hh-1",
                name: "Safeway",
                sortOrder: 0,
                rules: [],
                sections: [
                    {
                        id: "sec-other",
                        householdId: "hh-1",
                        storeId: "st-1",
                        name: "Other",
                        sortOrder: 8,
                        hidden: false,
                        isOther: true,
                        lines: [],
                    },
                ],
            },
        ],
    });
    expect(fridge).toContain('class="quantity-field"');
    expect(grocery).toContain('class="quantity-field"');
    expect(fridge).toContain('class="food-picker"');
    expect(grocery).toContain('class="food-picker"');
});

test("quantity field food kind defaults to grams and supply lists units", () => {
    const foodHtml = renderQuantityField({ kind: "food" });
    expect(foodHtml).toContain('class="quantity-field"');
    expect(foodHtml).toContain('data-kind="food"');
    expect(foodHtml).toMatch(/<option value="g"[^>]*selected/);
    expect(foodHtml).not.toContain('value="oz"');
    expect(foodHtml).not.toContain('value="lb"');
    expect(foodHtml).not.toContain('value="cup"');

    const supplyHtml = renderQuantityField({ kind: "supply" });
    expect(supplyHtml).toContain('data-kind="supply"');
    for (const unit of ["g", "oz", "lb", "ml", "fl oz", "cup", "each"]) {
        expect(supplyHtml).toContain(`value="${unit}"`);
    }
});

test("bottom-nav re-exports the shell nav helper", () => {
    expect(componentBottomNav).toBe(shellBottomNav);
});

test("food picker HTML has barcode, search, and manual tabs", () => {
    const html = renderFoodPicker();
    expect(html).toContain('class="food-picker"');
    expect(html).toContain('data-tab="barcode"');
    expect(html).toContain('data-tab="search"');
    expect(html).toContain('data-tab="manual"');
    expect(html).toContain('class="quantity-field"');
    expect(html).toContain('data-lookup-path="lookupBarcode"');
});

test("member multi-select, already-have, and store sections still render", () => {
    const members = renderMemberMultiSelect(DEMO_HOUSEHOLD_MEMBERS, [
        DEMO_HOUSEHOLD_MEMBERS[0]!.userId,
    ]);
    expect(members).toContain('class="member-multi-select"');
    expect(members).toContain('type="checkbox"');
    expect(members).toContain("Alice");
    expect(members).toContain("Bob");
    const grocery = renderGroceryPage({
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
        stores: [
            {
                id: "st-1",
                householdId: "hh-1",
                name: "Safeway",
                sortOrder: 0,
                rules: [],
                sections: [
                    {
                        id: "sec-produce",
                        householdId: "hh-1",
                        storeId: "st-1",
                        name: "Produce",
                        sortOrder: 0,
                        hidden: false,
                        isOther: false,
                        lines: [
                            {
                                id: "line-1",
                                householdId: "hh-1",
                                storeId: "st-1",
                                sectionId: "sec-produce",
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
                                alreadyHave: {
                                    cover: "partial",
                                    have: { amount: 24, unit: "oz" },
                                    need: { amount: 24, unit: "oz" },
                                },
                            },
                        ],
                    },
                    {
                        id: "sec-other",
                        householdId: "hh-1",
                        storeId: "st-1",
                        name: "Other",
                        sortOrder: 8,
                        hidden: false,
                        isOther: true,
                        lines: [],
                    },
                ],
            },
        ],
    });
    expect(grocery).toContain('class="already-have-tag"');
    expect(grocery.toLowerCase()).toMatch(/have .+ need /);
    expect(grocery).toContain("Produce");
    expect(grocery).toContain("Other");
    const sections = renderStoreSectionList();
    expect(sections).toContain('class="store-section-list"');
    expect(sections).toContain("Produce");
    expect(sections).toContain("Other");
});

test("searchPickerFoods uses searchFoodsByName hooks", async () => {
    const hit = food({
        name: "Good Culture Cottage Cheese",
        barcode: "070852010016",
    });
    const results = await searchPickerFoods("cottage", [], {
        searchCache: async () => [],
        searchOff: async () => [hit],
        remember: async () => {},
    });
    expect(results).toEqual([hit]);
});

test("runBarcodeLookupAction normalizes digits then calls lookupBarcode", async () => {
    const hit = food({ name: "Nutella", barcode: "3017620422003" });
    const seen: string[] = [];
    const result = await runBarcodeLookupAction(" 3017-6204 22003 ", {
        lookup: async (barcode) => {
            seen.push(barcode);
            return hit;
        },
    });
    expect(seen).toEqual(["3017620422003"]);
    expect(result).toEqual({ barcode: "3017620422003", food: hit });
});

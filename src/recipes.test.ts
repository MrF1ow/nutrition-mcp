import { test, expect } from "bun:test";
import type { FoodIdentity } from "./food-identity.js";
import {
    addFoodByBarcode,
    addLocation,
    createMemoryFridgeStore,
} from "./fridge.js";
import { createMemoryGroceryStore, listGrocery } from "./grocery.js";
import { recipeToGroceryRemainder } from "./linking.js";
import {
    addRecipeIngredientByBarcode,
    addRecipeManualIngredient,
    addRecipeToGrocery,
    amountForPortion,
    createMemoryRecipesStore,
    createRecipe,
    deleteRecipe,
    getRecipeView,
    listRecipes,
    macrosForPerson,
    perPortionAmount,
    RecipeForbiddenError,
    RecipeInputError,
    setPersonPortion,
} from "./recipes.js";
import { createGroceryStore, createMemorySettingsStore } from "./settings.js";
import {
    renderRecipeDetailPage,
    renderRecipesPage,
} from "./app/recipes/page.js";
import { ACCENT_SWATCHES } from "./app/shell.js";
import type { FoodResult } from "./foods.js";

const HH = "hh-1";
const ALICE = "alice";
const BOB = "bob";

const cottage: FoodIdentity = {
    kind: "food",
    via: "barcode",
    barcode: "070852010016",
    displayName: "Cottage Cheese",
};

function food(
    over: Partial<FoodResult> & Pick<FoodResult, "name" | "barcode">,
): FoodResult {
    return {
        brand: null,
        serving: "100 g",
        calories: 98,
        protein_g: 11,
        carbs_g: 3,
        fat_g: 4.3,
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

test("yield math splits batch totals into per-portion amounts", async () => {
    const store = createMemoryRecipesStore();
    const recipe = await createRecipe(store, {
        householdId: HH,
        creatorId: ALICE,
        name: "Mac",
        yieldPortions: 4,
    });
    const ingredient = await addRecipeManualIngredient(store, {
        householdId: HH,
        recipeId: recipe.id,
        name: "Pasta",
        amount: 400,
    });
    expect(perPortionAmount(ingredient.quantity.amount, 4)).toBe(100);
    expect(amountForPortion(ingredient.quantity.amount, 4, 1)).toBe(100);
});

test("person portion override scales that person's amounts and macros", async () => {
    const store = createMemoryRecipesStore();
    const recipe = await createRecipe(store, {
        householdId: HH,
        creatorId: ALICE,
        name: "Mac",
        yieldPortions: 4,
    });
    await addRecipeIngredientByBarcode(
        store,
        {
            householdId: HH,
            recipeId: recipe.id,
            barcode: "070852010016",
            amount: 400,
        },
        {
            lookup: async () =>
                food({
                    name: "Cottage Cheese",
                    barcode: "070852010016",
                }),
        },
    );
    await setPersonPortion(store, {
        householdId: HH,
        recipeId: recipe.id,
        userId: ALICE,
        portionCount: 2,
    });
    const view = await getRecipeView(store, HH, recipe.id, ALICE);
    expect(view.portionCount).toBe(2);
    expect(view.ingredients[0]?.personAmount).toBe(200);
    const macros = macrosForPerson(view.ingredients, view.yieldPortions, 2);
    expect(macros.incomplete).toBe(false);
    expect(macros.calories).toBe(196);
    expect(macros.protein_g).toBe(22);
});

test("creator can delete and a non-creator member cannot", async () => {
    const store = createMemoryRecipesStore();
    const recipe = await createRecipe(store, {
        householdId: HH,
        creatorId: ALICE,
        name: "Soup",
        yieldPortions: 2,
    });
    await expect(
        deleteRecipe(store, HH, recipe.id, { userId: BOB, isOwner: false }),
    ).rejects.toBeInstanceOf(RecipeForbiddenError);
    expect(await listRecipes(store, HH)).toHaveLength(1);
    expect(
        await deleteRecipe(store, HH, recipe.id, {
            userId: ALICE,
            isOwner: false,
        }),
    ).toBe(true);
    expect(await listRecipes(store, HH)).toEqual([]);
});

test("household owner can delete a member-created recipe", async () => {
    const store = createMemoryRecipesStore();
    const recipe = await createRecipe(store, {
        householdId: HH,
        creatorId: BOB,
        name: "Salad",
        yieldPortions: 1,
    });
    expect(
        await deleteRecipe(store, HH, recipe.id, {
            userId: ALICE,
            isOwner: true,
        }),
    ).toBe(true);
    expect(await listRecipes(store, HH)).toEqual([]);
});

test("manual ingredients without nutrition mark macros incomplete", async () => {
    const store = createMemoryRecipesStore();
    const recipe = await createRecipe(store, {
        householdId: HH,
        creatorId: ALICE,
        name: "Mystery",
        yieldPortions: 2,
    });
    await addRecipeManualIngredient(store, {
        householdId: HH,
        recipeId: recipe.id,
        name: "Whatever",
        amount: 50,
    });
    const view = await getRecipeView(store, HH, recipe.id, ALICE);
    const macros = macrosForPerson(view.ingredients, view.yieldPortions, 1);
    expect(macros.incomplete).toBe(true);
    expect(macros.calories).toBeNull();
});

test("add-to-grocery writes remainder lines and skips full fridge cover", async () => {
    const recipes = createMemoryRecipesStore();
    const grocery = createMemoryGroceryStore();
    const fridge = createMemoryFridgeStore();
    const settings = createMemorySettingsStore();
    const store = await createGroceryStore(settings, HH, "Safeway");
    const loc = await addLocation(fridge, HH, "Fridge");
    await addFoodByBarcode(
        fridge,
        {
            householdId: HH,
            locationId: loc.id,
            barcode: "070852010016",
            amount: 50,
        },
        {
            lookup: async () =>
                food({ name: "Cottage Cheese", barcode: "070852010016" }),
        },
    );
    await addFoodByBarcode(
        fridge,
        {
            householdId: HH,
            locationId: loc.id,
            barcode: "8076809513388",
            amount: 200,
        },
        {
            lookup: async () =>
                food({ name: "Pasta", barcode: "8076809513388" }),
        },
    );
    const recipe = await createRecipe(recipes, {
        householdId: HH,
        creatorId: ALICE,
        name: "Mac",
        yieldPortions: 4,
    });
    await addRecipeIngredientByBarcode(
        recipes,
        {
            householdId: HH,
            recipeId: recipe.id,
            barcode: "070852010016",
            amount: 400,
        },
        {
            lookup: async () =>
                food({ name: "Cottage Cheese", barcode: "070852010016" }),
        },
    );
    await addRecipeIngredientByBarcode(
        recipes,
        {
            householdId: HH,
            recipeId: recipe.id,
            barcode: "8076809513388",
            amount: 200,
        },
        {
            lookup: async () =>
                food({ name: "Pasta", barcode: "8076809513388" }),
        },
    );
    const fridgeItems = (await fridge.listItems(HH)).map((item) => ({
        identity: item.identity,
        quantity: item.quantity,
    }));
    const recipeRow = (await listRecipes(recipes, HH))[0]!;
    const ingredients = (await getRecipeView(recipes, HH, recipe.id, ALICE))
        .ingredients;
    const plan = recipeToGroceryRemainder({
        ingredients: ingredients.map((row) => ({
            identity: row.identity,
            displayName: row.displayName,
            quantity: row.quantity,
        })),
        yieldPortions: recipeRow.yieldPortions,
        portionCounts: [1],
        stock: fridgeItems,
    });
    const cottageLine = plan.find(
        (row) => row.displayName === "Cottage Cheese",
    );
    const pastaLine = plan.find((row) => row.displayName === "Pasta");
    expect(cottageLine?.skipped).toBe(false);
    expect(cottageLine?.remainder).toEqual({ amount: 50, unit: "g" });
    expect(pastaLine?.skipped).toBe(true);
    expect(pastaLine?.remainder).toBeNull();

    const result = await addRecipeToGrocery({
        recipes,
        grocery,
        settings,
        fridgeItems,
        householdId: HH,
        recipeId: recipe.id,
        storeId: store.id,
        portionCounts: [1],
    });
    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    const listed = await listGrocery(grocery, settings, HH);
    expect(listed.lines).toHaveLength(1);
    expect(listed.lines[0]?.displayName).toBe("Cottage Cheese");
    expect(listed.lines[0]?.quantity).toEqual({ amount: 50, unit: "g" });
    expect(listed.lines[0]?.identity).toEqual(cottage);
});

test("create recipe requires a name and a positive yield", async () => {
    const store = createMemoryRecipesStore();
    await expect(
        createRecipe(store, {
            householdId: HH,
            creatorId: ALICE,
            name: "  ",
            yieldPortions: 4,
        }),
    ).rejects.toBeInstanceOf(RecipeInputError);
    await expect(
        createRecipe(store, {
            householdId: HH,
            creatorId: ALICE,
            name: "Mac",
            yieldPortions: 0,
        }),
    ).rejects.toBeInstanceOf(RecipeInputError);
});

test("recipes list page is not a stub and detail reuses shared picker", () => {
    const list = renderRecipesPage({
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
        recipes: [
            {
                id: "r1",
                householdId: HH,
                creatorId: ALICE,
                name: "Mac",
                yieldPortions: 4,
            },
        ],
        members: [{ userId: ALICE, displayName: "Alice" }],
        viewerId: ALICE,
    });
    expect(list).toContain("<h1>Recipes</h1>");
    expect(list).not.toContain("Coming soon.");
    expect(list).toContain("Mac");
    expect(list).toContain('href="/recipes" aria-current="page"');
    expect(list).toContain('action="/recipes"');

    const detail = renderRecipeDetailPage({
        chrome: { theme: "light", accent: ACCENT_SWATCHES.sky },
        recipe: {
            id: "r1",
            householdId: HH,
            creatorId: ALICE,
            name: "Mac",
            yieldPortions: 4,
        },
        ingredients: [
            {
                id: "i1",
                householdId: HH,
                recipeId: "r1",
                kind: "food",
                displayName: "Cottage Cheese",
                quantity: { amount: 400, unit: "g" },
                identity: cottage,
                nutrition: {
                    calories: 98,
                    protein_g: 11,
                    carbs_g: 3,
                    fat_g: 4.3,
                    fiber_g: 0,
                    sugar_g: 3,
                    alcohol_g: null,
                    basisAmount: 100,
                    basisUnit: "g",
                },
                sortOrder: 0,
                perPortionAmount: 100,
                personAmount: 100,
            },
        ],
        members: [
            { userId: ALICE, displayName: "Alice" },
            { userId: BOB, displayName: "Bob" },
        ],
        stores: [{ id: "st-1", name: "Safeway" }],
        viewerId: ALICE,
        filterUserId: ALICE,
        portionCount: 1,
        macros: {
            calories: 98,
            protein_g: 11,
            carbs_g: 3,
            fat_g: 4.3,
            fiber_g: 0,
            sugar_g: 3,
            alcohol_g: null,
            incomplete: false,
        },
        allergenWarning: "Contains peanut — Bob.",
        dislikeNote: "Bob dislikes cilantro.",
        isOwner: true,
    });
    expect(detail).toContain('class="quantity-field"');
    expect(detail).toContain('class="food-picker"');
    expect(detail).toContain('class="member-multi-select"');
    expect(detail).toContain("For who");
    expect(detail).toContain(`value="${ALICE}"`);
    expect(detail).toMatch(new RegExp(`value="${ALICE}"[^>]*checked`));
    expect(detail).toContain("100 g");
    expect(detail).not.toContain("Macros incomplete");
    expect(detail).toContain('data-calories="98"');
    expect(detail).toContain('data-blocking="true"');
    expect(detail).toContain("Contains peanut — Bob.");
    expect(detail).toContain('class="dislike-note"');
    expect(detail).toContain("Bob dislikes cilantro.");
    expect(detail).toContain('action="/recipes/r1/add-to-grocery"');
    expect(detail).toContain('action="/recipes/r1/delete"');
});

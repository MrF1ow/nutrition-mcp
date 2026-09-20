import type { FoodIdentity, SupplyIdentity } from "./food-identity.js";
import { normalizeBarcode, type FoodResult } from "./foods.js";
import {
    resolveGrocerySectionId,
    type GroceryLine,
    type GroceryListStore,
} from "./grocery.js";
import {
    recipeToGroceryRemainder,
    type LinkedNeed,
    type RecipeGroceryRemainderLine,
} from "./linking.js";
import {
    convertQuantity,
    isQuantityUnit,
    type Quantity,
    type QuantityUnit,
} from "./quantity.js";
import type { SettingsStore } from "./settings.js";

export type Recipe = {
    id: string;
    householdId: string;
    creatorId: string;
    name: string;
    yieldPortions: number;
};

export type IngredientNutrition = {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    alcohol_g: number | null;
    basisAmount: number;
    basisUnit: string;
};

export type RecipeIngredient = {
    id: string;
    householdId: string;
    recipeId: string;
    kind: "food";
    displayName: string;
    quantity: { amount: number; unit: string };
    identity: FoodIdentity | SupplyIdentity;
    nutrition: IngredientNutrition | null;
    sortOrder: number;
};

export type RecipePortion = {
    recipeId: string;
    householdId: string;
    userId: string;
    portionCount: number;
};

export type RecipeIngredientView = RecipeIngredient & {
    perPortionAmount: number;
    personAmount: number;
};

export type RecipeView = Recipe & {
    portionCount: number;
    ingredients: RecipeIngredientView[];
};

export type RecipeMacros = {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    alcohol_g: number | null;
    incomplete: boolean;
};

export type RecipesStore = {
    listRecipes(householdId: string): Promise<Recipe[]>;
    getRecipe(householdId: string, id: string): Promise<Recipe | null>;
    insertRecipe(row: Recipe): Promise<Recipe>;
    deleteRecipe(householdId: string, id: string): Promise<boolean>;
    listIngredients(
        householdId: string,
        recipeId: string,
    ): Promise<RecipeIngredient[]>;
    insertIngredient(row: RecipeIngredient): Promise<RecipeIngredient>;
    getPortion(
        householdId: string,
        recipeId: string,
        userId: string,
    ): Promise<RecipePortion | null>;
    upsertPortion(row: RecipePortion): Promise<RecipePortion>;
};

export class RecipeInputError extends Error {
    readonly code = "recipe_input" as const;

    constructor(message: string) {
        super(message);
        this.name = "RecipeInputError";
    }
}

export class RecipeForbiddenError extends Error {
    readonly code = "recipe_forbidden" as const;

    constructor(message: string) {
        super(message);
        this.name = "RecipeForbiddenError";
    }
}

function roundAmount(amount: number): number {
    return Math.round(amount * 10) / 10;
}

function parseAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new RecipeInputError("Enter an amount greater than zero.");
    }
    return amount;
}

function parseYield(yieldPortions: number): number {
    if (!Number.isFinite(yieldPortions) || yieldPortions <= 0) {
        throw new RecipeInputError("Enter a yield greater than zero.");
    }
    return yieldPortions;
}

export function perPortionAmount(
    totalAmount: number,
    yieldPortions: number,
): number {
    return roundAmount(totalAmount / yieldPortions);
}

export function amountForPortion(
    totalAmount: number,
    yieldPortions: number,
    portionCount: number,
): number {
    return roundAmount(totalAmount * (portionCount / yieldPortions));
}

export function nutritionFromFood(
    food: FoodResult,
): IngredientNutrition | null {
    const nutrition: IngredientNutrition = {
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
        sugar_g: food.sugar_g,
        alcohol_g: food.alcohol_g,
        basisAmount: 100,
        basisUnit: "g",
    };
    if (
        nutrition.calories == null &&
        nutrition.protein_g == null &&
        nutrition.carbs_g == null &&
        nutrition.fat_g == null
    ) {
        return null;
    }
    return nutrition;
}

export function isNutritionComplete(
    nutrition: IngredientNutrition | null,
): boolean {
    if (nutrition == null) return false;
    return (
        nutrition.calories != null &&
        nutrition.protein_g != null &&
        nutrition.carbs_g != null &&
        nutrition.fat_g != null
    );
}

function convertToUnit(
    amount: number,
    from: string,
    to: string,
): number | null {
    if (from === to) return amount;
    if (!isQuantityUnit(from) || !isQuantityUnit(to)) return null;
    try {
        return convertQuantity(
            { amount, unit: from } as Quantity,
            to as QuantityUnit,
        ).amount;
    } catch {
        return null;
    }
}

function scaleNutrient(value: number | null, factor: number): number | null {
    if (value == null) return null;
    return roundAmount(value * factor);
}

export function macrosForPerson(
    ingredients: RecipeIngredient[],
    yieldPortions: number,
    portionCount: number,
): RecipeMacros {
    let incomplete = false;
    const sum: RecipeMacros = {
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        sugar_g: null,
        alcohol_g: null,
        incomplete: false,
    };
    for (const ingredient of ingredients) {
        if (!isNutritionComplete(ingredient.nutrition)) {
            incomplete = true;
            continue;
        }
        const nutrition = ingredient.nutrition!;
        const eaten = amountForPortion(
            ingredient.quantity.amount,
            yieldPortions,
            portionCount,
        );
        const eatenInBasis = convertToUnit(
            eaten,
            ingredient.quantity.unit,
            nutrition.basisUnit,
        );
        if (eatenInBasis == null || nutrition.basisAmount <= 0) {
            incomplete = true;
            continue;
        }
        const factor = eatenInBasis / nutrition.basisAmount;
        const add = (key: keyof Omit<RecipeMacros, "incomplete">) => {
            const scaled = scaleNutrient(nutrition[key], factor);
            if (scaled == null && sum[key] == null) return;
            sum[key] = roundAmount((sum[key] ?? 0) + (scaled ?? 0));
        };
        add("calories");
        add("protein_g");
        add("carbs_g");
        add("fat_g");
        add("fiber_g");
        add("sugar_g");
        add("alcohol_g");
    }
    sum.incomplete = incomplete;
    return sum;
}

export function createMemoryRecipesStore(): RecipesStore {
    const recipes: Recipe[] = [];
    const ingredients: RecipeIngredient[] = [];
    const portions: RecipePortion[] = [];
    return {
        async listRecipes(householdId) {
            return recipes
                .filter((row) => row.householdId === householdId)
                .map((row) => ({ ...row }));
        },
        async getRecipe(householdId, id) {
            const row = recipes.find(
                (recipe) =>
                    recipe.householdId === householdId && recipe.id === id,
            );
            return row ? { ...row } : null;
        },
        async insertRecipe(row) {
            recipes.push({ ...row });
            return { ...row };
        },
        async deleteRecipe(householdId, id) {
            const before = recipes.length;
            const next = recipes.filter(
                (row) => !(row.householdId === householdId && row.id === id),
            );
            const removed = next.length < before;
            recipes.length = 0;
            recipes.push(...next);
            const keepIng = ingredients.filter(
                (row) =>
                    !(row.householdId === householdId && row.recipeId === id),
            );
            ingredients.length = 0;
            ingredients.push(...keepIng);
            const keepPortions = portions.filter(
                (row) =>
                    !(row.householdId === householdId && row.recipeId === id),
            );
            portions.length = 0;
            portions.push(...keepPortions);
            return removed;
        },
        async listIngredients(householdId, recipeId) {
            return ingredients
                .filter(
                    (row) =>
                        row.householdId === householdId &&
                        row.recipeId === recipeId,
                )
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((row) => ({
                    ...row,
                    quantity: { ...row.quantity },
                    nutrition: row.nutrition ? { ...row.nutrition } : null,
                }));
        },
        async insertIngredient(row) {
            const saved = {
                ...row,
                quantity: { ...row.quantity },
                nutrition: row.nutrition ? { ...row.nutrition } : null,
            };
            ingredients.push(saved);
            return {
                ...saved,
                quantity: { ...saved.quantity },
                nutrition: saved.nutrition ? { ...saved.nutrition } : null,
            };
        },
        async getPortion(householdId, recipeId, userId) {
            const row = portions.find(
                (portion) =>
                    portion.householdId === householdId &&
                    portion.recipeId === recipeId &&
                    portion.userId === userId,
            );
            return row ? { ...row } : null;
        },
        async upsertPortion(row) {
            const idx = portions.findIndex(
                (portion) =>
                    portion.householdId === row.householdId &&
                    portion.recipeId === row.recipeId &&
                    portion.userId === row.userId,
            );
            if (idx >= 0) portions[idx] = { ...row };
            else portions.push({ ...row });
            return { ...row };
        },
    };
}

export async function listRecipes(
    store: RecipesStore,
    householdId: string,
): Promise<Recipe[]> {
    return store.listRecipes(householdId);
}

export async function createRecipe(
    store: RecipesStore,
    input: {
        householdId: string;
        creatorId: string;
        name: string;
        yieldPortions: number;
    },
): Promise<Recipe> {
    const name = input.name.trim();
    if (!name) throw new RecipeInputError("Enter a recipe name.");
    const yieldPortions = parseYield(input.yieldPortions);
    return store.insertRecipe({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        creatorId: input.creatorId,
        name,
        yieldPortions,
    });
}

export async function deleteRecipe(
    store: RecipesStore,
    householdId: string,
    recipeId: string,
    actor: { userId: string; isOwner: boolean },
): Promise<boolean> {
    const recipe = await store.getRecipe(householdId, recipeId);
    if (!recipe) return false;
    if (recipe.creatorId !== actor.userId && !actor.isOwner) {
        throw new RecipeForbiddenError(
            "Only the creator or household owner can delete this recipe.",
        );
    }
    return store.deleteRecipe(householdId, recipeId);
}

async function requireRecipe(
    store: RecipesStore,
    householdId: string,
    recipeId: string,
): Promise<Recipe> {
    const recipe = await store.getRecipe(householdId, recipeId);
    if (!recipe) throw new RecipeInputError("Unknown recipe.");
    return recipe;
}

export async function addRecipeIngredientByBarcode(
    store: RecipesStore,
    input: {
        householdId: string;
        recipeId: string;
        barcode: string;
        amount: number;
    },
    opts: {
        lookup: (barcode: string) => Promise<FoodResult | null>;
    },
): Promise<RecipeIngredient> {
    const recipe = await requireRecipe(
        store,
        input.householdId,
        input.recipeId,
    );
    const barcode = normalizeBarcode(input.barcode);
    if (!barcode) throw new RecipeInputError("Enter a valid barcode.");
    const amount = parseAmount(input.amount);
    const food = await opts.lookup(barcode);
    if (food == null) throw new RecipeInputError("Unknown barcode.");
    const existing = await store.listIngredients(input.householdId, recipe.id);
    const identity: FoodIdentity = {
        kind: "food",
        via: "barcode",
        barcode,
        displayName: food.name,
    };
    return store.insertIngredient({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        recipeId: recipe.id,
        kind: "food",
        displayName: food.name,
        quantity: { amount, unit: "g" },
        identity,
        nutrition: nutritionFromFood(food),
        sortOrder: existing.length,
    });
}

export async function addRecipeManualIngredient(
    store: RecipesStore,
    input: {
        householdId: string;
        recipeId: string;
        name: string;
        amount: number;
    },
): Promise<RecipeIngredient> {
    const recipe = await requireRecipe(
        store,
        input.householdId,
        input.recipeId,
    );
    const name = input.name.trim();
    if (!name) throw new RecipeInputError("Enter a food name.");
    const amount = parseAmount(input.amount);
    const existing = await store.listIngredients(input.householdId, recipe.id);
    const identity: FoodIdentity = {
        kind: "food",
        via: "manual",
        householdManualId: crypto.randomUUID(),
        displayName: name,
    };
    return store.insertIngredient({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        recipeId: recipe.id,
        kind: "food",
        displayName: name,
        quantity: { amount, unit: "g" },
        identity,
        nutrition: null,
        sortOrder: existing.length,
    });
}

export async function setPersonPortion(
    store: RecipesStore,
    input: {
        householdId: string;
        recipeId: string;
        userId: string;
        portionCount: number;
    },
): Promise<RecipePortion> {
    await requireRecipe(store, input.householdId, input.recipeId);
    const portionCount = parseAmount(input.portionCount);
    return store.upsertPortion({
        recipeId: input.recipeId,
        householdId: input.householdId,
        userId: input.userId,
        portionCount,
    });
}

export async function getRecipeView(
    store: RecipesStore,
    householdId: string,
    recipeId: string,
    userId: string,
): Promise<RecipeView> {
    const recipe = await requireRecipe(store, householdId, recipeId);
    const [ingredients, portion] = await Promise.all([
        store.listIngredients(householdId, recipeId),
        store.getPortion(householdId, recipeId, userId),
    ]);
    const portionCount = portion?.portionCount ?? 1;
    return {
        ...recipe,
        portionCount,
        ingredients: ingredients.map((ingredient) => ({
            ...ingredient,
            perPortionAmount: perPortionAmount(
                ingredient.quantity.amount,
                recipe.yieldPortions,
            ),
            personAmount: amountForPortion(
                ingredient.quantity.amount,
                recipe.yieldPortions,
                portionCount,
            ),
        })),
    };
}

export async function addRecipeToGrocery(opts: {
    recipes: RecipesStore;
    grocery: GroceryListStore;
    settings: SettingsStore;
    fridgeItems: LinkedNeed[];
    householdId: string;
    recipeId: string;
    storeId: string;
    portionCounts: number[];
}): Promise<{
    added: GroceryLine[];
    skipped: RecipeGroceryRemainderLine[];
    plan: RecipeGroceryRemainderLine[];
}> {
    if (opts.portionCounts.length === 0) {
        throw new RecipeInputError("Select who this grocery run is for.");
    }
    const stores = await opts.settings.listStores(opts.householdId);
    if (!stores.some((store) => store.id === opts.storeId)) {
        throw new RecipeInputError("Unknown store.");
    }
    const recipe = await requireRecipe(
        opts.recipes,
        opts.householdId,
        opts.recipeId,
    );
    const ingredients = await opts.recipes.listIngredients(
        opts.householdId,
        opts.recipeId,
    );
    if (ingredients.length === 0) {
        throw new RecipeInputError("Add an ingredient first.");
    }
    const plan = recipeToGroceryRemainder({
        ingredients: ingredients.map((ingredient) => ({
            identity: ingredient.identity,
            displayName: ingredient.displayName,
            quantity: ingredient.quantity,
        })),
        yieldPortions: recipe.yieldPortions,
        portionCounts: opts.portionCounts,
        stock: opts.fridgeItems,
    });
    const sectionId = await resolveGrocerySectionId(
        opts.settings,
        opts.storeId,
    );
    const added: GroceryLine[] = [];
    const skipped: RecipeGroceryRemainderLine[] = [];
    for (const line of plan) {
        if (line.skipped || line.remainder == null) {
            skipped.push(line);
            continue;
        }
        const ingredient = ingredients.find(
            (row) => row.displayName === line.displayName,
        );
        const inserted = await opts.grocery.insertLine({
            id: crypto.randomUUID(),
            householdId: opts.householdId,
            storeId: opts.storeId,
            sectionId,
            kind: ingredient?.kind ?? "food",
            displayName: line.displayName,
            quantity: line.remainder,
            identity: line.identity,
            checked: false,
        });
        added.push(inserted);
    }
    return { added, skipped, plan };
}

export function recipeDislikeNote(
    ingredientNames: string[],
    dislikes: { displayName: string }[],
    personName: string,
): string | null {
    const hits = dislikes.filter((row) => {
        const needle = row.displayName.toLowerCase();
        return ingredientNames.some((name) =>
            name.toLowerCase().includes(needle),
        );
    });
    if (hits.length === 0) return null;
    return `${personName} dislikes ${hits.map((row) => row.displayName).join(", ")}.`;
}

export function recipeFromRow(row: {
    id: unknown;
    household_id: unknown;
    creator_id: unknown;
    name: unknown;
    yield_portions: unknown;
}): Recipe {
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        creatorId: String(row.creator_id),
        name: String(row.name),
        yieldPortions: Number(row.yield_portions),
    };
}

export function recipeToRow(row: Recipe) {
    return {
        id: row.id,
        household_id: row.householdId,
        creator_id: row.creatorId,
        name: row.name,
        yield_portions: row.yieldPortions,
    };
}

export function recipeIngredientFromRow(row: {
    id: unknown;
    household_id: unknown;
    recipe_id: unknown;
    kind: unknown;
    display_name: unknown;
    amount: unknown;
    unit: unknown;
    identity: unknown;
    nutrition: unknown;
    sort_order: unknown;
}): RecipeIngredient {
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        recipeId: String(row.recipe_id),
        kind: "food",
        displayName: String(row.display_name),
        quantity: {
            amount: Number(row.amount),
            unit: String(row.unit),
        },
        identity: row.identity as FoodIdentity | SupplyIdentity,
        nutrition: (row.nutrition as IngredientNutrition | null) ?? null,
        sortOrder: Number(row.sort_order) || 0,
    };
}

export function recipeIngredientToRow(row: RecipeIngredient) {
    return {
        id: row.id,
        household_id: row.householdId,
        recipe_id: row.recipeId,
        kind: row.kind,
        display_name: row.displayName,
        amount: row.quantity.amount,
        unit: row.quantity.unit,
        identity: row.identity,
        nutrition: row.nutrition,
        sort_order: row.sortOrder,
    };
}

export function recipePortionFromRow(row: {
    recipe_id: unknown;
    household_id: unknown;
    user_id: unknown;
    portion_count: unknown;
}): RecipePortion {
    return {
        recipeId: String(row.recipe_id),
        householdId: String(row.household_id),
        userId: String(row.user_id),
        portionCount: Number(row.portion_count),
    };
}

export function recipePortionToRow(row: RecipePortion) {
    return {
        recipe_id: row.recipeId,
        household_id: row.householdId,
        user_id: row.userId,
        portion_count: row.portionCount,
    };
}

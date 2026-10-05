import {
    identityKey,
    type FoodIdentity,
    type SupplyIdentity,
} from "./food-identity.js";
import {
    convertQuantity,
    isQuantityUnit,
    type Quantity,
    type QuantityUnit,
} from "./quantity.js";

export type LinkedQuantity = { amount: number; unit: string };

export type LinkedNeed = {
    identity: FoodIdentity | SupplyIdentity;
    quantity: LinkedQuantity;
};

export type AlreadyHaveTag =
    | { cover: "full" }
    | { cover: "partial"; have: LinkedQuantity; need: LinkedQuantity };

function roundAmount(amount: number): number {
    return Math.round(amount * 10) / 10;
}

function convertToUnit(q: LinkedQuantity, to: string): number | null {
    if (q.unit === to) return q.amount;
    if (!isQuantityUnit(q.unit) || !isQuantityUnit(to)) return null;
    try {
        return convertQuantity(
            { amount: q.amount, unit: q.unit } as Quantity,
            to as QuantityUnit,
        ).amount;
    } catch {
        return null;
    }
}

export function alreadyHaveTag(
    need: LinkedNeed,
    stock: LinkedNeed[],
): AlreadyHaveTag | null {
    const key = identityKey(need.identity);
    const matches = stock.filter((row) => identityKey(row.identity) === key);
    if (matches.length === 0) return null;
    const targetUnit = need.quantity.unit;
    let have = 0;
    let converted = 0;
    for (const row of matches) {
        const amount = convertToUnit(row.quantity, targetUnit);
        if (amount == null) continue;
        have += amount;
        converted += 1;
    }
    if (converted === 0) return null;
    have = roundAmount(have);
    const wanted = roundAmount(need.quantity.amount);
    if (have >= wanted) return { cover: "full" };
    if (have <= 0) return null;
    return {
        cover: "partial",
        have: { amount: have, unit: targetUnit },
        need: { amount: roundAmount(wanted - have), unit: targetUnit },
    };
}

export type RecipeGroceryIngredient = {
    identity: FoodIdentity | SupplyIdentity;
    displayName: string;
    quantity: LinkedQuantity;
};

export type RecipeGroceryRemainderLine = {
    identity: FoodIdentity | SupplyIdentity;
    displayName: string;
    need: LinkedQuantity;
    remainder: LinkedQuantity | null;
    skipped: boolean;
    tag: AlreadyHaveTag | null;
};

export function recipeToGroceryRemainder(input: {
    ingredients: RecipeGroceryIngredient[];
    yieldPortions: number;
    portionCounts: number[];
    stock: LinkedNeed[];
}): RecipeGroceryRemainderLine[] {
    const portionSum = input.portionCounts.reduce((sum, n) => sum + n, 0);
    const scale = portionSum / input.yieldPortions;
    return input.ingredients.map((ingredient) => {
        const need: LinkedQuantity = {
            amount: roundAmount(ingredient.quantity.amount * scale),
            unit: ingredient.quantity.unit,
        };
        const tag = alreadyHaveTag(
            { identity: ingredient.identity, quantity: need },
            input.stock,
        );
        if (need.amount <= 0 || tag?.cover === "full") {
            return {
                identity: ingredient.identity,
                displayName: ingredient.displayName,
                need,
                remainder: null,
                skipped: true,
                tag,
            };
        }
        if (tag?.cover === "partial") {
            return {
                identity: ingredient.identity,
                displayName: ingredient.displayName,
                need,
                remainder: tag.need,
                skipped: false,
                tag,
            };
        }
        return {
            identity: ingredient.identity,
            displayName: ingredient.displayName,
            need,
            remainder: need,
            skipped: false,
            tag: null,
        };
    });
}

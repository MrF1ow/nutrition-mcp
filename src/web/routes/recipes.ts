import { Hono } from "hono";
import {
    renderRecipeDetailRoute,
    renderRecipesListPage,
} from "../dashboard.js";
import { formAmount, formText } from "../form.js";
import { requireMember, requireSiteUser, siteMember } from "../middleware.js";
import { fridgeBarcodeLookup } from "./fridge.js";
import { listFridge } from "../../domain/fridge.js";
import {
    addRecipeIngredientByBarcode,
    addRecipeIngredientById,
    addRecipeManualIngredient,
    addRecipeToGrocery,
    createRecipe,
    deleteRecipe,
    RecipeForbiddenError,
    RecipeInputError,
    removeRecipeIngredient,
    reorderRecipeIngredients,
    setPersonPortion,
    updateRecipe,
    updateRecipeIngredient,
} from "../../domain/recipes.js";
import { listHouseholdMembers } from "../../db/household.js";
import { liveFridgeStore } from "../../db/fridge.js";
import { liveFoodsStore } from "../../db/foods.js";
import { liveGroceryStore } from "../../db/grocery.js";
import { liveRecipesStore } from "../../db/recipes.js";
import { liveSettingsStore } from "../../db/settings.js";
import { foodsByIds } from "../../domain/foods.js";

export const recipesRoutes = new Hono();

function formMemberIds(
    body: Record<string, string | File | (string | File)[]>,
): string[] {
    const raw = body.member_ids;
    if (Array.isArray(raw)) {
        return raw.filter(
            (value): value is string => typeof value === "string",
        );
    }
    if (typeof raw === "string" && raw) return [raw];
    return [];
}

async function recipeFormError(
    userId: string,
    recipeId: string | null,
    err: unknown,
    member?: string,
) {
    const message =
        err instanceof RecipeForbiddenError || err instanceof RecipeInputError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update the recipe.";
    if (recipeId) {
        const page = await renderRecipeDetailRoute(userId, recipeId, {
            member,
            error: message,
        });
        const status =
            err instanceof RecipeForbiddenError ? 403 : (400 as const);
        return { html: page.html, status: status as 400 | 403 };
    }
    const page = await renderRecipesListPage(userId, message);
    return { html: page.html, status: 400 as const };
}

recipesRoutes.get("/recipes", requireSiteUser, async (c) => {
    const page = await renderRecipesListPage(c.get("userId"), undefined, {
        tag: c.req.query("tag") ?? "",
        canMakeNow: c.req.query("can_make_now") === "1",
        safeFor: c.req.query("safe_for") ?? "",
    });
    return c.html(page.html, page.status);
});

recipesRoutes.post("/recipes", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const body = await c.req.parseBody();
    try {
        const recipe = await createRecipe(liveRecipesStore(), {
            householdId: member.householdId,
            creatorId: userId,
            name: formText(body, "name"),
            yieldPortions: formAmount(body, "yield_portions"),
        });
        return c.redirect(`/recipes/${recipe.id}`);
    } catch (err) {
        const page = await recipeFormError(userId, null, err);
        return c.html(page.html, page.status);
    }
});

recipesRoutes.get("/recipes/:id", requireSiteUser, async (c) => {
    const page = await renderRecipeDetailRoute(
        c.get("userId"),
        c.req.param("id"),
        {
            member: c.req.query("member"),
        },
    );
    return c.html(page.html, page.status);
});

recipesRoutes.post("/recipes/:id", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const recipeId = c.req.param("id");
    const body = await c.req.parseBody();
    try {
        const prepRaw = formText(body, "prep_minutes").trim();
        const cookRaw = formText(body, "cook_minutes").trim();
        await updateRecipe(liveRecipesStore(), member.householdId, recipeId, {
            name: formText(body, "name"),
            yieldPortions: formAmount(body, "yield_portions"),
            instructions: formText(body, "instructions"),
            sourceUrl: formText(body, "source_url"),
            tags: formText(body, "tags").split(","),
            notes: formText(body, "notes"),
            prepMinutes: prepRaw === "" ? null : Number(prepRaw),
            cookMinutes: cookRaw === "" ? null : Number(cookRaw),
        });
    } catch (err) {
        const page = await recipeFormError(userId, recipeId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect(`/recipes/${recipeId}`);
});

recipesRoutes.post(
    "/recipes/:id/ingredients/:ingredientId/delete",
    requireMember,
    async (c) => {
        const userId = c.get("userId");
        const member = siteMember(c);
        const recipeId = c.req.param("id");
        try {
            await removeRecipeIngredient(
                liveRecipesStore(),
                member.householdId,
                recipeId,
                c.req.param("ingredientId"),
            );
        } catch (err) {
            const page = await recipeFormError(userId, recipeId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect(`/recipes/${recipeId}`);
    },
);

recipesRoutes.post(
    "/recipes/:id/ingredients/:ingredientId/move",
    requireMember,
    async (c) => {
        const userId = c.get("userId");
        const member = siteMember(c);
        const recipeId = c.req.param("id");
        const ingredientId = c.req.param("ingredientId");
        const body = await c.req.parseBody();
        try {
            const store = liveRecipesStore();
            const ingredients = await store.listIngredients(
                member.householdId,
                recipeId,
            );
            const index = ingredients.findIndex(
                (row) => row.id === ingredientId,
            );
            if (index < 0) throw new RecipeInputError("Unknown ingredient.");
            const direction = formText(body, "direction");
            const swapWith = direction === "up" ? index - 1 : index + 1;
            if (swapWith < 0 || swapWith >= ingredients.length) {
                return c.redirect(`/recipes/${recipeId}`);
            }
            const ids = ingredients.map((row) => row.id);
            const tmp = ids[index]!;
            ids[index] = ids[swapWith]!;
            ids[swapWith] = tmp;
            await reorderRecipeIngredients(
                store,
                member.householdId,
                recipeId,
                ids,
            );
        } catch (err) {
            const page = await recipeFormError(userId, recipeId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect(`/recipes/${recipeId}`);
    },
);

recipesRoutes.post(
    "/recipes/:id/ingredients/:ingredientId",
    requireMember,
    async (c) => {
        const userId = c.get("userId");
        const member = siteMember(c);
        const recipeId = c.req.param("id");
        const body = await c.req.parseBody();
        try {
            await updateRecipeIngredient(
                liveRecipesStore(),
                member.householdId,
                recipeId,
                c.req.param("ingredientId"),
                {
                    amount: formAmount(body, "amount"),
                    note: formText(body, "note"),
                },
            );
        } catch (err) {
            const page = await recipeFormError(userId, recipeId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect(`/recipes/${recipeId}`);
    },
);

recipesRoutes.post("/recipes/:id/delete", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const recipeId = c.req.param("id");
    try {
        await deleteRecipe(liveRecipesStore(), member.householdId, recipeId, {
            userId,
            isOwner: member.role === "owner",
        });
    } catch (err) {
        const page = await recipeFormError(userId, recipeId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/recipes");
});

recipesRoutes.post("/recipes/:id/ingredients", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const recipeId = c.req.param("id");
    const body = await c.req.parseBody();
    const amount = formAmount(body, "qty_amount");
    try {
        if (formText(body, "food_id")) {
            await addRecipeIngredientById(
                liveRecipesStore(),
                liveFoodsStore(),
                {
                    householdId: member.householdId,
                    recipeId,
                    foodId: formText(body, "food_id"),
                    amount,
                    unit: formText(body, "qty_unit"),
                },
            );
        } else if (formText(body, "barcode")) {
            await addRecipeIngredientByBarcode(
                liveRecipesStore(),
                liveFoodsStore(),
                {
                    householdId: member.householdId,
                    recipeId,
                    barcode: formText(body, "barcode"),
                    amount,
                    unit: formText(body, "qty_unit"),
                },
                { lookup: fridgeBarcodeLookup },
            );
        } else {
            await addRecipeManualIngredient(
                liveRecipesStore(),
                liveFoodsStore(),
                {
                    householdId: member.householdId,
                    recipeId,
                    name: formText(body, "food_name"),
                    amount,
                    unit: formText(body, "qty_unit"),
                },
            );
        }
    } catch (err) {
        const page = await recipeFormError(userId, recipeId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect(`/recipes/${recipeId}`);
});

recipesRoutes.post("/recipes/:id/portions", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const recipeId = c.req.param("id");
    const body = await c.req.parseBody();
    try {
        await setPersonPortion(liveRecipesStore(), {
            householdId: member.householdId,
            recipeId,
            userId,
            portionCount: formAmount(body, "portion_count"),
        });
    } catch (err) {
        const page = await recipeFormError(userId, recipeId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect(`/recipes/${recipeId}`);
});

recipesRoutes.post("/recipes/:id/add-to-grocery", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const recipeId = c.req.param("id");
    const body = await c.req.parseBody({ all: true });
    const selected = formMemberIds(body);
    const storeId = formText(body as Record<string, string | File>, "store_id");
    try {
        const householdMembers = await listHouseholdMembers(member.householdId);
        const allowed = new Set(householdMembers.map((row) => row.userId));
        const memberIds = selected.filter((id) => allowed.has(id));
        if (memberIds.length === 0) {
            throw new RecipeInputError("Select who this grocery run is for.");
        }
        const recipes = liveRecipesStore();
        const portionCounts = await Promise.all(
            memberIds.map(async (id) => {
                const portion = await recipes.getPortion(
                    member.householdId,
                    recipeId,
                    id,
                );
                return portion?.portionCount ?? 1;
            }),
        );
        const fridge = await listFridge(liveFridgeStore(), member.householdId);
        const foods = await foodsByIds(liveFoodsStore(), member.householdId, [
            ...(
                await recipes.listIngredients(member.householdId, recipeId)
            ).map((row) => row.foodId),
            ...fridge.items.map((item) => item.foodId),
        ]);
        await addRecipeToGrocery({
            recipes,
            grocery: liveGroceryStore(),
            settings: liveSettingsStore(),
            fridgeItems: fridge.items.map((item) => ({
                identity: item.identity,
                quantity: item.quantity,
                foodId: item.foodId,
            })),
            householdId: member.householdId,
            recipeId,
            storeId,
            portionCounts,
            foodsById: foods,
        });
    } catch (err) {
        const page = await recipeFormError(userId, recipeId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/grocery");
});

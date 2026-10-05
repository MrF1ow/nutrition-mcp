import { Hono } from "hono";
import {
    renderRecipeDetailRoute,
    renderRecipesListPage,
} from "../dashboard.js";
import { formAmount, formText } from "../form.js";
import { requireMember, requireSiteUser, siteMember } from "../middleware.js";
import { fridgeBarcodeLookup } from "./fridge.js";
import { listFridge } from "../../fridge.js";
import {
    addRecipeIngredientByBarcode,
    addRecipeManualIngredient,
    addRecipeToGrocery,
    createRecipe,
    deleteRecipe,
    RecipeForbiddenError,
    RecipeInputError,
    setPersonPortion,
} from "../../recipes.js";
import {
    listHouseholdMembers,
    liveFridgeStore,
    liveGroceryStore,
    liveRecipesStore,
    liveSettingsStore,
} from "../../supabase.js";

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
    const page = await renderRecipesListPage(c.get("userId"));
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
        if (formText(body, "barcode")) {
            await addRecipeIngredientByBarcode(
                liveRecipesStore(),
                {
                    householdId: member.householdId,
                    recipeId,
                    barcode: formText(body, "barcode"),
                    amount,
                },
                { lookup: fridgeBarcodeLookup },
            );
        } else {
            await addRecipeManualIngredient(liveRecipesStore(), {
                householdId: member.householdId,
                recipeId,
                name: formText(body, "food_name"),
                amount,
            });
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
        await addRecipeToGrocery({
            recipes,
            grocery: liveGroceryStore(),
            settings: liveSettingsStore(),
            fridgeItems: fridge.items.map((item) => ({
                identity: item.identity,
                quantity: item.quantity,
            })),
            householdId: member.householdId,
            recipeId,
            storeId,
            portionCounts,
        });
    } catch (err) {
        const page = await recipeFormError(userId, recipeId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/grocery");
});

import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
    liveFridgeStore,
    liveGroceryStore,
    liveRecipesStore,
    liveSettingsStore,
} from "../../supabase.js";
import { withAnalytics } from "../../analytics.js";
import { lookupBarcode } from "../../foods.js";
import { listFridge } from "../../fridge.js";
import {
    addRecipeIngredientByBarcode,
    addRecipeManualIngredient,
    addRecipeToGrocery,
    createRecipe,
    deleteRecipe,
    getRecipeView,
    listRecipes,
    setPersonPortion,
} from "../../recipes.js";
import { QUANTITY_ITEM } from "../shared.js";
import type { ToolContext } from "../shared.js";

export function registerRecipesTools(server: McpServer, ctx: ToolContext) {
    const {
        callerHouseholdId,
        requireHouseholdMemberId,
        callerActor,
        analytics,
    } = ctx;
    server.registerTool(
        "list_recipes",
        {
            title: "List Recipes",
            description: "List household recipes.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            outputSchema: z.object({
                recipes: z.array(
                    z.object({
                        id: z.string(),
                        name: z.string(),
                        yield_portions: z.number(),
                        creator_id: z.string(),
                    }),
                ),
            }),
        },
        async () =>
            withAnalytics(
                "list_recipes",
                async () => {
                    const householdId = await callerHouseholdId();
                    const recipes = await listRecipes(
                        liveRecipesStore(),
                        householdId,
                    );
                    const payload = {
                        recipes: recipes.map((recipe) => ({
                            id: recipe.id,
                            name: recipe.name,
                            yield_portions: recipe.yieldPortions,
                            creator_id: recipe.creatorId,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.recipes.length === 0
                                        ? "No recipes."
                                        : payload.recipes
                                              .map(
                                                  (recipe) =>
                                                      `${recipe.name} yield ${recipe.yield_portions} ${recipe.id}`,
                                              )
                                              .join("\n"),
                            },
                        ],
                        structuredContent: payload,
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "get_recipe",
        {
            title: "Get Recipe",
            description:
                "Get a recipe as viewed by a household member, including per-portion and per-person amounts.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                id: z.string(),
                member_id: z.string().optional(),
            }),
            outputSchema: z.object({
                id: z.string(),
                name: z.string(),
                yield_portions: z.number(),
                portion_count: z.number(),
                ingredients: z.array(
                    z.object({
                        display_name: z.string(),
                        amount: z.number(),
                        unit: z.string(),
                        per_portion_amount: z.number(),
                        person_amount: z.number(),
                    }),
                ),
            }),
        },
        async (args) =>
            withAnalytics(
                "get_recipe",
                async () => {
                    const actor = await callerActor();
                    const memberId = args.member_id
                        ? await requireHouseholdMemberId(args.member_id)
                        : actor.userId;
                    const view = await getRecipeView(
                        liveRecipesStore(),
                        actor.householdId,
                        args.id,
                        memberId,
                    );
                    const payload = {
                        id: view.id,
                        name: view.name,
                        yield_portions: view.yieldPortions,
                        portion_count: view.portionCount,
                        ingredients: view.ingredients.map((ingredient) => ({
                            display_name: ingredient.displayName,
                            amount: ingredient.quantity.amount,
                            unit: ingredient.quantity.unit,
                            per_portion_amount: ingredient.perPortionAmount,
                            person_amount: ingredient.personAmount,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text: `${view.name} yield ${view.yieldPortions}, portion ${view.portionCount}\n${payload.ingredients
                                    .map(
                                        (ingredient) =>
                                            `${ingredient.display_name} ${ingredient.person_amount} ${ingredient.unit}`,
                                    )
                                    .join("\n")}`,
                            },
                        ],
                        structuredContent: payload,
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "create_recipe",
        {
            title: "Create Recipe",
            description:
                "Create a household recipe with a cook yield. The caller is the creator.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                name: z.string().min(1),
                yield_portions: z.coerce.number(),
            }),
            outputSchema: z.object({
                id: z.string(),
                name: z.string(),
                yield_portions: z.number(),
            }),
        },
        async (args) =>
            withAnalytics(
                "create_recipe",
                async () => {
                    const actor = await callerActor();
                    const recipe = await createRecipe(liveRecipesStore(), {
                        householdId: actor.householdId,
                        creatorId: actor.userId,
                        name: args.name,
                        yieldPortions: args.yield_portions,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Created ${recipe.name} yield ${recipe.yieldPortions} ${recipe.id}`,
                            },
                        ],
                        structuredContent: {
                            id: recipe.id,
                            name: recipe.name,
                            yield_portions: recipe.yieldPortions,
                        },
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "add_recipe_ingredient",
        {
            title: "Add Recipe Ingredient",
            description:
                "Add a food ingredient to a recipe. Pass a barcode or a manual name. Amounts are grams.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                recipe_id: z.string(),
                amount: z.coerce.number(),
                name: z.string().optional(),
                barcode: z.string().optional(),
            }),
        },
        async (args) =>
            withAnalytics(
                "add_recipe_ingredient",
                async () => {
                    const householdId = await callerHouseholdId();
                    const store = liveRecipesStore();
                    const ingredient = args.barcode
                        ? await addRecipeIngredientByBarcode(
                              store,
                              {
                                  householdId,
                                  recipeId: args.recipe_id,
                                  barcode: args.barcode,
                                  amount: args.amount,
                              },
                              { lookup: lookupBarcode },
                          )
                        : await addRecipeManualIngredient(store, {
                              householdId,
                              recipeId: args.recipe_id,
                              name: args.name ?? "",
                              amount: args.amount,
                          });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Added ${ingredient.displayName} ${ingredient.quantity.amount} ${ingredient.quantity.unit}`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "set_recipe_portion",
        {
            title: "Set Recipe Portion",
            description:
                "Set how many portions a household member eats of a recipe.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                recipe_id: z.string(),
                member_id: z.string(),
                portion_count: z.coerce.number(),
            }),
        },
        async (args) =>
            withAnalytics(
                "set_recipe_portion",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const portion = await setPersonPortion(liveRecipesStore(), {
                        householdId,
                        recipeId: args.recipe_id,
                        userId: args.member_id,
                        portionCount: args.portion_count,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Set portion ${portion.portionCount} for ${args.member_id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "delete_recipe",
        {
            title: "Delete Recipe",
            description:
                "Delete a recipe. Only the creator or the household owner may delete.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                id: z.string(),
            }),
        },
        async (args) =>
            withAnalytics(
                "delete_recipe",
                async () => {
                    const actor = await callerActor();
                    const deleted = await deleteRecipe(
                        liveRecipesStore(),
                        actor.householdId,
                        args.id,
                        { userId: actor.userId, isOwner: actor.isOwner },
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: deleted
                                    ? `Deleted recipe ${args.id}.`
                                    : `No recipe found with id ${args.id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "add_recipe_to_grocery",
        {
            title: "Add Recipe to Grocery",
            description:
                "Add a recipe's remainder to a grocery store after summing the selected members' portions and netting fridge stock. Returns the per-ingredient remainder.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                recipe_id: z.string(),
                store_id: z.string(),
                member_ids: z.array(z.string()).min(1),
            }),
            outputSchema: z.object({
                remainder: z.array(
                    z.object({
                        display_name: z.string(),
                        skipped: z.boolean(),
                        need: QUANTITY_ITEM,
                        remainder: QUANTITY_ITEM.nullable(),
                    }),
                ),
            }),
        },
        async (args) =>
            withAnalytics(
                "add_recipe_to_grocery",
                async () => {
                    const householdId = await callerHouseholdId();
                    for (const memberId of args.member_ids) {
                        await requireHouseholdMemberId(memberId);
                    }
                    const recipes = liveRecipesStore();
                    const portionCounts: number[] = [];
                    for (const memberId of args.member_ids) {
                        const view = await getRecipeView(
                            recipes,
                            householdId,
                            args.recipe_id,
                            memberId,
                        );
                        portionCounts.push(view.portionCount);
                    }
                    const fridge = await listFridge(
                        liveFridgeStore(),
                        householdId,
                    );
                    const result = await addRecipeToGrocery({
                        recipes,
                        grocery: liveGroceryStore(),
                        settings: liveSettingsStore(),
                        fridgeItems: fridge.items.map((item) => ({
                            identity: item.identity,
                            quantity: item.quantity,
                        })),
                        householdId,
                        recipeId: args.recipe_id,
                        storeId: args.store_id,
                        portionCounts,
                    });
                    const remainder = result.plan.map((line) => ({
                        display_name: line.displayName,
                        skipped: line.skipped,
                        need: line.need,
                        remainder: line.remainder,
                    }));
                    return {
                        content: [
                            {
                                type: "text",
                                text: remainder
                                    .map((line) =>
                                        line.skipped || line.remainder == null
                                            ? `${line.display_name} skipped`
                                            : `${line.display_name} remainder ${line.remainder.amount} ${line.remainder.unit}`,
                                    )
                                    .join("\n"),
                            },
                        ],
                        structuredContent: { remainder },
                    };
                },
                analytics,
            ),
    );
}

import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
    withAnalytics,
    categorizeError,
} from "../../analytics.js";
import {
    normalizeBarcode,
    lookupBarcode,
    formatFoodResult,
} from "../../foods.js";
import {
    searchFoodsByName,
} from "../../food-search.js";
import {
    householdFoodNames,
} from "../shared.js";
import type { ToolContext } from "../shared.js";

export function registerLookupBarcodeTool(
    server: McpServer,
    ctx: ToolContext,
) {
    const {
        alcohol,
        personSchema,
        actorUserId,
        analytics,
    } = ctx;
    server.registerTool(
        "lookup_barcode",
        {
            title: "Look Up Barcode",
            description:
                "Look up a packaged product's label nutrition by barcode via Open Food Facts. The figures come from the product's own label as transcribed by the Open Food Facts community, so they beat estimating — but they are not verified by this server and can be wrong, stale, or missing entirely. Pass the barcode digits (EAN/UPC, 8–14 digits). The user can type them, or you can read them from a photo of the package — transcribe the human-readable digits printed beneath the barcode. Returns the product name, serving, and macros, which you can then pass to log_meal scaled to the amount eaten. When Open Food Facts has computed them, it also returns the Nutri-Score (A–E, a nutritional-quality grade) and NOVA group (1–4, how processed the product is) — pass these along if the user is asking about the product's quality, not just its macros; they're omitted, not \"n/a\", when OFF hasn't computed one for that product. If no product is found, fall back to web search or estimation. Two gaps to close yourself before logging: a fiber or sugar figure shown as n/a is missing data rather than a zero, so estimate it and pass it anyway; and Open Food Facts carries no caffeine at all, so for a coffee, tea, cola, energy drink or other caffeinated product get caffeine_mg from the label or a web search.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true,
            },
            inputSchema: personSchema({
                barcode: z
                    .string()
                    .describe(
                        "Product barcode digits (EAN-8/13, UPC-A/E, or GTIN-14). Spaces and separators are ignored.",
                    ),
            }),
        },
        async ({ barcode, user_id }) => {
            // lookupBarcode's own failures (OFF down, timeout, bad config) are
            // caught below and turned into a normal (non-isError) content
            // response so the model can fall back to estimating — but that
            // means withAnalytics never sees a thrown error. Without this flag
            // an OFF outage silently records as `success: true`, which is how
            // it stayed invisible to tool_analytics entirely.
            // Safe only because withAnalytics awaits the handler to
            // completion before reading this via `outcome` below — it is not
            // read concurrently with the handler running.
            let offFailure: string | null = null;
            return withAnalytics(
                "lookup_barcode",
                async () => {
                    const userId = await actorUserId(user_id);
                    const normalized = normalizeBarcode(barcode);
                    if (!normalized) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `"${barcode}" is not a valid barcode (expected 8–14 digits). Double-check the number, or estimate the macros from the product description instead.`,
                                },
                            ],
                        };
                    }

                    let food;
                    try {
                        food = await lookupBarcode(normalized);
                    } catch (err) {
                        const msg =
                            err instanceof Error ? err.message : String(err);
                        // Route through the same categorizeError used for
                        // thrown errors elsewhere, so a config problem
                        // ("OFF_USER_AGENT is not configured") or an OFF rate
                        // limit lands in service_misconfigured/rate_limited
                        // instead of a generic bucket local to this tool.
                        const category = categorizeError(err);
                        offFailure =
                            category === "unknown"
                                ? "external_api_error"
                                : category;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Couldn't reach Open Food Facts right now (${msg}). Estimate the macros from the product description or ask the user, then log the meal.`,
                                },
                            ],
                        };
                    }

                    if (!food) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `No product found in Open Food Facts for barcode ${normalized}. Ask the user what the product is, or estimate the macros, then log the meal.`,
                                },
                            ],
                        };
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: formatFoodResult(food, alcohol),
                            },
                        ],
                    };
                },
                analytics,
                { barcode },
                {
                    outcome: () =>
                        offFailure
                            ? { success: false, errorCategory: offFailure }
                            : { success: true },
                },
            );
        },
    );

}

export function registerSearchFoodTool(
    server: McpServer,
    ctx: ToolContext,
) {
    const {
        alcohol,
        callerHouseholdId,
        analytics,
    } = ctx;
    server.registerTool(
        "search_food",
        {
            title: "Search Food",
            description:
                "Search packaged foods by name via Open Food Facts and the local food cache. Household fridge and recipe names rank above generic hits. Do not use this to search logged meals — that is search_meals.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true,
            },
            inputSchema: z.object({
                query: z.string().min(1),
            }),
            outputSchema: z.object({
                foods: z.array(
                    z.object({
                        name: z.string(),
                        brand: z.string().nullable(),
                        source: z.string(),
                        barcode: z.string(),
                        calories: z.number().nullable(),
                        protein_g: z.number().nullable(),
                        carbs_g: z.number().nullable(),
                        fat_g: z.number().nullable(),
                        fiber_g: z.number().nullable(),
                        sugar_g: z.number().nullable(),
                        serving: z.string().nullable(),
                    }),
                ),
            }),
        },
        async (args) =>
            withAnalytics(
                "search_food",
                async () => {
                    const householdId = await callerHouseholdId();
                    const names = await householdFoodNames(householdId);
                    const foods = await searchFoodsByName(args.query, names);
                    const payload = {
                        foods: foods.map((food) => ({
                            name: food.name,
                            brand: food.brand,
                            source: food.source,
                            barcode: food.barcode,
                            calories: food.calories,
                            protein_g: food.protein_g,
                            carbs_g: food.carbs_g,
                            fat_g: food.fat_g,
                            fiber_g: food.fiber_g,
                            sugar_g: food.sugar_g,
                            serving: food.serving,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    foods.length === 0
                                        ? `No foods found for "${args.query}".`
                                        : foods
                                              .map((food) =>
                                                  formatFoodResult(
                                                      food,
                                                      alcohol,
                                                  ),
                                              )
                                              .join("\n\n"),
                            },
                        ],
                        structuredContent: payload,
                    };
                },
                analytics,
            ),
    );
}

export function registerFoodTools(
    server: McpServer,
    ctx: ToolContext,
) {
    registerLookupBarcodeTool(server, ctx);
    registerSearchFoodTool(server, ctx);
}

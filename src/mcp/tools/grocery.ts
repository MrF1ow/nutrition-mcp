import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
    liveFridgeStore,
    liveGroceryStore,
    liveSettingsStore,
} from "../../supabase.js";
import {
    withAnalytics,
} from "../../analytics.js";
import {
    lookupBarcode,
} from "../../foods.js";
import {
    alreadyHaveTag,
} from "../../linking.js";
import {
    listFridge,
} from "../../fridge.js";
import {
    addGroceryFoodByBarcode,
    addGroceryManualFood,
    addGrocerySupply,
    checkGroceryLine,
    clearCheckedLines,
    listGrocery,
} from "../../grocery.js";
import {
    groceryLineExtras,
} from "../shared.js";
import type { ToolContext } from "../shared.js";

export function registerGroceryTools(
    server: McpServer,
    ctx: ToolContext,
) {
    const {
        callerHouseholdId,
        analytics,
    } = ctx;
    server.registerTool(
        "list_grocery_lines",
        {
            title: "List Grocery Lines",
            description:
                "List grocery lines grouped by store and section, with already-have against the fridge.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            outputSchema: z.object({
                lines: z.array(
                    z.object({
                        id: z.string(),
                        store_id: z.string(),
                        section_id: z.string(),
                        display_name: z.string(),
                        amount: z.number(),
                        unit: z.string(),
                        checked: z.boolean(),
                        already_have: z.string().nullable(),
                    }),
                ),
            }),
        },
        async () =>
            withAnalytics(
                "list_grocery_lines",
                async () => {
                    const householdId = await callerHouseholdId();
                    const snapshot = await listGrocery(
                        liveGroceryStore(),
                        liveSettingsStore(),
                        householdId,
                    );
                    const fridge = await listFridge(
                        liveFridgeStore(),
                        householdId,
                    );
                    const stock = fridge.items.map((item) => ({
                        identity: item.identity,
                        quantity: item.quantity,
                    }));
                    const payload = {
                        lines: snapshot.lines.map((line) => {
                            const tag = alreadyHaveTag(
                                {
                                    identity: line.identity,
                                    quantity: line.quantity,
                                },
                                stock,
                            );
                            return {
                                id: line.id,
                                store_id: line.storeId,
                                section_id: line.sectionId,
                                display_name: line.displayName,
                                amount: line.quantity.amount,
                                unit: line.quantity.unit,
                                checked: line.checked,
                                already_have:
                                    tag == null
                                        ? null
                                        : tag.cover === "full"
                                          ? "already have"
                                          : `already have: have ${tag.have.amount} ${tag.have.unit}, need ${tag.need.amount} ${tag.need.unit}`,
                            };
                        }),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.lines.length === 0
                                        ? "Grocery list is empty."
                                        : payload.lines
                                              .map((line) => {
                                                  const tag = line.already_have
                                                      ? ` [${line.already_have}]`
                                                      : "";
                                                  return `${line.display_name} ${line.amount} ${line.unit}${tag}`;
                                              })
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
        "add_grocery_line",
        {
            title: "Add Grocery Line",
            description:
                "Add a food or supply line to a grocery store. Reports already-have when fridge stock matches, and allergen warnings for household members.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                store_id: z.string(),
                kind: z.enum(["food", "supply"]),
                amount: z.coerce.number(),
                name: z.string().optional(),
                barcode: z.string().optional(),
                unit: z.string().optional(),
                section_id: z.string().optional(),
            }),
            outputSchema: z.object({
                id: z.string(),
                display_name: z.string(),
                already_have: z.string().nullable(),
                warning: z.string().nullable(),
            }),
        },
        async (args) =>
            withAnalytics(
                "add_grocery_line",
                async () => {
                    const householdId = await callerHouseholdId();
                    const grocery = liveGroceryStore();
                    const settings = liveSettingsStore();
                    const line =
                        args.kind === "supply"
                            ? await addGrocerySupply(grocery, settings, {
                                  householdId,
                                  storeId: args.store_id,
                                  sectionId: args.section_id,
                                  name: args.name ?? "",
                                  amount: args.amount,
                                  unit: args.unit ?? "",
                              })
                            : args.barcode
                              ? await addGroceryFoodByBarcode(
                                    grocery,
                                    settings,
                                    {
                                        householdId,
                                        storeId: args.store_id,
                                        sectionId: args.section_id,
                                        barcode: args.barcode,
                                        amount: args.amount,
                                    },
                                    { lookup: lookupBarcode },
                                )
                              : await addGroceryManualFood(grocery, settings, {
                                    householdId,
                                    storeId: args.store_id,
                                    sectionId: args.section_id,
                                    name: args.name ?? "",
                                    amount: args.amount,
                                });
                    const extras = await groceryLineExtras(householdId, line);
                    const bits = [
                        `Added ${line.displayName} ${line.quantity.amount} ${line.quantity.unit}`,
                    ];
                    if (extras.alreadyHave) bits.push(extras.alreadyHave);
                    if (extras.warning) bits.push(extras.warning);
                    return {
                        content: [{ type: "text", text: bits.join(". ") }],
                        structuredContent: {
                            id: line.id,
                            display_name: line.displayName,
                            already_have: extras.alreadyHave,
                            warning: extras.warning,
                        },
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "check_grocery_line",
        {
            title: "Check Grocery Line",
            description:
                "Mark a grocery line checked or unchecked. Checking does not add the item to the fridge.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                id: z.string(),
                checked: z.boolean().optional(),
            }),
        },
        async (args) =>
            withAnalytics(
                "check_grocery_line",
                async () => {
                    const householdId = await callerHouseholdId();
                    const line = await checkGroceryLine(
                        liveGroceryStore(),
                        householdId,
                        args.id,
                        args.checked ?? true,
                    );
                    if (!line) {
                        throw new Error(
                            `No grocery line found with id ${args.id}.`,
                        );
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: line.checked
                                    ? `Checked ${line.displayName}. Fridge unchanged.`
                                    : `Unchecked ${line.displayName}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "delete_grocery_line",
        {
            title: "Delete Grocery Line",
            description: "Remove one grocery line.",
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
                "delete_grocery_line",
                async () => {
                    const householdId = await callerHouseholdId();
                    const deleted = await liveGroceryStore().deleteLine(
                        householdId,
                        args.id,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: deleted
                                    ? `Deleted grocery line ${args.id}.`
                                    : `No grocery line found with id ${args.id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "clear_checked_grocery_lines",
        {
            title: "Clear Checked Grocery Lines",
            description: "Remove every checked grocery line.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () =>
            withAnalytics(
                "clear_checked_grocery_lines",
                async () => {
                    const householdId = await callerHouseholdId();
                    const removed = await clearCheckedLines(
                        liveGroceryStore(),
                        householdId,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Cleared ${removed} checked line${removed === 1 ? "" : "s"}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

}

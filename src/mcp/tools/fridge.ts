import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { liveFridgeStore } from "../../db/fridge.js";
import { withAnalytics } from "../../analytics.js";
import { lookupBarcode } from "../../foods.js";
import {
    addFoodByBarcode,
    addLocation,
    addManualFood,
    addSupply,
    deleteItem,
    deleteLocation,
    listFridge,
    moveItem,
    updateItemQuantity,
} from "../../domain/fridge.js";
import type { ToolContext } from "../shared.js";

export function registerFridgeTools(server: McpServer, ctx: ToolContext) {
    const { callerHouseholdId, analytics } = ctx;
    server.registerTool(
        "list_fridge_locations",
        {
            title: "List Fridge Locations",
            description:
                "List household fridge and pantry locations with ids for add_fridge_item.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            outputSchema: z.object({
                locations: z.array(
                    z.object({
                        id: z.string(),
                        name: z.string(),
                        sort_order: z.number(),
                    }),
                ),
            }),
        },
        async () =>
            withAnalytics(
                "list_fridge_locations",
                async () => {
                    const householdId = await callerHouseholdId();
                    const { locations } = await listFridge(
                        liveFridgeStore(),
                        householdId,
                    );
                    const payload = {
                        locations: locations.map((row) => ({
                            id: row.id,
                            name: row.name,
                            sort_order: row.sortOrder,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.locations.length === 0
                                        ? "No fridge locations."
                                        : payload.locations
                                              .map(
                                                  (row) =>
                                                      `${row.name} ${row.id}`,
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
        "list_fridge_items",
        {
            title: "List Fridge Items",
            description:
                "List household fridge items with quantity, location, and identity.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            outputSchema: z.object({
                items: z.array(
                    z.object({
                        id: z.string(),
                        location_id: z.string(),
                        kind: z.enum(["food", "supply"]),
                        display_name: z.string(),
                        amount: z.number(),
                        unit: z.string(),
                    }),
                ),
            }),
        },
        async () =>
            withAnalytics(
                "list_fridge_items",
                async () => {
                    const householdId = await callerHouseholdId();
                    const { items } = await listFridge(
                        liveFridgeStore(),
                        householdId,
                    );
                    const payload = {
                        items: items.map((item) => ({
                            id: item.id,
                            location_id: item.locationId,
                            kind: item.kind,
                            display_name: item.displayName,
                            amount: item.quantity.amount,
                            unit: item.quantity.unit,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.items.length === 0
                                        ? "Fridge is empty."
                                        : payload.items
                                              .map(
                                                  (item) =>
                                                      `${item.display_name} ${item.amount} ${item.unit} ${item.id}`,
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
        "add_fridge_location",
        {
            title: "Add Fridge Location",
            description: "Add a named fridge or pantry location.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                name: z.string().min(1).describe("Location name"),
            }),
            outputSchema: z.object({
                id: z.string(),
                name: z.string(),
            }),
        },
        async (args) =>
            withAnalytics(
                "add_fridge_location",
                async () => {
                    const householdId = await callerHouseholdId();
                    const location = await addLocation(
                        liveFridgeStore(),
                        householdId,
                        args.name,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Added ${location.name} ${location.id}`,
                            },
                        ],
                        structuredContent: {
                            id: location.id,
                            name: location.name,
                        },
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "delete_fridge_location",
        {
            title: "Delete Fridge Location",
            description:
                "Delete a fridge location and the items filed under it.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                id: z.string().describe("Location id"),
            }),
        },
        async (args) =>
            withAnalytics(
                "delete_fridge_location",
                async () => {
                    const householdId = await callerHouseholdId();
                    const deleted = await deleteLocation(
                        liveFridgeStore(),
                        householdId,
                        args.id,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: deleted
                                    ? `Deleted location ${args.id}.`
                                    : `No location found with id ${args.id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "add_fridge_item",
        {
            title: "Add Fridge Item",
            description:
                "Add a food or supply to a fridge location. Food defaults to grams. Pass a barcode for packaged food, a name for a manual food, and name plus unit for a supply.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                location_id: z.string(),
                kind: z.enum(["food", "supply"]),
                amount: z.coerce.number(),
                name: z.string().optional(),
                barcode: z.string().optional(),
                unit: z.string().optional(),
            }),
            outputSchema: z.object({
                id: z.string(),
                display_name: z.string(),
                amount: z.number(),
                unit: z.string(),
            }),
        },
        async (args) =>
            withAnalytics(
                "add_fridge_item",
                async () => {
                    const householdId = await callerHouseholdId();
                    const store = liveFridgeStore();
                    const item =
                        args.kind === "supply"
                            ? await addSupply(store, {
                                  householdId,
                                  locationId: args.location_id,
                                  name: args.name ?? "",
                                  amount: args.amount,
                                  unit: args.unit ?? "",
                              })
                            : args.barcode
                              ? await addFoodByBarcode(
                                    store,
                                    {
                                        householdId,
                                        locationId: args.location_id,
                                        barcode: args.barcode,
                                        amount: args.amount,
                                    },
                                    { lookup: lookupBarcode },
                                )
                              : await addManualFood(store, {
                                    householdId,
                                    locationId: args.location_id,
                                    name: args.name ?? "",
                                    amount: args.amount,
                                });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Added ${item.displayName} ${item.quantity.amount} ${item.quantity.unit} ${item.id}`,
                            },
                        ],
                        structuredContent: {
                            id: item.id,
                            display_name: item.displayName,
                            amount: item.quantity.amount,
                            unit: item.quantity.unit,
                        },
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "update_fridge_item",
        {
            title: "Update Fridge Item",
            description:
                "Change a fridge item's quantity and/or move it to another location.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                id: z.string(),
                amount: z.coerce.number().optional(),
                unit: z.string().optional(),
                location_id: z.string().optional(),
            }),
        },
        async (args) =>
            withAnalytics(
                "update_fridge_item",
                async () => {
                    const householdId = await callerHouseholdId();
                    const store = liveFridgeStore();
                    if (args.amount != null) {
                        const updated = await updateItemQuantity(
                            store,
                            householdId,
                            args.id,
                            { amount: args.amount, unit: args.unit ?? "g" },
                        );
                        if (!updated) {
                            throw new Error(
                                `No fridge item found with id ${args.id}.`,
                            );
                        }
                    }
                    if (args.location_id != null) {
                        const moved = await moveItem(
                            store,
                            householdId,
                            args.id,
                            args.location_id,
                        );
                        if (!moved) {
                            throw new Error(
                                `No fridge item found with id ${args.id}.`,
                            );
                        }
                    }
                    if (args.amount == null && args.location_id == null) {
                        throw new Error("Pass amount and/or location_id.");
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Updated fridge item ${args.id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "delete_fridge_item",
        {
            title: "Delete Fridge Item",
            description: "Remove one fridge item.",
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
                "delete_fridge_item",
                async () => {
                    const householdId = await callerHouseholdId();
                    const deleted = await deleteItem(
                        liveFridgeStore(),
                        householdId,
                        args.id,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: deleted
                                    ? `Deleted fridge item ${args.id}.`
                                    : `No fridge item found with id ${args.id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );
}

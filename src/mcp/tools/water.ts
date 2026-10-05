import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
    insertWater,
    getWaterByDate,
    deleteWater,
} from "../../db/nutrition.js";
import { getUserTimezone } from "../../db/profiles.js";
import { withAnalytics } from "../../analytics.js";
import { todayInTz } from "../../domain/tz.js";
import {
    sumWater,
    LOGGED_AT_FORMS,
    LOGGED_AT_OMIT_IF_NOW,
    resolveWriteTimestamp,
} from "../shared.js";
import type { ToolContext } from "../shared.js";

export function registerWaterTools(server: McpServer, ctx: ToolContext) {
    const {
        personSchema,
        nutritionWriteSchema,
        actorUserId,
        writeUserId,
        analytics,
    } = ctx;
    server.registerTool(
        "log_water",
        {
            title: "Log Water",
            description:
                "Log a hydration entry in milliliters. If the user gives a volume in another unit (cups, oz, liters), convert it: 1 cup = 240 ml, 1 fl oz = 30 ml, 1 L = 1000 ml. If only 'a glass' is mentioned, ask for the size or assume 250 ml and confirm.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: nutritionWriteSchema({
                amount_ml: z.coerce
                    .number()
                    .int()
                    .positive()
                    .describe("Amount in milliliters (integer, > 0)."),
                logged_at: z
                    .string()
                    .optional()
                    .describe(
                        "When this actually happened (defaults to now). " +
                            LOGGED_AT_FORMS +
                            LOGGED_AT_OMIT_IF_NOW,
                    ),
                notes: z
                    .string()
                    .optional()
                    .describe("Optional notes (e.g. 'tea', 'post-workout')."),
                idempotency_key: z
                    .string()
                    .min(1)
                    .max(255)
                    .optional()
                    .describe(
                        "Optional stable key for safe retries. You normally don't need to set this: when omitted, the server derives a stable key from the entry content (including logged_at), so replaying the identical call returns the original entry instead of duplicating it. Pass a UUID only to force-override that behavior. Do NOT reuse a key for genuinely different sips.",
                    ),
            }),
        },
        async ({ user_id, target_member, ...waterArgs }) => {
            return withAnalytics(
                "log_water",
                async () => {
                    const userId = await writeUserId(user_id, target_member);
                    const { iso, note } = await resolveWriteTimestamp(
                        userId,
                        waterArgs.logged_at,
                    );
                    const { entry, deduplicated } = await insertWater(userId, {
                        ...waterArgs,
                        logged_at: iso,
                    });
                    const prefix = deduplicated
                        ? "Already logged (idempotent retry)"
                        : "Water logged";
                    return {
                        content: [
                            {
                                type: "text",
                                text: `${prefix}: ${entry.amount_ml} ml at ${entry.logged_at}${entry.notes ? ` (${entry.notes})` : ""}. ID: ${entry.id}${note}`,
                            },
                        ],
                    };
                },
                analytics,
            );
        },
    );

    server.registerTool(
        "get_water_today",
        {
            title: "Get Today's Water",
            description:
                "Get today's total water intake (ml) and the list of entries.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: personSchema({}),
        },
        async (args) => {
            return withAnalytics(
                "get_water_today",
                async () => {
                    const userId = await actorUserId(args.user_id, "read");
                    const tz = await getUserTimezone(userId);
                    const entries = await getWaterByDate(
                        userId,
                        todayInTz(tz),
                        tz,
                    );
                    if (entries.length === 0) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "No water logged today.",
                                },
                            ],
                        };
                    }
                    const total = sumWater(entries);
                    const lines = entries.map(
                        (e) =>
                            `- ${e.amount_ml} ml at ${e.logged_at}${e.notes ? ` (${e.notes})` : ""} [id: ${e.id}]`,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Total: ${total} ml (${entries.length} entr${entries.length === 1 ? "y" : "ies"})\n\n${lines.join("\n")}`,
                            },
                        ],
                    };
                },
                analytics,
            );
        },
    );

    server.registerTool(
        "get_water_by_date",
        {
            title: "Get Water by Date",
            description:
                "Get water intake total and entries for a specific date.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: personSchema({
                date: z.string().describe("Date in YYYY-MM-DD format"),
            }),
        },
        async ({ date, user_id }) => {
            return withAnalytics(
                "get_water_by_date",
                async () => {
                    const userId = await actorUserId(user_id, "read");
                    const tz = await getUserTimezone(userId);
                    const entries = await getWaterByDate(userId, date, tz);
                    if (entries.length === 0) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `No water logged on ${date}.`,
                                },
                            ],
                        };
                    }
                    const total = sumWater(entries);
                    const lines = entries.map(
                        (e) =>
                            `- ${e.amount_ml} ml at ${e.logged_at}${e.notes ? ` (${e.notes})` : ""} [id: ${e.id}]`,
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Total on ${date}: ${total} ml (${entries.length} entr${entries.length === 1 ? "y" : "ies"})\n\n${lines.join("\n")}`,
                            },
                        ],
                    };
                },
                analytics,
                { date },
            );
        },
    );

    server.registerTool(
        "delete_water",
        {
            title: "Delete Water Entry",
            description: "Delete a water log entry by ID.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: nutritionWriteSchema({
                id: z.string().describe("UUID of the water entry to delete"),
            }),
        },
        async ({ id, user_id, target_member }) => {
            return withAnalytics(
                "delete_water",
                async () => {
                    const userId = await writeUserId(user_id, target_member);
                    const deleted = await deleteWater(userId, id);
                    return {
                        content: [
                            {
                                type: "text",
                                text: deleted
                                    ? `Water entry ${id} deleted.`
                                    : `No water entry found with id ${id}.`,
                            },
                        ],
                    };
                },
                analytics,
            );
        },
    );
}

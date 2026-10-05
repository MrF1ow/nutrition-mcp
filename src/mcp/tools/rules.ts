import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
    liveRulesStore,
} from "../../supabase.js";
import {
    withAnalytics,
} from "../../analytics.js";
import {
    addAllergen,
    addDislike,
    addPersonRule,
    addStoreRule,
} from "../../rules.js";
import {
    ALLERGEN_SCHEMA,
} from "../shared.js";
import type { ToolContext } from "../shared.js";

export function registerRulesTools(
    server: McpServer,
    ctx: ToolContext,
) {
    const {
        callerHouseholdId,
        requireHouseholdMemberId,
        analytics,
    } = ctx;
    server.registerTool(
        "list_store_rules",
        {
            title: "List Store Rules",
            description: "List free-text rules for a grocery store.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                store_id: z.string(),
            }),
            outputSchema: z.object({
                rules: z.array(
                    z.object({
                        id: z.string(),
                        body: z.string(),
                    }),
                ),
            }),
        },
        async (args) =>
            withAnalytics(
                "list_store_rules",
                async () => {
                    await callerHouseholdId();
                    const rules = await liveRulesStore().listStoreRules(
                        args.store_id,
                    );
                    const payload = {
                        rules: rules.map((rule) => ({
                            id: rule.id,
                            body: rule.body,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.rules.length === 0
                                        ? "No store rules."
                                        : payload.rules
                                              .map((rule) => rule.body)
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
        "set_store_rules",
        {
            title: "Set Store Rules",
            description: "Add a free-text rule on a grocery store.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                store_id: z.string(),
                body: z.string().min(1),
            }),
            outputSchema: z.object({
                id: z.string(),
                body: z.string(),
            }),
        },
        async (args) =>
            withAnalytics(
                "set_store_rules",
                async () => {
                    const householdId = await callerHouseholdId();
                    const rule = await addStoreRule(liveRulesStore(), {
                        householdId,
                        storeId: args.store_id,
                        body: args.body,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Stored rule: ${rule.body}`,
                            },
                        ],
                        structuredContent: { id: rule.id, body: rule.body },
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "list_person_rules",
        {
            title: "List Person Rules",
            description: "List free-text rules for a household member.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                member_id: z.string(),
            }),
            outputSchema: z.object({
                rules: z.array(
                    z.object({
                        id: z.string(),
                        body: z.string(),
                    }),
                ),
            }),
        },
        async (args) =>
            withAnalytics(
                "list_person_rules",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const rules = await liveRulesStore().listPersonRules(
                        householdId,
                        args.member_id,
                    );
                    const payload = {
                        rules: rules.map((rule) => ({
                            id: rule.id,
                            body: rule.body,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.rules.length === 0
                                        ? "No person rules."
                                        : payload.rules
                                              .map((rule) => rule.body)
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
        "set_person_rules",
        {
            title: "Set Person Rules",
            description: "Add a free-text rule for a household member.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                member_id: z.string(),
                body: z.string().min(1),
            }),
        },
        async (args) =>
            withAnalytics(
                "set_person_rules",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const rule = await addPersonRule(liveRulesStore(), {
                        householdId,
                        userId: args.member_id,
                        body: args.body,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Stored person rule: ${rule.body}`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "list_person_allergens",
        {
            title: "List Person Allergens",
            description: "List allergens recorded for a household member.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                member_id: z.string(),
            }),
            outputSchema: z.object({
                allergens: z.array(
                    z.object({
                        allergen: z.string(),
                        other_label: z.string().nullable(),
                    }),
                ),
            }),
        },
        async (args) =>
            withAnalytics(
                "list_person_allergens",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const rows = await liveRulesStore().listAllergens(
                        householdId,
                        args.member_id,
                    );
                    const payload = {
                        allergens: rows.map((row) => ({
                            allergen: row.allergen,
                            other_label: row.otherLabel,
                        })),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.allergens.length === 0
                                        ? "No allergens."
                                        : payload.allergens
                                              .map((row) =>
                                                  row.other_label
                                                      ? `${row.allergen} (${row.other_label})`
                                                      : row.allergen,
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
        "set_person_allergens",
        {
            title: "Set Person Allergens",
            description:
                "Add an allergen for a household member. Grocery and recipe tools warn when a name matches.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                member_id: z.string(),
                allergen: ALLERGEN_SCHEMA,
                other_label: z.string().optional(),
            }),
        },
        async (args) =>
            withAnalytics(
                "set_person_allergens",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const row = await addAllergen(liveRulesStore(), {
                        householdId,
                        userId: args.member_id,
                        allergen: args.allergen,
                        otherLabel: args.other_label,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Recorded ${row.allergen}${row.otherLabel ? ` (${row.otherLabel})` : ""} for ${args.member_id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "list_person_dislikes",
        {
            title: "List Person Dislikes",
            description: "List foods a household member dislikes.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                member_id: z.string(),
            }),
            outputSchema: z.object({
                dislikes: z.array(z.string()),
            }),
        },
        async (args) =>
            withAnalytics(
                "list_person_dislikes",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const rows = await liveRulesStore().listDislikes(
                        householdId,
                        args.member_id,
                    );
                    const payload = {
                        dislikes: rows.map((row) => row.displayName),
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.dislikes.length === 0
                                        ? "No dislikes."
                                        : payload.dislikes.join("\n"),
                            },
                        ],
                        structuredContent: payload,
                    };
                },
                analytics,
            ),
    );

    server.registerTool(
        "set_person_dislikes",
        {
            title: "Set Person Dislikes",
            description: "Add a disliked food for a household member.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                member_id: z.string(),
                display_name: z.string().min(1),
            }),
        },
        async (args) =>
            withAnalytics(
                "set_person_dislikes",
                async () => {
                    const householdId = await callerHouseholdId();
                    await requireHouseholdMemberId(args.member_id);
                    const row = await addDislike(liveRulesStore(), {
                        householdId,
                        userId: args.member_id,
                        displayName: args.display_name,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Recorded dislike ${row.displayName} for ${args.member_id}.`,
                            },
                        ],
                    };
                },
                analytics,
            ),
    );

}

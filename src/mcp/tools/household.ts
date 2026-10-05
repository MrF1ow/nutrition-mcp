import { type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { HOUSEHOLD_CANNOT_DELETE_ACCOUNT } from "../../auth-context.js";
import {
    householdConfigToWire,
    mergeHouseholdConfig,
    parseFridgeLocationsInput,
    parseHouseholdConfigPatch,
    parseMemberInput,
} from "../../household.js";
import {
    generateHouseholdToken,
    hashHouseholdToken,
    householdTokenHashHex,
} from "../../household-token.js";
import {
    deleteAllUserData,
    listHouseholdMembers,
    addHouseholdMemberForHousehold,
    getHouseholdConfig,
    updateHouseholdConfig,
    rotateHouseholdMcpToken,
} from "../../supabase.js";
import {
    DELETED_ACCOUNT_ANALYTICS_ID,
    withAnalytics,
} from "../../analytics.js";
import type { ToolContext } from "../shared.js";

export function registerHouseholdTools(server: McpServer, ctx: ToolContext) {
    const {
        auth,
        requireUser,
        callerHouseholdId,
        callerOwnerHouseholdId,
        analytics,
    } = ctx;
    const LIST_MEMBERS_OUTPUT_SCHEMA = z.object({
        members: z.array(
            z.object({
                user_id: z.string(),
                display_name: z.string(),
                role: z.enum(["owner", "member"]),
            }),
        ),
    });

    server.registerTool(
        "list_members",
        {
            title: "List Household Members",
            description:
                "List household members as user_id, display_name, and role. A household bot token and any household member may call this. Person tools on a household token require user_id set to one of these ids.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            outputSchema: LIST_MEMBERS_OUTPUT_SCHEMA,
        },
        async () => {
            return withAnalytics(
                "list_members",
                async () => {
                    const householdId = await callerHouseholdId();
                    const members = await listHouseholdMembers(householdId);
                    const payload = members.map((member) => ({
                        user_id: member.userId,
                        display_name: member.displayName,
                        role: member.role,
                    }));
                    const lines =
                        payload.length === 0
                            ? "No household members."
                            : payload
                                  .map(
                                      (member) =>
                                          `${member.display_name} (${member.role}) ${member.user_id}`,
                                  )
                                  .join("\n");
                    return {
                        content: [
                            {
                                type: "text",
                                text: lines,
                            },
                        ],
                        structuredContent: { members: payload },
                    };
                },
                analytics,
            );
        },
    );

    const ADD_HOUSEHOLD_MEMBER_OUTPUT_SCHEMA = z.object({
        user_id: z.string(),
        display_name: z.string(),
        role: z.literal("member"),
    });

    server.registerTool(
        "add_household_member",
        {
            title: "Add Household Member",
            description:
                "Create an Auth login and household_members row. Pass display_name, password, and either email or username. Username becomes {username}@household.invalid. Only the household owner or the household bot may call this. The new row is always role member. Returns user_id for later person tools. Does not send invite email.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                display_name: z.string(),
                password: z.string(),
                email: z.string().optional(),
                username: z.string().optional(),
            }),
            outputSchema: ADD_HOUSEHOLD_MEMBER_OUTPUT_SCHEMA,
        },
        async (args) => {
            return withAnalytics(
                "add_household_member",
                async () => {
                    const parsed = parseMemberInput(args);
                    if (!parsed.ok) throw new Error(parsed.error);
                    const householdId = await callerOwnerHouseholdId();
                    const added = await addHouseholdMemberForHousehold(
                        householdId,
                        parsed.value,
                    );
                    if (!added.ok) throw new Error(added.error);
                    const payload = {
                        user_id: added.userId,
                        display_name: parsed.value.displayName,
                        role: "member" as const,
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Added ${payload.display_name} (${payload.role}) ${payload.user_id}`,
                            },
                        ],
                        structuredContent: payload,
                    };
                },
                analytics,
            );
        },
    );

    const RECIPE_PLACE_KIND_SCHEMA = z.enum([
        "grocery",
        "recipe_site",
        "meal_kit",
        "other",
    ]);
    const HOUSEHOLD_CONFIG_OUTPUT_SCHEMA = z.object({
        name: z.string(),
        fridge_locations: z.array(z.string()),
        recipe_search_places: z.array(
            z.object({
                name: z.string(),
                kind: RECIPE_PLACE_KIND_SCHEMA,
                url: z.string().nullable(),
            }),
        ),
        preferences: z.object({
            constraints: z.array(z.string()),
            budget: z.string().nullable(),
            shopping_cadence: z.string().nullable(),
        }),
    });
    const FRIDGE_LOCATIONS_OUTPUT_SCHEMA = z.object({
        fridge_locations: z.array(z.string()),
    });

    server.registerTool(
        "get_household_config",
        {
            title: "Get Household Config",
            description:
                "Read the household name, fridge locations, recipe search places, and shared preferences. A household bot token and any household member may call this. Writes are household-scoped, not a person user_id.",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            outputSchema: HOUSEHOLD_CONFIG_OUTPUT_SCHEMA,
        },
        async () => {
            return withAnalytics(
                "get_household_config",
                async () => {
                    const householdId = await callerHouseholdId();
                    const config = householdConfigToWire(
                        await getHouseholdConfig(householdId),
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `${config.name}\nFridge: ${config.fridge_locations.join(", ") || "(none)"}`,
                            },
                        ],
                        structuredContent: config,
                    };
                },
                analytics,
            );
        },
    );

    server.registerTool(
        "update_household_config",
        {
            title: "Update Household Config",
            description:
                "Merge household name, fridge locations, recipe search places, or shared preferences. Only the household owner or the household bot may call this. Places are labels only, not a recipe table.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                name: z.string().min(1).optional(),
                fridge_locations: z.array(z.string()).optional(),
                recipe_search_places: z
                    .array(
                        z.object({
                            name: z.string(),
                            kind: RECIPE_PLACE_KIND_SCHEMA,
                            url: z.string().nullable().optional(),
                        }),
                    )
                    .optional(),
                preferences: z
                    .object({
                        constraints: z.array(z.string()).optional(),
                        budget: z.string().nullable().optional(),
                        shopping_cadence: z.string().nullable().optional(),
                    })
                    .optional(),
            }),
            outputSchema: HOUSEHOLD_CONFIG_OUTPUT_SCHEMA,
        },
        async (args) => {
            return withAnalytics(
                "update_household_config",
                async () => {
                    const parsed = parseHouseholdConfigPatch(args);
                    if (!parsed.ok) throw new Error(parsed.error);
                    const householdId = await callerOwnerHouseholdId();
                    const current = await getHouseholdConfig(householdId);
                    const config = householdConfigToWire(
                        await updateHouseholdConfig(
                            householdId,
                            mergeHouseholdConfig(current, parsed.value),
                        ),
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Updated ${config.name}`,
                            },
                        ],
                        structuredContent: config,
                    };
                },
                analytics,
            );
        },
    );

    server.registerTool(
        "update_fridge_locations",
        {
            title: "Update Fridge Locations",
            description:
                "Replace the household fridge and freezer location list. Only the household owner or the household bot may call this.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            inputSchema: z.object({
                locations: z.array(z.string()),
            }),
            outputSchema: FRIDGE_LOCATIONS_OUTPUT_SCHEMA,
        },
        async (args) => {
            return withAnalytics(
                "update_fridge_locations",
                async () => {
                    const parsed = parseFridgeLocationsInput(args);
                    if (!parsed.ok) throw new Error(parsed.error);
                    const householdId = await callerOwnerHouseholdId();
                    const current = await getHouseholdConfig(householdId);
                    const written = await updateHouseholdConfig(
                        householdId,
                        mergeHouseholdConfig(current, {
                            fridgeLocations: parsed.value,
                        }),
                    );
                    const payload = {
                        fridge_locations: written.fridgeLocations,
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    payload.fridge_locations.length === 0
                                        ? "Fridge locations cleared."
                                        : `Fridge locations: ${payload.fridge_locations.join(", ")}`,
                            },
                        ],
                        structuredContent: payload,
                    };
                },
                analytics,
            );
        },
    );

    const ROTATE_HOUSEHOLD_TOKEN_OUTPUT_SCHEMA = z.object({
        token: z.string(),
        issued_at: z.string(),
    });

    server.registerTool(
        "rotate_household_token",
        {
            title: "Rotate Household Token",
            description:
                "Issue a new household bot token (prefix nt_hh_). The plaintext is returned once; only its SHA-256 hash is stored. Only the household owner may rotate. A household PAT may rotate and invalidates itself.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            outputSchema: ROTATE_HOUSEHOLD_TOKEN_OUTPUT_SCHEMA,
        },
        async () => {
            return withAnalytics(
                "rotate_household_token",
                async () => {
                    const householdId = await callerOwnerHouseholdId();
                    const issuedBy = auth.kind === "user" ? auth.userId : null;
                    const token = generateHouseholdToken();
                    const issued_at = await rotateHouseholdMcpToken({
                        householdId,
                        tokenHashHex: householdTokenHashHex(
                            hashHouseholdToken(token),
                        ),
                        issuedBy,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Household bot token (shown once):\n${token}`,
                            },
                        ],
                        structuredContent: { token, issued_at },
                    };
                },
                analytics,
            );
        },
    );

    server.registerTool(
        "delete_account",
        {
            title: "Delete Account",
            description:
                "Permanently delete the user's account and all associated data (meals, tokens, auth). This action is irreversible. Always confirm with the user before calling this tool.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
            inputSchema: z.object({
                confirm: z
                    .boolean()
                    .describe(
                        "Must be true to confirm deletion. Always ask the user for explicit confirmation before setting this to true.",
                    ),
            }),
        },
        async ({ confirm }) => {
            return withAnalytics(
                "delete_account",
                async () => {
                    if (auth.kind === "household") {
                        throw new Error(HOUSEHOLD_CANNOT_DELETE_ACCOUNT);
                    }
                    const userId = requireUser();
                    if (!confirm) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Account deletion cancelled. No data was removed.",
                                },
                            ],
                        };
                    }
                    await deleteAllUserData(userId);
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Your account and all associated data have been permanently deleted.",
                            },
                        ],
                    };
                },
                // deleteAllUserData wipes tool_analytics before anything else,
                // so the row withAnalytics writes once this handler settles
                // must not carry the id it just erased. The cancelled path
                // keeps the request's analytics id (the OAuth user, or hh:<id>
                // for a household token that never reaches a person).
                {
                    ...analytics,
                    userId: confirm
                        ? DELETED_ACCOUNT_ANALYTICS_ID
                        : analytics.userId,
                },
            );
        },
    );
}

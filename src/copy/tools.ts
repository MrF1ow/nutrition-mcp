/** MCP tool identity catalog. mcp.test.ts pins tools/list against TOOLS
 * names and checks person-scoped tools carry optional user_id. */

export type CategoryId =
    | "logging-food-meals"
    | "reviewing-your-meals"
    | "water"
    | "weight"
    | "goals-progress"
    | "insights-trends"
    | "settings-account";

export type BadgeKind =
    | "log"
    | "import"
    | "edit"
    | "setting"
    | "lookup"
    | "view"
    | "export"
    | "remove"
    | "widget";

export interface ToolParamIdentity {
    name: string;
    required: boolean;
}

export interface ToolIdentity {
    name: string;
    category: CategoryId;
    badges: BadgeKind[];
    params: ToolParamIdentity[];
    hasPhotoHint: boolean;
}

const TOOLS_BASE: ToolIdentity[] = [
    {
        name: "log_meal",
        category: "logging-food-meals",
        badges: ["log", "widget"],
        params: [
            { name: "description", required: true },
            { name: "meal_type", required: true },
            { name: "calories", required: false },
            { name: "protein_g", required: false },
            { name: "carbs_g", required: false },
            { name: "fat_g", required: false },
            { name: "fiber_g", required: false },
            { name: "sugar_g", required: false },
            { name: "alcohol_g", required: false },
            { name: "caffeine_mg", required: false },
            { name: "logged_at", required: false },
            { name: "notes", required: false },
        ],
        hasPhotoHint: true,
    },
    {
        name: "lookup_barcode",
        category: "logging-food-meals",
        badges: ["lookup"],
        params: [],
        hasPhotoHint: true,
    },
    {
        name: "start_meal_import",
        category: "logging-food-meals",
        badges: ["import", "widget"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "bulk_import_meals",
        category: "logging-food-meals",
        badges: ["import"],
        params: [
            { name: "meals", required: true },
            { name: "expected_row_count", required: true },
            { name: "expected_total_kcal", required: false },
            { name: "dry_run", required: false },
            { name: "on_error", required: false },
            { name: "source_app", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "update_meal",
        category: "logging-food-meals",
        badges: ["edit", "widget"],
        params: [
            { name: "id", required: true },
            { name: "description", required: false },
            { name: "calories", required: false },
            { name: "protein_g", required: false },
            { name: "carbs_g", required: false },
            { name: "fat_g", required: false },
            { name: "fiber_g", required: false },
            { name: "sugar_g", required: false },
            { name: "alcohol_g", required: false },
            { name: "caffeine_mg", required: false },
            { name: "logged_at", required: false },
            { name: "notes", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "delete_meal",
        category: "logging-food-meals",
        badges: ["remove"],
        params: [{ name: "id", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "search_meals",
        category: "reviewing-your-meals",
        badges: ["view"],
        params: [
            { name: "queries", required: true },
            { name: "days", required: false },
            { name: "limit", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "get_meals_today",
        category: "reviewing-your-meals",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "get_meals_by_date",
        category: "reviewing-your-meals",
        badges: ["view"],
        params: [{ name: "date", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "get_meals_by_date_range",
        category: "reviewing-your-meals",
        badges: ["view"],
        params: [
            { name: "start_date", required: true },
            { name: "end_date", required: true },
        ],
        hasPhotoHint: false,
    },
    {
        name: "export_all_data",
        category: "reviewing-your-meals",
        badges: ["export"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "log_water",
        category: "water",
        badges: ["log"],
        params: [{ name: "amount_ml", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "get_water_today",
        category: "water",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "get_water_by_date",
        category: "water",
        badges: ["view"],
        params: [{ name: "date", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "delete_water",
        category: "water",
        badges: ["remove"],
        params: [{ name: "id", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "log_weight",
        category: "weight",
        badges: ["log"],
        params: [{ name: "weight", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "update_weight",
        category: "weight",
        badges: ["edit"],
        params: [
            { name: "id", required: true },
            { name: "weight", required: false },
            { name: "logged_at", required: false },
            { name: "notes", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "delete_weight",
        category: "weight",
        badges: ["remove"],
        params: [{ name: "id", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "get_weight_today",
        category: "weight",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "get_weight_by_date",
        category: "weight",
        badges: ["view"],
        params: [{ name: "date", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "get_weight_by_date_range",
        category: "weight",
        badges: ["view"],
        params: [
            { name: "start_date", required: true },
            { name: "end_date", required: true },
        ],
        hasPhotoHint: false,
    },
    {
        name: "get_weight_trends",
        category: "weight",
        badges: ["view", "widget"],
        params: [{ name: "days", required: false }],
        hasPhotoHint: false,
    },
    {
        name: "set_weight_unit",
        category: "weight",
        badges: ["setting"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "set_nutrition_goals",
        category: "goals-progress",
        badges: ["setting"],
        params: [
            { name: "daily_calories", required: false },
            { name: "daily_protein_g", required: false },
            { name: "daily_carbs_g", required: false },
            { name: "daily_fat_g", required: false },
            { name: "daily_fiber_g", required: false },
            { name: "daily_sugar_g", required: false },
            { name: "daily_alcohol_g", required: false },
            { name: "daily_caffeine_mg", required: false },
            { name: "daily_water_ml", required: false },
            { name: "target_weight", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "get_nutrition_goals",
        category: "goals-progress",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "get_goal_progress",
        category: "goals-progress",
        badges: ["view", "widget"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "get_nutrition_summary",
        category: "goals-progress",
        badges: ["view", "widget"],
        params: [
            { name: "start_date", required: true },
            { name: "end_date", required: true },
        ],
        hasPhotoHint: false,
    },
    {
        name: "get_trends",
        category: "insights-trends",
        badges: ["view", "widget"],
        params: [{ name: "days", required: false }],
        hasPhotoHint: false,
    },
    {
        name: "get_meal_patterns",
        category: "insights-trends",
        badges: ["view"],
        params: [{ name: "days", required: false }],
        hasPhotoHint: false,
    },
    {
        name: "get_profile",
        category: "settings-account",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "set_timezone",
        category: "settings-account",
        badges: ["setting"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "set_language",
        category: "settings-account",
        badges: ["setting"],
        params: [{ name: "locale", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "get_current_time",
        category: "settings-account",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "set_widget_display",
        category: "settings-account",
        badges: ["setting"],
        params: [{ name: "enabled", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "set_alcohol_tracking",
        category: "settings-account",
        badges: ["setting"],
        params: [
            { name: "enabled", required: true },
            { name: "drink_unit", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "list_members",
        category: "settings-account",
        badges: ["lookup"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "add_household_member",
        category: "settings-account",
        badges: ["setting"],
        params: [
            { name: "display_name", required: true },
            { name: "password", required: true },
            { name: "email", required: false },
            { name: "username", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "rotate_household_token",
        category: "settings-account",
        badges: ["setting"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "get_household_config",
        category: "settings-account",
        badges: ["view"],
        params: [],
        hasPhotoHint: false,
    },
    {
        name: "update_household_config",
        category: "settings-account",
        badges: ["setting"],
        params: [
            { name: "name", required: false },
            { name: "fridge_locations", required: false },
            { name: "recipe_search_places", required: false },
            { name: "preferences", required: false },
        ],
        hasPhotoHint: false,
    },
    {
        name: "update_fridge_locations",
        category: "settings-account",
        badges: ["setting"],
        params: [{ name: "locations", required: true }],
        hasPhotoHint: false,
    },
    {
        name: "delete_account",
        category: "settings-account",
        badges: ["remove"],
        params: [],
        hasPhotoHint: false,
    },
];

export const HOUSEHOLD_SCOPED_TOOL_NAMES = [
    "list_members",
    "add_household_member",
    "rotate_household_token",
    "get_household_config",
    "update_household_config",
    "update_fridge_locations",
] as const;

export const OAUTH_ONLY_TOOL_NAMES = ["delete_account"] as const;

const PERSON_USER_ID_PARAM: ToolParamIdentity = {
    name: "user_id",
    required: false,
};

export const TOOLS: ToolIdentity[] = TOOLS_BASE.map((tool) => {
    if (
        (HOUSEHOLD_SCOPED_TOOL_NAMES as readonly string[]).includes(
            tool.name,
        ) ||
        (OAUTH_ONLY_TOOL_NAMES as readonly string[]).includes(tool.name)
    ) {
        return tool;
    }
    return {
        ...tool,
        params: [...tool.params, PERSON_USER_ID_PARAM],
    };
});

import type { SiteLocale } from "../routes.js";
import { TOOLS_DE } from "./tools.de.js";
import { TOOLS_ES } from "./tools.es.js";
import { TOOLS_FR } from "./tools.fr.js";
import { TOOLS_NL } from "./tools.nl.js";
import { TOOLS_PL } from "./tools.pl.js";
import { TOOLS_IT } from "./tools.it.js";
import { TOOLS_UK } from "./tools.uk.js";
import { TOOLS_JA } from "./tools.ja.js";

/** The 7 tool categories, in page order — matches both the category
 * jump-bar and the order the tool-group sections appear in below it. */
export type CategoryId =
    | "logging-food-meals"
    | "reviewing-your-meals"
    | "water"
    | "weight"
    | "goals-progress"
    | "insights-trends"
    | "settings-account";

/** Badge ("chip") kinds shown in a tool card's header. Two kinds can
 * share a CSS class but carry different text — "log" and "import" both
 * render as chip-log, "view" and "export" both render as chip-view — see
 * BADGE_META for that structural wiring and ToolsDoc.badges for the
 * (locale-translatable) label text, kept once here rather than per tool. */
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

/** CSS class + optional Font Awesome icon per badge kind — structural,
 * identical across every locale, so it lives beside TOOLS rather than
 * inside ToolsDoc. */
export const BADGE_META: Record<BadgeKind, { cls: string; icon?: string }> = {
    log: { cls: "chip-log" },
    import: { cls: "chip-log" },
    edit: { cls: "chip-edit" },
    setting: { cls: "chip-setting" },
    lookup: { cls: "chip-lookup" },
    view: { cls: "chip-view" },
    export: { cls: "chip-view" },
    remove: { cls: "chip-remove" },
    widget: { cls: "chip-widget", icon: "fa-solid fa-table-cells-large" },
};

/** The 7 categories in page order, and each one's Font Awesome icon class
 * — structural, identical across every locale (same reasoning as
 * BADGE_META: the icon and ordering never change with translation, only
 * CategoryProse's pillLabel/title/description do). */
export const CATEGORIES: CategoryId[] = [
    "logging-food-meals",
    "reviewing-your-meals",
    "water",
    "weight",
    "goals-progress",
    "insights-trends",
    "settings-account",
];

export const CATEGORY_META: Record<CategoryId, { icon: string }> = {
    "logging-food-meals": { icon: "fa-solid fa-utensils" },
    "reviewing-your-meals": { icon: "fa-solid fa-clock-rotate-left" },
    water: { icon: "fa-solid fa-droplet" },
    weight: { icon: "fa-solid fa-weight-scale" },
    "goals-progress": { icon: "fa-solid fa-bullseye" },
    "insights-trends": { icon: "fa-solid fa-chart-line" },
    "settings-account": { icon: "fa-solid fa-gear" },
};

/** One tool card's parameter identity. `name` is a literal MCP API field
 * name and is NEVER translated; its description lives in
 * ToolProse.params, keyed by this same name. */
export interface ToolParamIdentity {
    name: string;
    required: boolean;
}

/** One tool card's structural identity — everything about it that is NOT
 * prose. `name` is the literal MCP tool name (never translated); it
 * doubles as the card's `id=` anchor and as the key into
 * ToolsDoc.tools. */
export interface ToolIdentity {
    name: string;
    category: CategoryId;
    /** Badge chips shown in the card header, in display order. */
    badges: BadgeKind[];
    /** Parameters shown in the card's "Parameters" list, in display
     * order. Empty array = the card shows no Parameters section at all. */
    params: ToolParamIdentity[];
    /** Whether the card's "Try saying" block also shows the "...or send a
     * photo" alternate-input hint (only log_meal and lookup_barcode do). */
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

/** One category's translatable copy — the jump-bar pill's short label,
 * and the section head's longer title + one-line description. */
export interface CategoryProse {
    pillLabel: string;
    title: string;
    description: string;
}

/**
 * A tool's translatable prose. `params` is keyed by ToolParamIdentity.name
 * — only for params this tool actually has (see ToolIdentity.params) —
 * and every value is a trusted HTML string. An empty string means the
 * parameter row shows only its name and required/optional badge, with no
 * trailing description — true of several params on update_meal, update_weight, and
 * set_nutrition_goals in the English source (the field is self-
 * explanatory, or already described by a sibling like `calories` in
 * log_meal).
 */
export interface ToolProse {
    /** Plain text, escaped by the generator. */
    description: string;
    /** Keyed by ToolParamIdentity.name. Trusted HTML. */
    params: Record<string, string>;
    /** The "Try saying" example phrase. Plain text, escaped by the
     * generator. */
    example: string;
    /** The "...or send a photo" alternate-input hint. Plain text, escaped
     * by the generator. Present only when ToolIdentity.hasPhotoHint is
     * true for this tool. */
    photoHint?: string;
}

export interface ToolsDoc {
    /** `<head>` metadata. `title` is the bare page title — the generator
     * appends " — Nutrition MCP", the same convention LegalDoc.title
     * follows — and reuses it for `og:title` too, since the English
     * source's `<title>` and `og:title` are identical text. */
    meta: {
        title: string;
        description: string;
        ogDescription: string;
    };
    hero: {
        eyebrow: string;
        title: string;
        lead: string;
        /** The bold "N tools" lead-in of the hero's count pill. */
        countBold: string;
        /** The count pill's trailing text, e.g. "across 7 areas". */
        countTail: string;
    };
    categories: Record<CategoryId, CategoryProse>;
    /** One translatable label per BadgeKind, shown on every card that
     * carries that badge — keyed once here, not per tool (see
     * BadgeKind's doc comment). */
    badges: Record<BadgeKind, string>;
    /** Structural UI chrome repeated on every tool card — was hardcoded
     * English in scripts/gen-tools.ts until a translation review caught it
     * (every tool's prose was translated, but these labels weren't). */
    ui: {
        /** The "Parameters" section label. */
        parametersLabel: string;
        /** ToolParamIdentity.required's badge text. */
        requiredLabel: string;
        /** ToolParamIdentity.required === false's badge text. */
        optionalLabel: string;
        /** The label above each card's example prompt. */
        trySayingLabel: string;
    };
    /** Keyed by ToolIdentity.name. */
    tools: Record<string, ToolProse>;
}

const TOOLS_EN: ToolsDoc = {
    meta: {
        title: "Tools Reference: All 42 Tools",
        description:
            "All 42 tools the Nutrition MCP server gives your AI — log meals, scan barcodes, import your history from another app, track water and weight, set goals, and review trends. Full reference with descriptions and example prompts.",
        ogDescription:
            "All 42 tools the Nutrition MCP server gives your AI, including a CSV importer for your history from another app — with descriptions and example prompts.",
    },
    hero: {
        eyebrow: "Reference",
        title: "Everything your AI can do",
        lead: "You never call these directly — you just talk, and the assistant picks the right tool. Here's the full set the Nutrition MCP server exposes, with what each one does and a phrase that triggers it.",
        countBold: "42 tools",
        countTail: "across 7 areas",
    },
    categories: {
        "logging-food-meals": {
            pillLabel: "Logging",
            title: "Logging food & meals",
            description:
                "The core loop — capture what you ate, however you describe it.",
        },
        "reviewing-your-meals": {
            pillLabel: "Reviewing",
            title: "Reviewing your meals",
            description:
                "Look back over what you've logged, one day or a whole range at a time.",
        },
        water: {
            pillLabel: "Water",
            title: "Water",
            description: "Track hydration alongside your food.",
        },
        weight: {
            pillLabel: "Weight",
            title: "Weight",
            description:
                "Log weigh-ins, review them, and watch the trend toward your target.",
        },
        "goals-progress": {
            pillLabel: "Goals",
            title: "Goals & progress",
            description: "Set targets and see how each day measures up.",
        },
        "insights-trends": {
            pillLabel: "Insights",
            title: "Insights & trends",
            description:
                "Pre-aggregated analysis so the AI can spot patterns without doing arithmetic.",
        },
        "settings-account": {
            pillLabel: "Settings",
            title: "Settings & account",
            description:
                "Preferences that keep everything accurate, plus full control of your data.",
        },
    },
    badges: {
        log: "Log",
        widget: "Interactive UI",
        lookup: "Look up",
        import: "Import",
        edit: "Edit",
        remove: "Remove",
        view: "View",
        export: "Export",
        setting: "Setting",
    },
    ui: {
        parametersLabel: "Parameters",
        requiredLabel: "required",
        optionalLabel: "optional",
        trySayingLabel: "Try saying",
    },
    tools: {
        log_meal: {
            description:
                "Log what you ate with calories and macros — plus fiber, total sugar, alcohol and caffeine when the numbers are there. Describe it in plain language — the AI estimates the numbers, asks about portion size when it's unclear, and can pull label data from a barcode or the web first.",
            params: {
                description: "What was eaten",
                meal_type: "breakfast, lunch, dinner or snack",
                calories: "Total calories",
                protein_g: "Protein in grams",
                carbs_g: "Carbohydrates in grams",
                fat_g: "Fat in grams",
                fiber_g:
                    "Dietary fiber in grams. The AI is told to fill this in on every meal, estimating from the ingredients when no label figure exists, because a blank is not a zero — it leaves the whole day out of your fiber average",
                sugar_g:
                    '<b>Total</b> sugars in grams — the figure a label prints under "Sugars", including the sugar naturally in fruit and milk, not just added sugar. Filled in on every meal on the same terms as fiber',
                alcohol_g:
                    "Grams of <b>pure ethanol</b>, not the volume of the drink and not its ABV — the AI works it out from the pour size and strength (a 330 ml 5% beer is 13 g)",
                caffeine_mg:
                    "Caffeine in <b>milligrams</b>, not grams — the one field here that isn't in grams, because that is how every label and guideline states it (a brewed coffee is about 95 mg, an espresso 63 mg, a can of cola 34 mg). Caffeine adds no calories. Unlike fiber and sugar it is only sent for things that actually contain caffeine — a recorded 0 would put a caffeine row on your dashboard for a nutrient you never consume",
                logged_at:
                    "When you ate it, if not now — lets you log something after the fact",
                notes: "Additional notes",
            },
            example: "Log a chicken burrito bowl with extra guac for lunch",
            photoHint:
                "…or just snap a photo of your plate — the AI names each dish, sizes portions in everyday measures (a glass, a handful), checks how you've logged it before, and confirms with you before logging.",
        },
        lookup_barcode: {
            description:
                "Fetch a packaged product's label nutrition from Open Food Facts by its barcode (8–14 digit EAN/UPC). You can type the digits or read them off a photo of the package; the result can then be logged, scaled to how much you ate.",
            params: {},
            example: "Scan this barcode: 3017620422003",
            photoHint:
                "…or send a photo of the package — the AI reads the barcode digits off it.",
        },
        start_meal_import: {
            description:
                "Open an importer in the chat to bring your history over from another app — pick the file you exported from MyFitnessPal, Cronometer, Lose It! or MacroFactor, match its columns to calories, macros, fiber, sugar and caffeine — plus alcohol if you've turned alcohol tracking on — and review what will be added before you confirm. The file is read in your browser, nothing is saved until you approve the preview, and importing the same file again won't create duplicates.",
            params: {},
            example: "Import my meal history from MyFitnessPal",
        },
        bulk_import_meals: {
            description:
                "Add a batch of past meals in one go — up to 50 at a time — instead of logging them one by one. The importer above writes through this, and the AI can use it directly for meal data you've pasted into the chat. Every row is checked first and anything that doesn't fit is reported row by row, so re-sending the same rows is safe and won't duplicate what's already logged.",
            params: {
                meals: "The rows to import, in source-file order (1–50 per call). Each row can carry a time, meal type, description, notes and the same numbers as a logged meal: <code>calories</code>, <code>protein_g</code>, <code>carbs_g</code>, <code>fat_g</code>, <code>fiber_g</code>, <code>sugar_g</code> (total sugars), <code>alcohol_g</code> (grams of pure ethanol) and <code>caffeine_mg</code> (milligrams, not grams)",
                expected_row_count:
                    "How many rows this call carries, counted from the source file, so a dropped row gets caught",
                expected_total_kcal:
                    "Calorie total from the source file, reconciled against what arrives",
                dry_run: "Report what would happen without writing anything",
                on_error:
                    "Import the valid rows and report the rest, or write nothing if any row fails",
                source_app: "Which app the file came from",
            },
            example:
                "Here's last week's meals pasted from my old app — add them all",
        },
        update_meal: {
            description:
                "Change the details of a meal you already logged — its description, any macro, fiber, sugar, alcohol or caffeine, the time, or notes. Also how a gap gets backfilled: if a meal went in without its fiber or sugar, the server says so and the AI fills it in here.",
            params: {
                id: "UUID of the meal to update",
                description: "",
                calories: "",
                protein_g: "",
                carbs_g: "",
                fat_g: "",
                fiber_g: "",
                sugar_g: "Total sugars, not added sugar",
                alcohol_g: "Grams of pure ethanol, not the volume of the drink",
                caffeine_mg: "Milligrams, not grams",
                logged_at: "",
                notes: "",
            },
            example: "Actually that lunch was 600 calories, not 500 — fix it",
        },
        delete_meal: {
            description: "Remove a meal entry you logged by mistake.",
            params: {
                id: "UUID of the meal to delete",
            },
            example: "Delete the snack I logged this afternoon",
        },
        search_meals: {
            description:
                'Search your past meals by keyword and see them grouped into your recurring variations — how often each was logged, when last, and its typical calories. This is how the AI checks a photo of your plate against how you\'ve actually logged that meal before, and how "log my usual breakfast" works.',
            params: {
                queries:
                    "Food keyword alternatives, in any language you've logged in",
                days: "How far back to look (default a year)",
                limit: "Max entries to analyze",
            },
            example: "Log my usual breakfast",
        },
        get_meals_today: {
            description: "See every meal you've logged today.",
            params: {},
            example: "What have I eaten today?",
        },
        get_meals_by_date: {
            description: "See all the meals you logged on a specific day.",
            params: {
                date: "Date in YYYY-MM-DD format",
            },
            example: "Show me everything I ate on July 4th",
        },
        get_meals_by_date_range: {
            description:
                "Pull all meals between two dates in one go — handy for reviewing a week or a month.",
            params: {
                start_date: "Start date (YYYY-MM-DD)",
                end_date: "End date (YYYY-MM-DD)",
            },
            example: "List my meals from Monday to Friday",
        },
        export_all_data: {
            description:
                "Export everything you've tracked as a single ZIP — meals.csv, water.csv, weight.csv, goals.csv, profile.csv, and a README.txt explaining the columns and units — with the same private link, valid for 60 minutes. Meals are the only part that can be imported back in for now.",
            params: {},
            example: "Export all of my data — meals, water, weight, and goals",
        },
        log_water: {
            description:
                "Log a hydration entry. Give it in any unit — cups, ounces, liters — and it's converted to millilitres for you.",
            params: {
                amount_ml: "Amount in milliliters (integer, &gt; 0).",
            },
            example: "I just drank a 500 ml bottle of water",
        },
        get_water_today: {
            description: "See today's total water intake and each entry.",
            params: {},
            example: "How much water have I had today?",
        },
        get_water_by_date: {
            description: "See your water total and entries for a specific day.",
            params: {
                date: "Date in YYYY-MM-DD format",
            },
            example: "How much did I drink yesterday?",
        },
        delete_water: {
            description: "Remove a water entry you added by mistake.",
            params: {
                id: "UUID of the water entry to delete",
            },
            example: "Remove that last water entry",
        },
        log_weight: {
            description:
                "Record a body-weight measurement in kg or lb. Multiple weigh-ins per day are fine, and the server stores it canonically so your unit preference never distorts the number.",
            params: {
                weight: "Body weight value, in `unit` (&gt; 0).",
            },
            example: "Log my weight — 74.2 kg this morning",
        },
        update_weight: {
            description:
                "Correct an existing weigh-in — the value, the timestamp, or its notes.",
            params: {
                id: "UUID of the weight entry to update",
                weight: "New weight value, in `unit`.",
                logged_at: "ISO 8601 timestamp",
                notes: "",
            },
            example: "Fix this morning's weigh-in to 73.8 kg",
        },
        delete_weight: {
            description: "Remove a weight entry.",
            params: {
                id: "UUID of the weight entry to delete",
            },
            example: "Delete today's weight entry",
        },
        get_weight_today: {
            description: "See today's weigh-ins, shown in your preferred unit.",
            params: {},
            example: "What did I weigh today?",
        },
        get_weight_by_date: {
            description: "See your weigh-ins for a specific day.",
            params: {
                date: "Date in YYYY-MM-DD format",
            },
            example: "What was my weight on the 1st?",
        },
        get_weight_by_date_range: {
            description:
                "Get every weigh-in between two dates, grouped by day with each day's average.",
            params: {
                start_date: "Start date (YYYY-MM-DD)",
                end_date: "End date (YYYY-MM-DD)",
            },
            example: "Show my weigh-ins for the last two weeks",
        },
        get_weight_trends: {
            description:
                "See your weight trend over a window: latest reading, overall change, 7/14/30-day moving averages, min/max, and progress toward your target weight.",
            params: {
                days: "Window size in days (default 30, max 365).",
            },
            example: "How's my weight trending this month?",
        },
        set_weight_unit: {
            description:
                "Choose whether weights show and are entered in kg or lb. Stored values are unaffected — only display and default parsing change.",
            params: {},
            example: "Use pounds for my weight from now on",
        },
        set_nutrition_goals: {
            description:
                "Set your daily calorie, macro, fiber, sugar, alcohol, caffeine and water goals, plus an optional target body weight. Calories, protein, carbs, fat, fiber and water are targets to reach; sugar, alcohol and caffeine are limits to stay under, and progress is worded accordingly. Update only the fields you name; the rest stay put.",
            params: {
                daily_calories: "Daily calorie target (kcal). Null to clear.",
                daily_protein_g: "Daily protein target (grams). Null to clear.",
                daily_carbs_g: "Daily carbs target (grams). Null to clear.",
                daily_fat_g: "Daily fat target (grams). Null to clear.",
                daily_fiber_g:
                    "Daily fiber target (grams), a minimum to reach. Null to clear.",
                daily_sugar_g:
                    "Daily limit for <b>total</b> sugars (grams), a maximum to stay under. Total sugars include the sugar naturally in fruit and milk, so public added-sugar guidance is a much lower number. Null to clear.",
                daily_alcohol_g:
                    "Daily alcohol limit in grams of <b>pure ethanol</b>, a maximum to stay under. One US standard drink is 14 g, one UK unit 7.9 g. Null to clear.",
                daily_caffeine_mg:
                    "Daily caffeine limit in <b>milligrams</b>, a maximum to stay under. The EFSA and FDA ceiling for healthy adults is 400 mg a day (roughly four brewed coffees), and 200 mg in pregnancy. 0 is a real limit meaning none at all. Null to clear.",
                daily_water_ml: "",
                target_weight: "",
            },
            example:
                "Set my goals to 2,200 calories, 160 g protein, and a 75 kg target weight",
        },
        get_nutrition_goals: {
            description:
                "See your current daily calorie and macro targets, any fiber target and sugar or caffeine limit, and — if you track alcohol — your alcohol limit.",
            params: {},
            example: "What are my daily targets?",
        },
        get_goal_progress: {
            description:
                "See how today's intake stacks up against your goals — intake-vs-goal rings plus body-weight progress. Tap a macro ring to see which meals contributed.",
            params: {},
            example: "How am I doing against my goals today?",
        },
        get_nutrition_summary: {
            description:
                "Get daily nutrition totals across a date range as an interactive dashboard: macro tiles vs. goals and a per-day breakdown.",
            params: {
                start_date: "Start date (YYYY-MM-DD)",
                end_date: "End date (YYYY-MM-DD)",
            },
            example: "Give me a summary of this past week",
        },
        get_trends: {
            description:
                "Rolling 7/14/30-day averages, variability, logging streaks, day-of-week breakdowns, and your best and worst days for calories and each macro — pre-computed so the AI can just narrate them.",
            params: {
                days: "Window size in days (default 30, max 365).",
            },
            example:
                "What are my calorie and macro trends over the last 30 days?",
        },
        get_meal_patterns: {
            description:
                "Surface behavioural patterns: how often you eat each meal type, the breakfast effect, high-calorie lunches, late dinners, weekday vs weekend, and outlier days.",
            params: {
                days: "Window size in days (default 30, min 7, max 365).",
            },
            example:
                "Any patterns in how I eat — like late dinners or skipping breakfast?",
        },
        get_profile: {
            description:
                "See your current settings in one go: timezone (plus local date and time), widget language, preferred weight unit, whether in-chat widgets are shown, and whether alcohol tracking is on.",
            params: {},
            example: "What are my current settings?",
        },
        set_timezone: {
            description:
                "Set your IANA timezone so days roll over at your local midnight — a meal logged at 11pm counts on that day, not the next UTC one.",
            params: {},
            example: "I'm in Berlin — set my timezone",
        },
        set_language: {
            description:
                "Set the UI language for in-chat widgets — the dashboards and charts, not what the AI writes back to you.",
            params: {
                locale: "ISO 639-1 code, e.g. <code>de</code>, <code>uk</code>. Supported: English, German, Spanish, French, Dutch, Polish, Italian, Ukrainian.",
            },
            example: "Show my widgets in German",
        },
        get_current_time: {
            description:
                'Check the date and time right now in your timezone, plus the UTC instant. Some apps don\'t tell the assistant what time it is, so this is how it works out what "this morning" or "today" means without asking you (defaults to UTC if no timezone is set).',
            params: {},
            example: "What time is it for me right now?",
        },
        set_widget_display: {
            description:
                "Turn the in-chat visual widgets on or off — the dashboards, goal rings, and trend charts. When off, the same tools reply with text and data only. Enabled by default; the change applies to new conversations.",
            params: {
                enabled: "true to show widgets, false for text-only responses",
            },
            example: "Turn off the widgets",
        },
        set_alcohol_tracking: {
            description:
                "Turn alcohol tracking on or off, and choose whether drinks are counted in US standard drinks or UK units. It's off by default, so you have to ask for it. Turning it off again hides alcohol from meals, goals and progress and stops the file importer reading a file's alcohol column — nothing already logged is deleted, your CSV export still includes it, and it reappears if you switch it back on. The change applies from your next message, with nothing to restart.",
            params: {
                enabled:
                    "true to show alcohol in meals, goals and progress, false to hide it",
                drink_unit:
                    "Which standard drink to show alongside the grams: <code>us</code> (14 g per drink) or <code>uk</code> (7.9 g per unit). Defaults to <code>us</code>; grams of pure ethanol are what's actually stored.",
            },
            example: "Start tracking my drinking, in UK units",
        },
        list_members: {
            description:
                "List household members as user_id, display_name, and role. A household bot token and any household member may call this. Person tools on a household token require user_id set to one of these ids.",
            params: {},
            example: "Who is in this household?",
        },
        add_household_member: {
            description:
                "Add a household member as a real Auth user. Pass display_name, password, and either email or username. A username becomes {username}@household.invalid. The new row is always member, not owner. Returns the new user_id so the household bot can log for them. Does not send invite email. Uses the same SUPABASE_SECRET_KEY the server already needs.",
            params: {
                display_name: "Name stored on household_members",
                password: "At least 8 characters",
                email: "Real email login. Use this or username, not both.",
                username:
                    "Login stored as <code>{username}@household.invalid</code>. Use this or email, not both.",
            },
            example: "Add Sam as username sam with password password1",
        },
        rotate_household_token: {
            description:
                "Issue a new household bot token. The plaintext is shown once; only a SHA-256 hash is stored. Any household member may rotate. A household PAT may rotate and then stops working.",
            params: {},
            example: "Rotate the household bot token",
        },
        get_household_config: {
            description:
                "Read the household name, fridge locations, recipe search places, and shared preferences. A household bot token and any household member may call this. Writes are household-scoped, not a person user_id.",
            params: {},
            example: "What's in our household config?",
        },
        update_household_config: {
            description:
                "Merge the household name, fridge locations, recipe search places, or shared preferences. Places are labels only, not a recipe table. A household bot token and any household member may call this.",
            params: {
                name: "New household name",
                fridge_locations:
                    "Replacement list of fridge and freezer names",
                recipe_search_places:
                    "Replacement list of places, each with a name and kind <code>grocery</code>, <code>recipe_site</code>, <code>meal_kit</code>, or <code>other</code>",
                preferences:
                    "Shared constraints, budget, and shopping cadence. Omitted fields stay as they are.",
            },
            example: "Add Costco as a grocery search place",
        },
        update_fridge_locations: {
            description:
                "Replace the household fridge and freezer location list. A household bot token and any household member may call this.",
            params: {
                locations: "The full list of location names to keep",
            },
            example: "Set fridge locations to fridge and garage freezer",
        },
        delete_account: {
            description:
                "Permanently delete your account and all associated data. This is irreversible — the AI always confirms with you first.",
            params: {},
            example: "Delete my account and all my data",
        },
    },
};

const USER_ID_PARAM_COPY: Record<SiteLocale, string> = {
    en: "Household member to act as. Required on a household bot token. If set on a personal login, it must equal you.",
    de: "Haushaltsmitglied, als das gehandelt wird. Pflicht auf einem Household-Bot-Token. Bei einem persönlichen Login muss es, wenn gesetzt, du selbst sein.",
    es: "Miembro del hogar como el que se actúa. Obligatorio con un token de bot del hogar. En un inicio de sesión personal, si se indica, tiene que ser tú.",
    fr: "Membre du foyer pour lequel agir. Obligatoire avec un jeton bot du foyer. Sur une connexion personnelle, s'il est fourni, il doit être toi.",
    nl: "Huishoudlid om als te handelen. Verplicht op een household-bottoken. Bij een persoonlijke login moet het, als het gezet is, jijzelf zijn.",
    pl: "Członek gospodarstwa, w którego imieniu działać. Wymagane na tokenie bota gospodarstwa. Przy osobistym logowaniu, jeśli podane, musi być tobą.",
    it: "Membro della famiglia per cui agire. Obbligatorio con un token bot della famiglia. Su un accesso personale, se impostato, deve essere tu.",
    uk: "Член домогосподарства, від імені якого діяти. Обов'язково на токені бота домогосподарства. У особистому вході, якщо вказано, має бути ти.",
    ja: "操作対象の世帯メンバー。世帯ボットトークンでは必須。個人ログインで指定する場合は自分自身である必要があります。",
};

function withUserIdCopy(locale: SiteLocale, doc: ToolsDoc): ToolsDoc {
    const skip = new Set<string>([
        ...HOUSEHOLD_SCOPED_TOOL_NAMES,
        ...OAUTH_ONLY_TOOL_NAMES,
    ]);
    const tools: ToolsDoc["tools"] = {};
    for (const [name, prose] of Object.entries(doc.tools)) {
        if (skip.has(name) || prose.params.user_id) {
            tools[name] = prose;
            continue;
        }
        tools[name] = {
            ...prose,
            params: { ...prose.params, user_id: USER_ID_PARAM_COPY[locale] },
        };
    }
    return { ...doc, tools };
}

export const TOOLS_COPY: Partial<Record<SiteLocale, ToolsDoc>> = {
    en: withUserIdCopy("en", TOOLS_EN),
    de: withUserIdCopy("de", TOOLS_DE),
    es: withUserIdCopy("es", TOOLS_ES),
    fr: withUserIdCopy("fr", TOOLS_FR),
    nl: withUserIdCopy("nl", TOOLS_NL),
    pl: withUserIdCopy("pl", TOOLS_PL),
    it: withUserIdCopy("it", TOOLS_IT),
    uk: withUserIdCopy("uk", TOOLS_UK),
    ja: withUserIdCopy("ja", TOOLS_JA),
};

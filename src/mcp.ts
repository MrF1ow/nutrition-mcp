// Temporary barrel so existing from "./mcp.js" imports keep working.
export {
    handleMcp,
    closeMcpHandler,
    registerTools,
    type McpEraTrace,
} from "./mcp/server.js";
export {
    formatGoalLine,
    formatProgress,
    formatGoals,
    formatMeal,
    sumMeals,
    mealBreakdown,
    goalsPayloadOf,
    totalsPayloadOf,
    trendsDayPayloadOf,
    hasActiveTarget,
    nutrientPresence,
    rangeAverages,
    loggedDayAverageNote,
    alcoholHiddenNote,
    missingNutrientNote,
    gateAlcohol,
    GOALS_ITEM,
    TOTALS_ITEM,
    TRENDS_DAY_ITEM,
    MEAL_BREAKDOWN_ITEM,
    MAX_CALORIES,
    MAX_MACRO_G,
    MAX_ALCOHOL_G,
    MAX_CAFFEINE_MG,
    MAX_GOAL_G,
    MAX_GOAL_MG,
} from "./mcp/shared.js";
export {
    startImportPayload,
    START_IMPORT_OUTPUT_SCHEMA,
} from "./mcp/tools/nutrition.js";

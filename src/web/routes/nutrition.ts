import { Hono } from "hono";
import {
    logMealFromForm,
    logWaterFromForm,
    logWeightFromForm,
    withNutritionError,
} from "../../app/nutrition.js";
import { renderDashboardPage } from "../dashboard.js";
import { formText } from "../form.js";
import { requireMember, requireSiteUser } from "../middleware.js";
import { insertMeal, insertWater, insertWeight } from "../../db/nutrition.js";

export const nutritionRoutes = new Hono();

async function nutritionFormError(userId: string, error: string) {
    const page = await renderDashboardPage(userId, undefined);
    return {
        html: withNutritionError(page.html, error),
        status: 400 as const,
    };
}

nutritionRoutes.get("/", requireSiteUser, async (c) => {
    const page = await renderDashboardPage(
        c.get("userId"),
        c.req.query("member"),
    );
    return c.html(page.html, page.status);
});

nutritionRoutes.post("/log-meal", requireMember, async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const result = await logMealFromForm(
        userId,
        { description: formText(body, "description") },
        insertMeal,
    );
    if (!result.ok) {
        const page = await nutritionFormError(userId, result.error);
        return c.html(page.html, page.status);
    }
    return c.redirect("/");
});

nutritionRoutes.post("/log-water", requireMember, async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const result = await logWaterFromForm(
        userId,
        { amount_ml: formText(body, "amount_ml") },
        insertWater,
    );
    if (!result.ok) {
        const page = await nutritionFormError(userId, result.error);
        return c.html(page.html, page.status);
    }
    return c.redirect("/");
});

nutritionRoutes.post("/log-weight", requireMember, async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const result = await logWeightFromForm(
        userId,
        {
            weight: formText(body, "weight"),
            unit: formText(body, "unit"),
        },
        insertWeight,
    );
    if (!result.ok) {
        const page = await nutritionFormError(userId, result.error);
        return c.html(page.html, page.status);
    }
    return c.redirect("/");
});

nutritionRoutes.get("/nutrition", requireSiteUser, async (c) => {
    return c.redirect("/");
});

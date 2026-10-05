import { Hono } from "hono";
import { groceryAllergenMembers, renderGroceryListPage } from "../dashboard.js";
import { formAmount, formText } from "../form.js";
import {
    requireMember,
    requireOwner,
    requireSiteUser,
    siteMember,
} from "../middleware.js";
import { fridgeBarcodeLookup } from "./fridge.js";
import { normalizeBarcode } from "../../foods.js";
import {
    addGroceryFoodByBarcode,
    addGroceryFoodById,
    addGroceryManualFood,
    addGrocerySupply,
    checkGroceryLine,
    clearCheckedLines,
    groceryAllergenWarning,
    GroceryInputError,
} from "../../domain/grocery.js";
import { createGroceryStore } from "../../domain/settings.js";
import { liveGroceryStore } from "../../db/grocery.js";
import { liveFoodsStore } from "../../db/foods.js";
import { liveSettingsStore } from "../../db/settings.js";
import { findFoodById } from "../../domain/foods.js";

export const groceryRoutes = new Hono();

async function groceryFormError(userId: string, err: unknown) {
    const message =
        err instanceof GroceryInputError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update the grocery list.";
    const page = await renderGroceryListPage(userId, {
        error: message,
    });
    return { html: page.html, status: 400 as const };
}

groceryRoutes.get("/grocery", requireSiteUser, async (c) => {
    const page = await renderGroceryListPage(c.get("userId"));
    return c.html(page.html, page.status);
});

groceryRoutes.post("/grocery/stores", requireOwner, async (c) => {
    const userId = c.get("userId");
    const owner = siteMember(c);
    const body = await c.req.parseBody();
    try {
        await createGroceryStore(
            liveSettingsStore(),
            owner.householdId,
            formText(body, "name"),
        );
    } catch (err) {
        const page = await groceryFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/grocery");
});

groceryRoutes.post("/grocery/lines", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const body = await c.req.parseBody();
    const storeId = formText(body, "store_id");
    const sectionId = formText(body, "section_id") || undefined;
    const amount = formAmount(body, "qty_amount");
    const grocery = liveGroceryStore();
    const settings = liveSettingsStore();
    const foods = liveFoodsStore();
    const confirmed = formText(body, "confirm_allergen") === "1";
    try {
        const kind = formText(body, "kind");
        if (kind === "supply") {
            await addGrocerySupply(grocery, settings, foods, {
                householdId: member.householdId,
                storeId,
                sectionId,
                name: formText(body, "name"),
                amount,
                unit: formText(body, "qty_unit"),
                foodId: formText(body, "food_id") || undefined,
            });
        } else {
            const members = await groceryAllergenMembers(member.householdId);
            const foodId = formText(body, "food_id");
            let previewName = formText(body, "food_name");
            let catalogAllergens: string[] | null = null;
            if (foodId) {
                const food = await findFoodById(
                    foods,
                    member.householdId,
                    foodId,
                );
                previewName = food.name;
                catalogAllergens = food.allergens;
            } else if (formText(body, "barcode")) {
                previewName =
                    (
                        await fridgeBarcodeLookup(
                            normalizeBarcode(formText(body, "barcode")) ??
                                formText(body, "barcode"),
                        )
                    )?.name ?? previewName;
            }
            const warning = groceryAllergenWarning(
                previewName,
                members,
                catalogAllergens,
            );
            if (warning?.blocking && !confirmed) {
                const page = await renderGroceryListPage(userId, {
                    allergenWarning: warning.text,
                });
                return c.html(page.html, 400);
            }
            if (foodId) {
                await addGroceryFoodById(grocery, settings, foods, {
                    householdId: member.householdId,
                    storeId,
                    sectionId,
                    foodId,
                    amount,
                });
            } else if (formText(body, "barcode")) {
                await addGroceryFoodByBarcode(
                    grocery,
                    settings,
                    foods,
                    {
                        householdId: member.householdId,
                        storeId,
                        sectionId,
                        barcode: formText(body, "barcode"),
                        amount,
                    },
                    { lookup: fridgeBarcodeLookup },
                );
            } else {
                await addGroceryManualFood(grocery, settings, foods, {
                    householdId: member.householdId,
                    storeId,
                    sectionId,
                    name: formText(body, "food_name"),
                    amount,
                });
            }
        }
    } catch (err) {
        const page = await groceryFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/grocery");
});

groceryRoutes.post("/grocery/lines/:id/check", requireMember, async (c) => {
    const member = siteMember(c);
    const body = await c.req.parseBody();
    const checked = formText(body, "checked") !== "0";
    await checkGroceryLine(
        liveGroceryStore(),
        member.householdId,
        c.req.param("id"),
        checked,
    );
    return c.redirect("/grocery");
});

groceryRoutes.post("/grocery/clear-checked", requireMember, async (c) => {
    const member = siteMember(c);
    await clearCheckedLines(liveGroceryStore(), member.householdId);
    return c.redirect("/grocery");
});

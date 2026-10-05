import { Hono } from "hono";
import { PICKER_DEMO_FOODS } from "../components/food-picker.js";
import { renderFridgeInventoryPage } from "../dashboard.js";
import { formAmount, formText } from "../form.js";
import { requireMember, requireSiteUser, siteMember } from "../middleware.js";
import { lookupBarcode, type FoodResult } from "../../foods.js";
import {
    addFoodByBarcode,
    addLocation,
    addManualFood,
    addSupply,
    deleteItem,
    deleteLocation,
    FridgeInputError,
    moveItem,
    updateItemQuantity,
} from "../../domain/fridge.js";
import { liveFridgeStore } from "../../db/fridge.js";

export const fridgeRoutes = new Hono();

function demoFridgeFood(barcode: string): FoodResult | null {
    const demo = PICKER_DEMO_FOODS.find((food) => food.barcode === barcode);
    if (!demo) return null;
    return {
        name: demo.name,
        brand: demo.brand,
        serving: null,
        calories: 98,
        protein_g: 11,
        carbs_g: 3.4,
        fat_g: 4.3,
        fiber_g: 0,
        sugar_g: 3.2,
        alcohol_g: null,
        nutriscore_grade: null,
        nova_group: null,
        source: `off:${demo.barcode}`,
        source_name: "openfoodfacts",
        barcode: demo.barcode,
    };
}

export async function fridgeBarcodeLookup(
    barcode: string,
): Promise<FoodResult | null> {
    const demo = demoFridgeFood(barcode);
    if (demo) return demo;
    try {
        return await lookupBarcode(barcode);
    } catch {
        return null;
    }
}

async function fridgeFormError(userId: string, err: unknown) {
    const message =
        err instanceof FridgeInputError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update the fridge.";
    const page = await renderFridgeInventoryPage(userId, message);
    return { html: page.html, status: 400 as const };
}

fridgeRoutes.get("/fridge", requireSiteUser, async (c) => {
    const page = await renderFridgeInventoryPage(c.get("userId"));
    return c.html(page.html, page.status);
});

fridgeRoutes.post("/fridge/locations", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const body = await c.req.parseBody();
    try {
        await addLocation(
            liveFridgeStore(),
            member.householdId,
            formText(body, "name"),
        );
    } catch (err) {
        const page = await fridgeFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/fridge");
});

fridgeRoutes.post("/fridge/locations/:id/delete", requireMember, async (c) => {
    const member = siteMember(c);
    await deleteLocation(
        liveFridgeStore(),
        member.householdId,
        c.req.param("id"),
    );
    return c.redirect("/fridge");
});

fridgeRoutes.post("/fridge/items", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const body = await c.req.parseBody();
    const store = liveFridgeStore();
    const locationId = formText(body, "location_id");
    const kind = formText(body, "kind");
    const amount = formAmount(body, "qty_amount");
    try {
        if (kind === "supply") {
            await addSupply(store, {
                householdId: member.householdId,
                locationId,
                name: formText(body, "name"),
                amount,
                unit: formText(body, "qty_unit"),
            });
        } else if (formText(body, "barcode")) {
            await addFoodByBarcode(
                store,
                {
                    householdId: member.householdId,
                    locationId,
                    barcode: formText(body, "barcode"),
                    amount,
                },
                { lookup: fridgeBarcodeLookup },
            );
        } else {
            await addManualFood(store, {
                householdId: member.householdId,
                locationId,
                name: formText(body, "food_name"),
                amount,
            });
        }
    } catch (err) {
        const page = await fridgeFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/fridge");
});

fridgeRoutes.post("/fridge/items/:id/delete", requireMember, async (c) => {
    const member = siteMember(c);
    await deleteItem(liveFridgeStore(), member.householdId, c.req.param("id"));
    return c.redirect("/fridge");
});

fridgeRoutes.post("/fridge/items/:id", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const body = await c.req.parseBody();
    const store = liveFridgeStore();
    const itemId = c.req.param("id");
    try {
        await updateItemQuantity(store, member.householdId, itemId, {
            amount: formAmount(body, "qty_amount"),
            unit: formText(body, "qty_unit"),
        });
        const locationId = formText(body, "location_id");
        if (locationId) {
            await moveItem(store, member.householdId, itemId, locationId);
        }
    } catch (err) {
        const page = await fridgeFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/fridge");
});

import { Hono } from "hono";
import { parseAppearanceInput } from "../../app/shell.js";
import { parseNutritionPrefsInput } from "../pages/settings.js";
import {
    createHouseholdFormHtml,
    forbiddenDashboardHtml,
    renderHouseholdSettingsRoute,
    renderSettingsAccountPage,
} from "../dashboard.js";
import { formText } from "../form.js";
import {
    requireMember,
    requireOwner,
    requireSiteUser,
    siteMember,
} from "../middleware.js";
import {
    HouseholdAlreadyExistsError,
    parseMemberInput,
} from "../../household.js";
import {
    generateHouseholdToken,
    hashHouseholdToken,
    householdTokenHashHex,
} from "../../household-token.js";
import {
    addAllergen,
    addDislike,
    addPersonRule,
    addStoreRule,
    RulesInputError,
} from "../../rules.js";
import {
    createGroceryStore,
    renameSection,
    setHouseholdLocation,
    SettingsInputError,
} from "../../settings.js";
import {
    addHouseholdMemberForHousehold,
    createHouseholdForCaller,
    getHouseholdConfig,
    rotateHouseholdMcpToken,
    updateHouseholdConfig,
    updateMemberDisplayName,
    upsertProfile,
    liveRulesStore,
    liveSettingsStore,
} from "../../supabase.js";
import { validateTz } from "../../tz.js";

export const settingsRoutes = new Hono();

async function householdFormError(userId: string, err: unknown) {
    const message =
        err instanceof SettingsInputError || err instanceof RulesInputError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update household settings.";
    const page = await renderHouseholdSettingsRoute(userId, { error: message });
    return { html: page.html, status: 400 as const };
}

settingsRoutes.get("/settings", requireSiteUser, async (c) => {
    const page = await renderSettingsAccountPage(c.get("userId"));
    return c.html(page.html, page.status);
});

settingsRoutes.get("/settings/household", requireSiteUser, async (c) => {
    const page = await renderHouseholdSettingsRoute(c.get("userId"));
    return c.html(page.html, page.status);
});

settingsRoutes.post("/settings", requireMember, async (c) => {
    const userId = c.get("userId");
    const member = siteMember(c);
    const body = await c.req.parseBody();
    const group = formText(body, "group");
    if (group === "nutrition") {
        const prefs = parseNutritionPrefsInput({
            timezone: body.timezone,
            preferred_weight_unit: body.preferred_weight_unit,
            widgets_enabled: formText(body, "widgets_enabled") === "true",
            alcohol_tracking_enabled:
                formText(body, "alcohol_tracking_enabled") === "true",
            preferred_drink_unit: body.preferred_drink_unit,
        });
        if (prefs.timezone) {
            if (!validateTz(prefs.timezone)) {
                const page = await renderSettingsAccountPage(
                    userId,
                    "Enter a valid IANA timezone.",
                );
                return c.html(page.html, 400);
            }
        } else {
            delete prefs.timezone;
        }
        await upsertProfile(userId, prefs);
        return c.redirect("/settings");
    }
    const appearance = parseAppearanceInput({
        theme: body.theme,
        accent_swatch: body.accent_swatch,
    });
    await upsertProfile(userId, appearance);
    const displayName = formText(body, "display_name").trim();
    if (displayName) {
        await updateMemberDisplayName(member.householdId, userId, displayName);
    }
    return c.redirect("/settings");
});

settingsRoutes.post("/create-household", requireSiteUser, async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const name = String(body.household_name ?? "").trim();
    const displayName = String(body.display_name ?? "").trim();
    if (!name || !displayName) {
        return c.html(
            createHouseholdFormHtml("Enter a household name and your name."),
            400,
        );
    }
    try {
        await createHouseholdForCaller(userId, name, displayName);
    } catch (err) {
        if (err instanceof HouseholdAlreadyExistsError) {
            return c.html(forbiddenDashboardHtml(), 403);
        }
        const message =
            err instanceof Error
                ? err.message
                : "Could not create the household.";
        return c.html(createHouseholdFormHtml(message), 400);
    }
    return c.redirect("/");
});

settingsRoutes.post("/settings/household", requireOwner, async (c) => {
    const userId = c.get("userId");
    const owner = siteMember(c);
    const body = await c.req.parseBody();
    const parsed = parseMemberInput({
        display_name: String(body.display_name ?? ""),
        password: String(body.password ?? ""),
        email: String(body.email ?? ""),
        username: String(body.username ?? ""),
    });
    if (!parsed.ok) {
        const page = await renderHouseholdSettingsRoute(userId, {
            error: parsed.error,
        });
        return c.html(page.html, 400);
    }
    const added = await addHouseholdMemberForHousehold(
        owner.householdId,
        parsed.value,
    );
    if (!added.ok) {
        const page = await renderHouseholdSettingsRoute(userId, {
            error: added.error,
        });
        return c.html(page.html, 400);
    }
    return c.redirect("/settings/household");
});

settingsRoutes.post("/settings/household/name", requireOwner, async (c) => {
    const userId = c.get("userId");
    const owner = siteMember(c);
    const body = await c.req.parseBody();
    const name = formText(body, "name").trim();
    if (!name) {
        const page = await renderHouseholdSettingsRoute(userId, {
            error: "Enter a household name.",
        });
        return c.html(page.html, 400);
    }
    const config = await getHouseholdConfig(owner.householdId);
    await updateHouseholdConfig(owner.householdId, { ...config, name });
    return c.redirect("/settings/household");
});

settingsRoutes.post("/settings/household/location", requireOwner, async (c) => {
    const owner = siteMember(c);
    const body = await c.req.parseBody();
    await setHouseholdLocation(
        liveSettingsStore(),
        owner.householdId,
        formText(body, "location"),
    );
    return c.redirect("/settings/household");
});

settingsRoutes.post(
    "/settings/household/rotate-token",
    requireOwner,
    async (c) => {
        const userId = c.get("userId");
        const owner = siteMember(c);
        const token = generateHouseholdToken();
        await rotateHouseholdMcpToken({
            householdId: owner.householdId,
            tokenHashHex: householdTokenHashHex(hashHouseholdToken(token)),
            issuedBy: owner.userId,
        });
        const page = await renderHouseholdSettingsRoute(userId, {
            issuedToken: token,
        });
        return c.html(page.html, 200);
    },
);

settingsRoutes.post("/settings/household/stores", requireOwner, async (c) => {
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
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

settingsRoutes.post(
    "/settings/household/sections/:id",
    requireOwner,
    async (c) => {
        const userId = c.get("userId");
        const owner = siteMember(c);
        const body = await c.req.parseBody();
        try {
            await renameSection(
                liveSettingsStore(),
                owner.householdId,
                c.req.param("id"),
                formText(body, "name"),
            );
        } catch (err) {
            const page = await householdFormError(userId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect("/settings/household");
    },
);

settingsRoutes.post(
    "/settings/household/stores/:id/rules",
    requireOwner,
    async (c) => {
        const userId = c.get("userId");
        const owner = siteMember(c);
        const body = await c.req.parseBody();
        try {
            await addStoreRule(liveRulesStore(), {
                householdId: owner.householdId,
                storeId: c.req.param("id"),
                body: formText(body, "body"),
            });
        } catch (err) {
            const page = await householdFormError(userId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect("/settings/household");
    },
);

settingsRoutes.post(
    "/settings/household/members/:userId/allergens",
    requireOwner,
    async (c) => {
        const userId = c.get("userId");
        const owner = siteMember(c);
        const body = await c.req.parseBody();
        try {
            await addAllergen(liveRulesStore(), {
                householdId: owner.householdId,
                userId: c.req.param("userId"),
                allergen: formText(body, "allergen"),
                otherLabel: formText(body, "other_label"),
            });
        } catch (err) {
            const page = await householdFormError(userId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect("/settings/household");
    },
);

settingsRoutes.post(
    "/settings/household/members/:userId/dislikes",
    requireOwner,
    async (c) => {
        const userId = c.get("userId");
        const owner = siteMember(c);
        const body = await c.req.parseBody();
        try {
            await addDislike(liveRulesStore(), {
                householdId: owner.householdId,
                userId: c.req.param("userId"),
                displayName: formText(body, "display_name"),
            });
        } catch (err) {
            const page = await householdFormError(userId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect("/settings/household");
    },
);

settingsRoutes.post(
    "/settings/household/members/:userId/rules",
    requireOwner,
    async (c) => {
        const userId = c.get("userId");
        const owner = siteMember(c);
        const body = await c.req.parseBody();
        try {
            await addPersonRule(liveRulesStore(), {
                householdId: owner.householdId,
                userId: c.req.param("userId"),
                body: formText(body, "body"),
            });
        } catch (err) {
            const page = await householdFormError(userId, err);
            return c.html(page.html, page.status);
        }
        return c.redirect("/settings/household");
    },
);

import { dashboardAccess, type HouseholdMember } from "./household.js";
import {
    getGoalProgressPayload,
    getNutritionSummaryPayload,
    getTrendsPayload,
    getWeightTrendsPayload,
    type AlcoholDisplay,
} from "./dashboard-data.js";
import {
    alcoholTrackingEnabledFromProfile,
    getHouseholdConfig,
    getHouseholdMembership,
    getProfile,
    householdExists,
    listHouseholdMembers,
    liveFridgeStore,
    liveGroceryStore,
    liveRecipesStore,
    liveRulesStore,
    liveSettingsStore,
    localeFromProfile,
    preferredDrinkUnitFromProfile,
    preferredWeightUnitFromProfile,
    widgetsEnabledFromProfile,
} from "./supabase.js";
import { renderFridgePage } from "./app/fridge/page.js";
import { renderGroceryPage } from "./app/grocery/page.js";
import {
    renderRecipeDetailPage,
    renderRecipesPage,
} from "./app/recipes/page.js";
import { renderSettingsPage } from "./app/settings/page.js";
import { renderHouseholdSettingsPage } from "./app/settings/household.js";
import { listFridge } from "./fridge.js";
import { groceryAllergenWarning, listGrocery } from "./grocery.js";
import { alreadyHaveTag } from "./linking.js";
import {
    getRecipeView,
    listRecipes,
    macrosForPerson,
    RecipeInputError,
    recipeDislikeNote,
} from "./recipes.js";
import {
    renderNutritionPage,
    viewerChromeFromProfile,
    type NutritionView,
} from "./app/nutrition.js";
import { isAccentSwatch, escapeHtml } from "./app/shell.js";

function alcoholOf(
    profile: Parameters<typeof alcoholTrackingEnabledFromProfile>[0],
): AlcoholDisplay {
    if (!alcoholTrackingEnabledFromProfile(profile)) return null;
    return preferredDrinkUnitFromProfile(profile) ?? "us";
}

export type DashboardView = NutritionView;

export function forbiddenDashboardHtml(): string {
    return renderBare(
        "Household",
        '<p class="empty">You need a household membership to view this dashboard.</p>',
    );
}

function formErrorHtml(error?: string): string {
    return error ? `<div class="error-banner">${escapeHtml(error)}</div>` : "";
}

export function createHouseholdFormHtml(error?: string): string {
    return renderBare(
        "Create household",
        `<header class="dash-head">
            <p class="eyebrow">Household</p>
            <h1>Create household</h1>
            <p class="logout"><a href="/logout">Log out</a></p>
        </header>
        <form method="POST" action="/create-household" class="create-household">
            ${formErrorHtml(error)}
            <label for="household_name">Household name</label>
            <input id="household_name" name="household_name" required maxlength="80" />
            <label for="display_name">Your name</label>
            <input id="display_name" name="display_name" required maxlength="80" />
            <button type="submit">Create household</button>
        </form>`,
    );
}

export async function renderDashboardHtml(
    view: DashboardView,
): Promise<string> {
    return renderNutritionPage(view);
}

type MemberGate =
    | { status: 200; viewer: HouseholdMember }
    | { status: 403; html: string }
    | { status: 200; html: string; create: true };

async function memberGate(viewerUserId: string): Promise<MemberGate> {
    const viewer = await getHouseholdMembership(viewerUserId);
    if (viewer == null) {
        if (!(await householdExists())) {
            return {
                status: 200,
                html: createHouseholdFormHtml(),
                create: true,
            };
        }
        return { status: 403, html: forbiddenDashboardHtml() };
    }
    return { status: 200, viewer };
}

export async function renderDashboardPage(
    viewerUserId: string,
    requestedMember: string | undefined,
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };

    let subject = gate.viewer;
    if (requestedMember && requestedMember !== viewerUserId) {
        const requested = await getHouseholdMembership(requestedMember);
        if (requested == null) {
            return { status: 403, html: forbiddenDashboardHtml() };
        }
        subject = requested;
    }
    const access = dashboardAccess(gate.viewer, subject);
    if (!access.ok) {
        return { status: 403, html: forbiddenDashboardHtml() };
    }

    const viewerProfile = await getProfile(access.viewer.userId);
    const subjectProfile =
        access.subject.userId === access.viewer.userId
            ? viewerProfile
            : await getProfile(access.subject.userId);
    const alcohol = alcoholOf(subjectProfile);
    const members = await listHouseholdMembers(access.viewer.householdId);

    const [summary, goals, trends, weight] = await Promise.all([
        getNutritionSummaryPayload(access.subject.userId, alcohol, 7),
        getGoalProgressPayload(access.subject.userId, alcohol),
        getTrendsPayload(access.subject.userId, alcohol),
        getWeightTrendsPayload(access.subject.userId),
    ]);

    return {
        status: 200,
        html: await renderDashboardHtml({
            access,
            members,
            summary,
            goals,
            trends,
            weight,
            chrome: viewerChromeFromProfile(viewerProfile),
        }),
    };
}

export async function renderFridgeInventoryPage(
    viewerUserId: string,
    error?: string,
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const profile = await getProfile(viewerUserId);
    const snapshot = await listFridge(
        liveFridgeStore(),
        gate.viewer.householdId,
    );
    return {
        status: 200,
        html: renderFridgePage({
            ...snapshot,
            chrome: viewerChromeFromProfile(profile),
            error,
        }),
    };
}

export async function renderGroceryListPage(
    viewerUserId: string,
    opts: { error?: string; allergenWarning?: string } = {},
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const householdId = gate.viewer.householdId;
    const profile = await getProfile(viewerUserId);
    const [snapshot, fridge, members] = await Promise.all([
        listGrocery(liveGroceryStore(), liveSettingsStore(), householdId),
        listFridge(liveFridgeStore(), householdId),
        listHouseholdMembers(householdId),
    ]);
    const rules = liveRulesStore();
    const memberAllergens = await Promise.all(
        members.map(async (member) => ({
            displayName: member.displayName,
            allergens: await rules.listAllergens(householdId, member.userId),
        })),
    );
    const storeRules = await Promise.all(
        snapshot.stores.map(async (store) => ({
            storeId: store.id,
            rules: await rules.listStoreRules(store.id),
        })),
    );
    const rulesByStore = new Map(
        storeRules.map((row) => [row.storeId, row.rules]),
    );
    const stores = snapshot.stores.map((store) => {
        const storeLines = snapshot.lines.filter(
            (line) => line.storeId === store.id,
        );
        const sections = snapshot.sections
            .filter(
                (section) =>
                    section.storeId === store.id &&
                    (!section.hidden ||
                        storeLines.some(
                            (line) => line.sectionId === section.id,
                        )),
            )
            .map((section) => ({
                ...section,
                lines: storeLines
                    .filter((line) => line.sectionId === section.id)
                    .map((line) => ({
                        ...line,
                        alreadyHave: alreadyHaveTag(line, fridge.items),
                    })),
            }));
        return {
            ...store,
            sections,
            rules: rulesByStore.get(store.id) ?? [],
        };
    });
    const unknownAllergen = memberAllergens.some(
        (row) => row.allergens.length > 0,
    );
    return {
        status: 200,
        html: renderGroceryPage({
            chrome: viewerChromeFromProfile(profile),
            stores,
            error: opts.error,
            allergenWarning: opts.allergenWarning,
            unknownAllergen: unknownAllergen && !opts.allergenWarning,
        }),
    };
}

export async function groceryAllergenMembers(householdId: string) {
    const members = await listHouseholdMembers(householdId);
    const rules = liveRulesStore();
    return Promise.all(
        members.map(async (member) => ({
            displayName: member.displayName,
            allergens: await rules.listAllergens(householdId, member.userId),
        })),
    );
}

export async function renderSettingsAccountPage(
    viewerUserId: string,
    error?: string,
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const profile = await getProfile(viewerUserId);
    const chrome = viewerChromeFromProfile(profile);
    const swatch = isAccentSwatch(profile?.accent_swatch)
        ? profile.accent_swatch
        : null;
    return {
        status: 200,
        html: renderSettingsPage({
            chrome,
            selectedSwatch: swatch,
            displayName: gate.viewer.displayName,
            timezone: profile?.timezone ?? "",
            locale: localeFromProfile(profile) ?? "en",
            weightUnit: preferredWeightUnitFromProfile(profile) ?? "",
            widgetsEnabled: widgetsEnabledFromProfile(profile),
            alcoholTrackingEnabled: alcoholTrackingEnabledFromProfile(profile),
            drinkUnit: preferredDrinkUnitFromProfile(profile) ?? "",
            error,
        }),
    };
}

export async function renderHouseholdSettingsRoute(
    viewerUserId: string,
    opts: { error?: string; issuedToken?: string } = {},
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const profile = await getProfile(viewerUserId);
    const householdId = gate.viewer.householdId;
    const [config, members, location, stores] = await Promise.all([
        getHouseholdConfig(householdId),
        listHouseholdMembers(householdId),
        liveSettingsStore().getLocation(householdId),
        liveSettingsStore().listStores(householdId),
    ]);
    const settings = liveSettingsStore();
    const rules = liveRulesStore();
    const storeViews = await Promise.all(
        stores.map(async (store) => ({
            ...store,
            sections: await settings.listSections(store.id),
            rules: await rules.listStoreRules(store.id),
        })),
    );
    const memberRules = await Promise.all(
        members.map(async (member) => ({
            member,
            rules: await rules.listPersonRules(householdId, member.userId),
            allergens: await rules.listAllergens(householdId, member.userId),
            dislikes: await rules.listDislikes(householdId, member.userId),
        })),
    );
    return {
        status: 200,
        html: renderHouseholdSettingsPage({
            chrome: viewerChromeFromProfile(profile),
            householdName: config.name,
            location: location ?? "",
            members,
            stores: storeViews,
            memberRules,
            isOwner: gate.viewer.role === "owner",
            error: opts.error,
            issuedToken: opts.issuedToken,
        }),
    };
}

export async function renderRecipesListPage(
    viewerUserId: string,
    error?: string,
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const profile = await getProfile(viewerUserId);
    const [recipes, members] = await Promise.all([
        listRecipes(liveRecipesStore(), gate.viewer.householdId),
        listHouseholdMembers(gate.viewer.householdId),
    ]);
    return {
        status: 200,
        html: renderRecipesPage({
            chrome: viewerChromeFromProfile(profile),
            recipes,
            members: members.map((member) => ({
                userId: member.userId,
                displayName: member.displayName,
            })),
            viewerId: viewerUserId,
            error,
        }),
    };
}

export async function renderRecipeDetailRoute(
    viewerUserId: string,
    recipeId: string,
    opts: { member?: string; error?: string } = {},
): Promise<{ status: 200 | 403 | 404; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const householdId = gate.viewer.householdId;
    const profile = await getProfile(viewerUserId);
    const members = await listHouseholdMembers(householdId);
    const filterUserId =
        opts.member && members.some((member) => member.userId === opts.member)
            ? opts.member
            : viewerUserId;
    let view;
    try {
        view = await getRecipeView(
            liveRecipesStore(),
            householdId,
            recipeId,
            filterUserId,
        );
    } catch (err) {
        if (err instanceof RecipeInputError) {
            const page = await renderRecipesListPage(viewerUserId, err.message);
            return { status: 404, html: page.html };
        }
        throw err;
    }
    const macros = macrosForPerson(
        view.ingredients,
        view.yieldPortions,
        view.portionCount,
    );
    const rules = liveRulesStore();
    const person = members.find((member) => member.userId === filterUserId);
    const [allergens, dislikes, stores] = await Promise.all([
        rules.listAllergens(householdId, filterUserId),
        rules.listDislikes(householdId, filterUserId),
        liveSettingsStore().listStores(householdId),
    ]);
    const warning = groceryAllergenWarning(
        view.ingredients.map((row) => row.displayName).join(" "),
        person ? [{ displayName: person.displayName, allergens }] : [],
    );
    return {
        status: 200,
        html: renderRecipeDetailPage({
            chrome: viewerChromeFromProfile(profile),
            recipe: view,
            ingredients: view.ingredients,
            members: members.map((member) => ({
                userId: member.userId,
                displayName: member.displayName,
            })),
            stores: stores.map((store) => ({
                id: store.id,
                name: store.name,
            })),
            viewerId: viewerUserId,
            filterUserId,
            portionCount: view.portionCount,
            macros,
            allergenWarning: warning?.blocking ? warning.text : undefined,
            dislikeNote: person
                ? (recipeDislikeNote(
                      view.ingredients.map((row) => row.displayName),
                      dislikes,
                      person.displayName,
                  ) ?? undefined)
                : undefined,
            isOwner: gate.viewer.role === "owner",
            error: opts.error,
        }),
    };
}

function renderBare(title: string, body: string): string {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
    <style>
        .dash-head { margin: 24px auto 16px; max-width: 720px; padding: 0 16px; }
        .logout { margin-top: 16px; }
        .empty { max-width: 720px; margin: 48px auto; padding: 0 16px; }
        .create-household, .add-member { max-width: 720px; margin: 0 auto 32px; padding: 0 16px; display: grid; gap: 8px; }
        .create-household input, .create-household button, .add-member input, .add-member button { font: inherit; padding: 8px; }
        .error-banner { margin: 0 0 8px; }
    </style>
</head>
<body>
${body}
</body>
</html>`;
}

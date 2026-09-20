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
    getHouseholdMembership,
    getProfile,
    householdExists,
    listHouseholdMembers,
    preferredDrinkUnitFromProfile,
} from "./supabase.js";
import { renderFridgeStub } from "./app/fridge-stub.js";
import { renderGroceryStub } from "./app/grocery-stub.js";
import { renderRecipesStub } from "./app/recipes-stub.js";
import { renderSettingsStub } from "./app/settings-stub.js";
import {
    renderNutritionPage,
    viewerChromeFromProfile,
    type NutritionView,
} from "./app/nutrition.js";
import { isAccentSwatch, escapeHtml, type AppTabId } from "./app/shell.js";

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

function addMemberFormHtml(error?: string): string {
    return `<form method="POST" action="/add-household-member" class="add-member">
            <h2 class="section-title">Add household member</h2>
            ${formErrorHtml(error)}
            <label for="add_display_name">Name</label>
            <input id="add_display_name" name="display_name" required maxlength="80" />
            <label for="add_password">Password</label>
            <input id="add_password" name="password" type="password" required />
            <label for="add_email">Email</label>
            <input id="add_email" name="email" type="email" />
            <label for="add_username">Username</label>
            <input id="add_username" name="username" autocomplete="username" />
            <button type="submit">Add member</button>
        </form>`;
}

export function addMemberErrorHtml(error: string): string {
    return renderBare("Add household member", addMemberFormHtml(error));
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

export async function renderStubPage(
    viewerUserId: string,
    tab: Exclude<AppTabId, "nutrition">,
): Promise<{ status: 200 | 403; html: string }> {
    const gate = await memberGate(viewerUserId);
    if ("html" in gate) return { status: gate.status, html: gate.html };
    const profile = await getProfile(viewerUserId);
    const chrome = viewerChromeFromProfile(profile);
    const swatch = isAccentSwatch(profile?.accent_swatch)
        ? profile.accent_swatch
        : null;
    switch (tab) {
        case "fridge":
            return { status: 200, html: renderFridgeStub(chrome) };
        case "grocery":
            return { status: 200, html: renderGroceryStub(chrome) };
        case "recipes":
            return { status: 200, html: renderRecipesStub(chrome) };
        case "settings":
            return { status: 200, html: renderSettingsStub(chrome, swatch) };
    }
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

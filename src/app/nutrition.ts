import type { DashboardAccess, HouseholdMember } from "../household.js";
import type { MealInput, MealInsertResult, WaterInput, WaterInsertResult, WeightInput, WeightInsertResult } from "../db/nutrition.js";
import { isWeightUnit, toGrams, type WeightUnit } from "../domain/units.js";
import { getWidgetHtml, withWidgetData } from "../widgets.js";
import {
    accentColor,
    escapeHtml,
    renderAppShell,
    resolveAccent,
    resolveTheme,
    type ViewerChrome,
} from "./shell.js";
import { renderErrorBanner } from "../web/components/page-markup.js";

export type NutritionView = {
    access: Extract<DashboardAccess, { ok: true }>;
    members: HouseholdMember[];
    summary: unknown;
    goals: unknown;
    trends: unknown;
    weight: unknown;
    chrome: ViewerChrome;
    error?: string;
};

export type LogFormResult = { ok: true } | { ok: false; error: string };

export function viewerChromeFromProfile(
    profile: {
        theme?: string | null;
        accent_swatch?: string | null;
    } | null,
): ViewerChrome {
    return {
        theme: resolveTheme(profile?.theme),
        accent: resolveAccent(profile?.accent_swatch),
    };
}

async function widgetCard(
    key: string,
    data: unknown,
    chrome: ViewerChrome,
): Promise<string> {
    const html = withWidgetData(await getWidgetHtml(key), data, {
        theme: chrome.theme,
        accent: accentColor(chrome.theme, chrome.accent),
    });
    return `<iframe class="widget-frame" title="${escapeHtml(key)}" srcdoc="${escapeHtml(html)}"></iframe>`;
}

export function withNutritionError(html: string, error: string): string {
    const banner = renderErrorBanner(error);
    if (!banner || html.includes(banner)) return html;
    return html.replace(
        '<header class="dash-head">',
        `${banner}\n        <header class="dash-head">`,
    );
}

function logForms(): string {
    return `<form class="fridge-add-supply" method="post" action="/log-meal">
            <label for="log-meal-description">Meal</label>
            <input id="log-meal-description" name="description" type="text" autocomplete="off" />
            <button type="submit">Log meal</button>
        </form>
        <form class="fridge-add-supply" method="post" action="/log-water">
            <label for="log-water-amount">Water (ml)</label>
            <input id="log-water-amount" name="amount_ml" type="number" step="any" />
            <button type="submit">Log water</button>
        </form>
        <form class="fridge-add-supply" method="post" action="/log-weight">
            <label for="log-weight-amount">Weight (kg)</label>
            <input id="log-weight-amount" name="weight" type="number" step="any" />
            <input type="hidden" name="unit" value="kg" />
            <button type="submit">Log weight</button>
        </form>`;
}

export async function logMealFromForm(
    userId: string,
    fields: { description?: string },
    insert: (userId: string, input: MealInput) => Promise<MealInsertResult>,
): Promise<LogFormResult> {
    const description = fields.description?.trim() ?? "";
    if (!description) {
        return { ok: false, error: "Enter a meal description." };
    }
    await insert(userId, { description, meal_type: "snack" });
    return { ok: true };
}

export async function logWaterFromForm(
    userId: string,
    fields: { amount_ml?: string },
    insert: (userId: string, input: WaterInput) => Promise<WaterInsertResult>,
): Promise<LogFormResult> {
    const amount_ml = Number(fields.amount_ml);
    if (!Number.isFinite(amount_ml) || amount_ml <= 0) {
        return { ok: false, error: "Enter a water amount greater than zero." };
    }
    await insert(userId, { amount_ml: Math.round(amount_ml) });
    return { ok: true };
}

export async function logWeightFromForm(
    userId: string,
    fields: { weight?: string; unit?: string },
    insert: (userId: string, input: WeightInput) => Promise<WeightInsertResult>,
): Promise<LogFormResult> {
    const weight = Number(fields.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
        return { ok: false, error: "Enter a weight greater than zero." };
    }
    const unit: WeightUnit = isWeightUnit(fields.unit) ? fields.unit : "kg";
    await insert(userId, { weight_g: toGrams(weight, unit) });
    return { ok: true };
}

export async function renderNutritionPage(
    view: NutritionView,
): Promise<string> {
    const cards = await Promise.all([
        widgetCard("nutrition-summary", view.summary, view.chrome),
        widgetCard("goal-progress", view.goals, view.chrome),
        widgetCard("trends", view.trends, view.chrome),
        widgetCard("weight-trends", view.weight, view.chrome),
    ]);

    const memberNav = view.members
        .map((m) => {
            const current = m.userId === view.access.subject.userId;
            const href =
                m.userId === view.access.viewer.userId
                    ? "/"
                    : `/?member=${encodeURIComponent(m.userId)}`;
            const label = escapeHtml(m.displayName);
            const attrs = current ? ' aria-current="page"' : "";
            return `<a href="${escapeHtml(href)}"${attrs}>${label}</a>`;
        })
        .join("");

    const peerNote =
        view.access.mode === "peer"
            ? `<p class="peer-note">Viewing ${escapeHtml(view.access.subject.displayName)}. You can look, not edit. Only they (or a household bot) can change these records.</p>`
            : "";

    const forms = view.access.mode === "peer" ? "" : logForms();

    const body = `
        ${renderErrorBanner(view.error)}
        <header class="dash-head">
            <h1>${escapeHtml(view.access.subject.displayName)}</h1>
            ${peerNote}
            <nav class="member-switch" aria-label="Household members">${memberNav}</nav>
        </header>
        ${forms}
        ${cards.join("\n")}
    `;
    return renderAppShell({
        title: "Nutrition",
        active: "nutrition",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}

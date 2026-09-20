import type { DashboardAccess, HouseholdMember } from "../household.js";
import { getWidgetHtml, withWidgetData } from "../widgets.js";
import {
    accentColor,
    escapeHtml,
    renderAppShell,
    resolveAccent,
    resolveTheme,
    type ViewerChrome,
} from "./shell.js";

export type NutritionView = {
    access: Extract<DashboardAccess, { ok: true }>;
    members: HouseholdMember[];
    summary: unknown;
    goals: unknown;
    trends: unknown;
    weight: unknown;
    chrome: ViewerChrome;
};

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

    const body = `
        <header class="dash-head">
            <h1>${escapeHtml(view.access.subject.displayName)}</h1>
            ${peerNote}
            <nav class="member-switch" aria-label="Household members">${memberNav}</nav>
        </header>
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

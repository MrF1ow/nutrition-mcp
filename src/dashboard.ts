import {
    dashboardAccess,
    householdConfigToWire,
    type DashboardAccess,
    type HouseholdConfigWire,
    type HouseholdMember,
} from "./household.js";
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
    preferredDrinkUnitFromProfile,
} from "./supabase.js";
import { getWidgetHtml, withWidgetData } from "./widgets.js";

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function alcoholOf(
    profile: Parameters<typeof alcoholTrackingEnabledFromProfile>[0],
): AlcoholDisplay {
    if (!alcoholTrackingEnabledFromProfile(profile)) return null;
    return preferredDrinkUnitFromProfile(profile) ?? "us";
}

export type DashboardView = {
    access: Extract<DashboardAccess, { ok: true }>;
    members: HouseholdMember[];
    household: HouseholdConfigWire | null;
    summary: unknown;
    goals: unknown;
    trends: unknown;
    weight: unknown;
    addMemberError?: string;
};

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

export async function renderDashboardHtml(
    view: DashboardView,
): Promise<string> {
    const cards = await Promise.all([
        widgetCard("nutrition-summary", view.summary),
        widgetCard("goal-progress", view.goals),
        widgetCard("trends", view.trends),
        widgetCard("weight-trends", view.weight),
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

    const householdBlock = view.household
        ? `<section class="facts">
            <h2 class="section-title">Household</h2>
            <div class="facts-row"><span>Name</span><span>${escapeHtml(view.household.name)}</span></div>
            <div class="facts-row"><span>Fridge</span><span>${escapeHtml(view.household.fridge_locations.join(", ") || "—")}</span></div>
        </section>`
        : "";

    const addMemberForm =
        view.access.mode === "self" && view.access.viewer.role === "owner"
            ? addMemberFormHtml(view.addMemberError)
            : "";

    const body = `
        <header class="dash-head">
            <p class="eyebrow">Household</p>
            <h1>${escapeHtml(view.access.subject.displayName)}</h1>
            ${peerNote}
            <nav class="member-switch" aria-label="Household members">${memberNav}</nav>
            <p class="logout"><a href="/logout">Log out</a></p>
        </header>
        ${addMemberForm}
        ${cards.join("\n")}
        ${householdBlock}
    `;
    return renderBare("Household", body);
}

export async function renderDashboardPage(
    viewerUserId: string,
    requestedMember: string | undefined,
    addMemberError?: string,
): Promise<{ status: 200 | 403; html: string }> {
    const viewer = await getHouseholdMembership(viewerUserId);
    if (viewer == null) {
        if (!(await householdExists())) {
            return { status: 200, html: createHouseholdFormHtml() };
        }
        return { status: 403, html: forbiddenDashboardHtml() };
    }
    let subject = viewer;
    if (requestedMember && requestedMember !== viewerUserId) {
        const requested = await getHouseholdMembership(requestedMember);
        if (requested == null) {
            return { status: 403, html: forbiddenDashboardHtml() };
        }
        subject = requested;
    }
    const access = dashboardAccess(viewer, subject);
    if (!access.ok) {
        return { status: 403, html: forbiddenDashboardHtml() };
    }

    const profile = await getProfile(access.subject.userId);
    const alcohol = alcoholOf(profile);
    const members = await listHouseholdMembers(access.viewer.householdId);
    const config = await getHouseholdConfig(access.viewer.householdId);

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
            household: config ? householdConfigToWire(config) : null,
            summary,
            goals,
            trends,
            weight,
            addMemberError,
        }),
    };
}

async function widgetCard(key: string, data: unknown): Promise<string> {
    const html = withWidgetData(await getWidgetHtml(key), data);
    return `<iframe class="widget-frame" title="${escapeHtml(key)}" srcdoc="${escapeHtml(html)}"></iframe>`;
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
        .member-switch { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
        .member-switch a[aria-current="page"] { font-weight: 700; }
        .peer-note { margin: 8px 0 0; }
        .widget-frame { display: block; width: min(720px, 100%); margin: 0 auto 16px; border: 0; min-height: 280px; }
        .logout { margin-top: 16px; }
        .empty { max-width: 720px; margin: 48px auto; padding: 0 16px; }
        .create-household, .add-member { max-width: 720px; margin: 0 auto 32px; padding: 0 16px; display: grid; gap: 8px; }
        .create-household input, .create-household button, .add-member input, .add-member button { font: inherit; padding: 8px; }
        .error-banner { margin: 0 0 8px; }
        .facts { max-width: 720px; margin: 0 auto 32px; padding: 0 16px; }
        .facts-row { display: flex; justify-content: space-between; border-top: 1px solid var(--rule, #222); padding: 8px 0; }
    </style>
</head>
<body>
${body}
<script>
document.querySelectorAll(".widget-frame").forEach((frame) => {
    const fit = () => {
        try {
            const doc = frame.contentDocument;
            if (!doc) return;
            frame.style.height = Math.ceil(doc.documentElement.scrollHeight) + "px";
        } catch (_) {}
    };
    frame.addEventListener("load", fit);
    window.addEventListener("message", (e) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data;
        if (d && d.method && String(d.method).endsWith("size-changed") && d.params && d.params.height) {
            frame.style.height = d.params.height + "px";
        }
    });
});
</script>
</body>
</html>`;
}

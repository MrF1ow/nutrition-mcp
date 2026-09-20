import { test, expect } from "bun:test";
import { withWidgetData } from "./widgets.js";
import { createHouseholdFormHtml, renderDashboardHtml } from "./dashboard.js";
import type { HouseholdMember } from "./household.js";

const alice: HouseholdMember = {
    householdId: "hh-1",
    userId: "11111111-1111-4111-8111-111111111111",
    role: "owner",
    displayName: "Alice",
};
const bob: HouseholdMember = {
    householdId: "hh-1",
    userId: "22222222-2222-4222-8222-222222222222",
    role: "member",
    displayName: "Bob",
};

test("withWidgetData seeds the existing script, not a second tag", () => {
    const html = "<html><script>initWidget({})</script></html>";
    const out = withWidgetData(html, { locale: "en" });
    expect((out.match(/<script>/g) ?? []).length).toBe(1);
    expect(out).toContain("window.__WIDGET_DATA__=");
    expect(out).toContain('"locale":"en"');
});

test("self dashboard reuses widget iframes and has no peer note", async () => {
    const html = await renderDashboardHtml({
        access: { ok: true, mode: "self", viewer: alice, subject: alice },
        members: [alice, bob],
        household: {
            name: "Home",
            fridge_locations: ["main"],
            recipe_search_places: [],
            preferences: {
                constraints: [],
                budget: null,
                shopping_cadence: null,
            },
        },
        summary: { locale: "en", drink_unit: null },
        goals: { locale: "en" },
        trends: { locale: "en" },
        weight: { locale: "en", unit: "kg" },
    });
    expect(html).toContain("<h1>Alice</h1>");
    expect(html).not.toContain('class="peer-note"');
    expect(html).toContain('title="nutrition-summary"');
    expect(html).toContain('title="goal-progress"');
    expect(html).toContain('title="trends"');
    expect(html).toContain('title="weight-trends"');
    expect(html).toContain("window.__WIDGET_DATA__=");
    expect(html).toContain('href="/logout"');
    expect(html).not.toContain('action="/approve"');
    expect(html).toContain("Home");
    expect(html).toContain(`href="/?member=${bob.userId}"`);
});

test("peer dashboard is read-only and names the subject", async () => {
    const html = await renderDashboardHtml({
        access: { ok: true, mode: "peer", viewer: alice, subject: bob },
        members: [alice, bob],
        household: null,
        summary: { locale: "en" },
        goals: { locale: "en" },
        trends: { locale: "en" },
        weight: { locale: "en" },
    });
    expect(html).toContain("<h1>Bob</h1>");
    expect(html).toContain("Viewing Bob");
    expect(html).toContain("You can look, not edit");
    expect(html).toContain('href="/"');
    expect(html).toContain(`aria-current="page"`);
    expect(html).not.toContain('action="/approve"');
});

test("create-household form posts name fields and has no widgets", () => {
    const html = createHouseholdFormHtml();
    expect(html).toContain('action="/create-household"');
    expect(html).toContain('name="household_name"');
    expect(html).toContain('name="display_name"');
    expect(html).toContain("<h1>Create household</h1>");
    expect(html).not.toContain("<iframe");
    expect(html).toContain('href="/logout"');
});

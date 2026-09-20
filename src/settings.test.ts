import { test, expect } from "bun:test";
import {
    createGroceryStore,
    createMemorySettingsStore,
    DEFAULT_STORE_SECTIONS,
    renameSection,
    SettingsInputError,
} from "./settings.js";
import { renderSettingsPage } from "./app/settings/page.js";
import { renderHouseholdSettingsPage } from "./app/settings/household.js";
import { ACCENT_SWATCHES } from "./app/shell.js";
import type { HouseholdMember } from "./household.js";

const HH = "hh-1";

const alice: HouseholdMember = {
    householdId: HH,
    userId: "11111111-1111-4111-8111-111111111111",
    role: "owner",
    displayName: "Alice",
};
const bob: HouseholdMember = {
    householdId: HH,
    userId: "22222222-2222-4222-8222-222222222222",
    role: "member",
    displayName: "Bob",
};

const chrome = { theme: "light" as const, accent: ACCENT_SWATCHES.sky };

test("theme save form posts account fields to /settings", () => {
    const html = renderSettingsPage({
        chrome: { theme: "dark", accent: ACCENT_SWATCHES.rose },
        selectedSwatch: "rose",
        displayName: "Alice",
        timezone: "America/Los_Angeles",
        locale: "en",
        weightUnit: "lb",
        widgetsEnabled: true,
        alcoholTrackingEnabled: false,
        drinkUnit: "",
    });
    expect(html).toContain("<h1>Settings</h1>");
    expect(html).toContain('href="/settings/household"');
    expect(html).toContain('name="theme" value="dark" checked');
    expect(html).toContain('value="rose" checked');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain("--accent:#fb7199");
    expect(html).not.toContain("coming-soon");
});

test("creating a store seeds default sections including Other", async () => {
    const store = createMemorySettingsStore();
    const created = await createGroceryStore(store, HH, "Safeway");
    expect(created.name).toBe("Safeway");
    const sections = await store.listSections(created.id);
    expect(sections.map((row) => row.name)).toEqual([
        ...DEFAULT_STORE_SECTIONS,
    ]);
    expect(sections.some((row) => row.isOther && row.name === "Other")).toBe(
        true,
    );
});

test("creating a store refuses a duplicate name", async () => {
    const store = createMemorySettingsStore();
    await createGroceryStore(store, HH, "Safeway");
    await expect(createGroceryStore(store, HH, "Safeway")).rejects.toThrow(
        SettingsInputError,
    );
});

test("section rename updates the stored name", async () => {
    const store = createMemorySettingsStore();
    const created = await createGroceryStore(store, HH, "Safeway");
    const produce = (await store.listSections(created.id)).find(
        (row) => row.name === "Produce",
    )!;
    const renamed = await renameSection(
        store,
        HH,
        produce.id,
        "Household goods",
    );
    expect(renamed.name).toBe("Household goods");
    const names = (await store.listSections(created.id)).map((row) => row.name);
    expect(names).toContain("Household goods");
    expect(names).toContain("Household");
    await expect(
        renameSection(store, HH, produce.id, "Household"),
    ).rejects.toThrow(/already exists/i);
});

test("owner household page has add-member form on /settings/household only", () => {
    const html = renderHouseholdSettingsPage({
        chrome,
        householdName: "Home",
        location: "",
        members: [alice, bob],
        stores: [],
        memberRules: [
            { member: alice, rules: [], allergens: [], dislikes: [] },
            { member: bob, rules: [], allergens: [], dislikes: [] },
        ],
        isOwner: true,
    });
    expect(html).toContain("<h1>Household</h1>");
    expect(html).toContain('action="/settings/household"');
    expect(html).toContain("Add household member");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).not.toContain('action="/add-household-member"');
});

test("member household page is read-only without add-member", () => {
    const html = renderHouseholdSettingsPage({
        chrome,
        householdName: "Home",
        location: "Seattle",
        members: [alice, bob],
        stores: [],
        memberRules: [
            { member: alice, rules: [], allergens: [], dislikes: [] },
            { member: bob, rules: [], allergens: [], dislikes: [] },
        ],
        isOwner: false,
    });
    expect(html).toContain("Seattle");
    expect(html).not.toContain('action="/settings/household"');
    expect(html).not.toContain("Add household member");
    expect(html).not.toContain('action="/settings/household/stores"');
});

import { test, expect } from "bun:test";
import {
    bootstrapHousehold,
    createMemoryHouseholdStore,
    getHouseholdId,
    HouseholdAlreadyExistsError,
    listMembers,
    requireMember,
    type Household,
    type HouseholdMember,
} from "./household.js";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";

function extraHousehold(id: string): Household {
    return {
        id,
        name: "Second kitchen",
        fridgeLocations: [],
        recipeSearchPlaces: [],
        preferences: {},
    };
}

test("first bootstrap creates one household and an owner", () => {
    const store = createMemoryHouseholdStore();

    const householdId = bootstrapHousehold(store, alice, "Home", "Alice");

    expect(householdId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(getHouseholdId(store, alice)).toBe(householdId);
    expect(store.getHousehold()).toEqual({
        id: householdId,
        name: "Home",
        fridgeLocations: [],
        recipeSearchPlaces: [],
        preferences: {},
    } satisfies Household);
    expect(listMembers(store, householdId)).toEqual([
        {
            householdId,
            userId: alice,
            role: "owner",
            displayName: "Alice",
        } satisfies HouseholdMember,
    ]);
    expect(requireMember(store, alice)).toEqual({
        ok: true,
        member: {
            householdId,
            userId: alice,
            role: "owner",
            displayName: "Alice",
        },
    });
});

test("second user bootstrap joins as member on the same household id", () => {
    const store = createMemoryHouseholdStore();
    const householdId = bootstrapHousehold(store, alice, "Home", "Alice");

    const joinedId = bootstrapHousehold(store, bob, "Ignored name", "Bob");

    expect(joinedId).toBe(householdId);
    expect(getHouseholdId(store, bob)).toBe(householdId);
    expect(requireMember(store, bob)).toEqual({
        ok: true,
        member: {
            householdId,
            userId: bob,
            role: "member",
            displayName: "Bob",
        },
    });
});

test("repeating bootstrap for the same user returns the same household id", () => {
    const store = createMemoryHouseholdStore();
    const householdId = bootstrapHousehold(store, alice, "Home", "Alice");

    expect(bootstrapHousehold(store, alice, "Other", "Renamed")).toBe(
        householdId,
    );
    expect(requireMember(store, alice)).toEqual({
        ok: true,
        member: {
            householdId,
            userId: alice,
            role: "owner",
            displayName: "Alice",
        },
    });
});

test("a second household insert is rejected after the singleton exists", () => {
    const store = createMemoryHouseholdStore();
    bootstrapHousehold(store, alice, "Home", "Alice");
    bootstrapHousehold(store, bob, "Home", "Bob");

    expect(() =>
        store.insertHousehold(
            extraHousehold("44444444-4444-4444-8444-444444444444"),
        ),
    ).toThrow(HouseholdAlreadyExistsError);
    expect(store.getHousehold()?.name).toBe("Home");
});

test("requireMember for a stranger fails with a typed error", () => {
    const store = createMemoryHouseholdStore();
    bootstrapHousehold(store, alice, "Home", "Alice");

    expect(requireMember(store, carol)).toEqual({
        ok: false,
        error: "not_a_member",
    });
    expect(getHouseholdId(store, carol)).toBe(null);
});

test("listMembers returns both members after two bootstraps", () => {
    const store = createMemoryHouseholdStore();
    const householdId = bootstrapHousehold(store, alice, "Home", "Alice");
    bootstrapHousehold(store, bob, "Home", "Bob");

    expect(listMembers(store, householdId)).toEqual([
        {
            householdId,
            userId: alice,
            role: "owner",
            displayName: "Alice",
        },
        {
            householdId,
            userId: bob,
            role: "member",
            displayName: "Bob",
        },
    ]);
});

test("deleting a user removes only that membership", () => {
    const store = createMemoryHouseholdStore();
    const householdId = bootstrapHousehold(store, alice, "Home", "Alice");
    bootstrapHousehold(store, bob, "Home", "Bob");

    store.deleteUser(bob);

    expect(listMembers(store, householdId)).toEqual([
        {
            householdId,
            userId: alice,
            role: "owner",
            displayName: "Alice",
        },
    ]);
    expect(requireMember(store, bob)).toEqual({
        ok: false,
        error: "not_a_member",
    });
    expect(store.getHousehold()?.id).toBe(householdId);
});

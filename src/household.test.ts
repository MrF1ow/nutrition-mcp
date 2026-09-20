import { test, expect } from "bun:test";
import {
    bootstrapHousehold,
    createHousehold,
    createMemoryHouseholdStore,
    getHouseholdId,
    HouseholdAlreadyExistsError,
    listMembers,
    requireMember,
    requireMemberOfHousehold,
    resolveActorUserId,
    dashboardAccess,
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
        preferences: {
            constraints: [],
            budget: null,
            shoppingCadence: null,
        },
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
        preferences: {
            constraints: [],
            budget: null,
            shoppingCadence: null,
        },
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

test("createHousehold inserts the owner and fails if a household exists", () => {
    const store = createMemoryHouseholdStore();
    const householdId = createHousehold(store, alice, "Home", "Alice");

    expect(getHouseholdId(store, alice)).toBe(householdId);
    expect(requireMember(store, alice)).toEqual({
        ok: true,
        member: {
            householdId,
            userId: alice,
            role: "owner",
            displayName: "Alice",
        },
    });
    expect(() => createHousehold(store, bob, "Other", "Bob")).toThrow(
        HouseholdAlreadyExistsError,
    );
    expect(getHouseholdId(store, bob)).toBe(null);
    expect(store.getHousehold()?.id).toBe(householdId);
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

test("OAuth without user_id acts as the token user", () => {
    expect(
        resolveActorUserId({ kind: "user", userId: alice }, undefined),
    ).toEqual({
        ok: true,
        userId: alice,
        membership: "not_required",
    });
});

test("OAuth with matching user_id still acts as self", () => {
    expect(resolveActorUserId({ kind: "user", userId: alice }, alice)).toEqual({
        ok: true,
        userId: alice,
        membership: "not_required",
    });
});

test("OAuth with a different user_id is a mismatch, not sudo", () => {
    expect(resolveActorUserId({ kind: "user", userId: alice }, bob)).toEqual({
        ok: false,
        error: "oauth_mismatch",
    });
});

test("OAuth write intent targeting a peer is still a mismatch", () => {
    expect(
        resolveActorUserId({ kind: "user", userId: alice }, bob, "write"),
    ).toEqual({
        ok: false,
        error: "oauth_mismatch",
    });
});

test("OAuth read intent targeting a peer is a household peer read", () => {
    expect(
        resolveActorUserId({ kind: "user", userId: alice }, bob, "read"),
    ).toEqual({
        ok: true,
        userId: bob,
        membership: "peer",
        viewerUserId: alice,
    });
});

test("OAuth read intent without user_id is still self", () => {
    expect(
        resolveActorUserId({ kind: "user", userId: alice }, undefined, "read"),
    ).toEqual({
        ok: true,
        userId: alice,
        membership: "not_required",
    });
});

test("household PAT without user_id is missing a target", () => {
    expect(
        resolveActorUserId(
            { kind: "household", householdId: "hh-1" },
            undefined,
        ),
    ).toEqual({
        ok: false,
        error: "missing_target",
    });
});

test("dashboardAccess treats a missing viewer as not a member", () => {
    expect(dashboardAccess(null, null)).toEqual({
        ok: false,
        error: "not_a_member",
    });
});

test("dashboardAccess with no subject is self", () => {
    const aliceMember: HouseholdMember = {
        householdId: "hh-1",
        userId: alice,
        role: "owner",
        displayName: "Alice",
    };
    expect(dashboardAccess(aliceMember, null)).toEqual({
        ok: true,
        mode: "self",
        viewer: aliceMember,
        subject: aliceMember,
    });
});

test("dashboardAccess allows a same-household peer as read-only", () => {
    const aliceMember: HouseholdMember = {
        householdId: "hh-1",
        userId: alice,
        role: "owner",
        displayName: "Alice",
    };
    const bobMember: HouseholdMember = {
        householdId: "hh-1",
        userId: bob,
        role: "member",
        displayName: "Bob",
    };
    expect(dashboardAccess(aliceMember, bobMember)).toEqual({
        ok: true,
        mode: "peer",
        viewer: aliceMember,
        subject: bobMember,
    });
});

test("dashboardAccess rejects a member of another household", () => {
    const aliceMember: HouseholdMember = {
        householdId: "hh-1",
        userId: alice,
        role: "owner",
        displayName: "Alice",
    };
    const outsider: HouseholdMember = {
        householdId: "hh-2",
        userId: carol,
        role: "member",
        displayName: "Out",
    };
    expect(dashboardAccess(aliceMember, outsider)).toEqual({
        ok: false,
        error: "not_a_peer",
    });
});

test("household PAT with user_id requires membership on that household", () => {
    expect(
        resolveActorUserId({ kind: "household", householdId: "hh-1" }, alice),
    ).toEqual({
        ok: true,
        userId: alice,
        membership: "required",
        householdId: "hh-1",
    });
});

test("requireMemberOfHousehold rejects a member of a different household", () => {
    const aliceHome: HouseholdMember = {
        householdId: "hh-1",
        userId: alice,
        role: "owner",
        displayName: "Alice",
    };
    expect(requireMemberOfHousehold(aliceHome, "hh-1")).toEqual({
        ok: true,
        member: aliceHome,
    });
    expect(requireMemberOfHousehold(aliceHome, "hh-other")).toEqual({
        ok: false,
        error: "not_a_member",
    });
    expect(requireMemberOfHousehold(null, "hh-1")).toEqual({
        ok: false,
        error: "not_a_member",
    });
});

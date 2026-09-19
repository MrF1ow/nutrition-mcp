import { expect, test } from "bun:test";
import {
    combineBearerLookups,
    generateHouseholdToken,
    hashHouseholdToken,
    householdTokenHashHex,
    HOUSEHOLD_TOKEN_PREFIX,
} from "./household-token.js";
import {
    HOUSEHOLD_HAS_NO_DEFAULT_USER,
    rateLimitKey,
    requireActorUserId,
} from "./auth-context.js";

test("generated tokens use the nt_hh_ prefix and hash round-trips", () => {
    const token = generateHouseholdToken();
    expect(token.startsWith(HOUSEHOLD_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(HOUSEHOLD_TOKEN_PREFIX.length + 32);
    const hex = householdTokenHashHex(hashHouseholdToken(token));
    expect(hex).toHaveLength(64);
    expect(hex).toBe(householdTokenHashHex(hashHouseholdToken(token)));
    expect(hex).not.toBe(
        householdTokenHashHex(hashHouseholdToken(token + "x")),
    );
});

test("OAuth wins when both lookups hit", () => {
    expect(
        combineBearerLookups(
            { status: "hit", id: "user-1" },
            { status: "hit", id: "hh-1" },
        ),
    ).toEqual({ status: "valid", kind: "user", userId: "user-1" });
});

test("household hash resolves after an OAuth miss", () => {
    expect(
        combineBearerLookups({ status: "miss" }, { status: "hit", id: "hh-1" }),
    ).toEqual({ status: "valid", kind: "household", householdId: "hh-1" });
});

test("an OAuth outage does not ban a live household token", () => {
    expect(
        combineBearerLookups(
            { status: "unavailable" },
            { status: "hit", id: "hh-1" },
        ),
    ).toEqual({ status: "valid", kind: "household", householdId: "hh-1" });
});

test("an OAuth outage with no household match stays unavailable", () => {
    expect(
        combineBearerLookups({ status: "unavailable" }, { status: "miss" }),
    ).toEqual({ status: "unavailable" });
    expect(
        combineBearerLookups({ status: "miss" }, { status: "unavailable" }),
    ).toEqual({ status: "unavailable" });
});

test("unknown tokens are invalid only when both tables answered miss", () => {
    expect(
        combineBearerLookups({ status: "miss" }, { status: "miss" }),
    ).toEqual({ status: "invalid" });
});

test("household auth has no default userId and rate-limits on householdId", () => {
    const household = { kind: "household" as const, householdId: "hh-1" };
    expect(() => requireActorUserId(household)).toThrow(
        HOUSEHOLD_HAS_NO_DEFAULT_USER,
    );
    expect(rateLimitKey(household)).toBe("hh:hh-1");
    expect(rateLimitKey({ kind: "user", userId: "user-1" })).toBe("user-1");
});

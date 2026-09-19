import { createHash, randomBytes } from "node:crypto";

export const HOUSEHOLD_TOKEN_PREFIX = "nt_hh_";

export type TableLookup =
    | { status: "hit"; id: string }
    | { status: "miss" }
    | { status: "unavailable" };

export type CombinedBearerLookup =
    | { status: "valid"; kind: "user"; userId: string }
    | { status: "valid"; kind: "household"; householdId: string }
    | { status: "invalid" }
    | { status: "unavailable" };

export function generateHouseholdToken(): string {
    return `${HOUSEHOLD_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashHouseholdToken(plaintext: string): Uint8Array {
    return new Uint8Array(createHash("sha256").update(plaintext).digest());
}

export function householdTokenHashHex(hash: Uint8Array): string {
    return Buffer.from(hash).toString("hex");
}

export function combineBearerLookups(
    oauth: TableLookup,
    household: TableLookup,
): CombinedBearerLookup {
    if (oauth.status === "hit") {
        return { status: "valid", kind: "user", userId: oauth.id };
    }
    if (household.status === "hit") {
        return {
            status: "valid",
            kind: "household",
            householdId: household.id,
        };
    }
    if (oauth.status === "unavailable" || household.status === "unavailable") {
        return { status: "unavailable" };
    }
    return { status: "invalid" };
}

export type AuthContext =
    | { kind: "user"; userId: string }
    | { kind: "household"; householdId: string };

export const HOUSEHOLD_HAS_NO_DEFAULT_USER =
    "This household token has no default user. Person tools need a member OAuth session until targeting ships.";

export function requireActorUserId(auth: AuthContext): string {
    if (auth.kind !== "user") {
        throw new Error(HOUSEHOLD_HAS_NO_DEFAULT_USER);
    }
    return auth.userId;
}

export function rateLimitKey(auth: AuthContext): string {
    return auth.kind === "user" ? auth.userId : `hh:${auth.householdId}`;
}

export function analyticsUserId(auth: AuthContext): string {
    return auth.kind === "user" ? auth.userId : `hh:${auth.householdId}`;
}

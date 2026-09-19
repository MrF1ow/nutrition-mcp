export type AuthContext =
    | { kind: "user"; userId: string }
    | { kind: "household"; householdId: string };

export const HOUSEHOLD_HAS_NO_DEFAULT_USER =
    "This household token has no default user. Pass user_id set to a household member.";

export const HOUSEHOLD_CANNOT_DELETE_ACCOUNT =
    "Household tokens cannot delete accounts. Sign in as the user instead.";

export const OAUTH_USER_MISMATCH = "user_id must match the signed-in user";

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

import {
    combineBearerLookups,
    hashHouseholdToken,
    householdTokenHashHex,
    type TableLookup,
} from "../household-token.js";
import { getSupabase } from "./client.js";

// ---------- OAuth tokens ----------

export async function storeToken(token: string, userId: string): Promise<void> {
    const expiresAt = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await getSupabase().from("oauth_tokens").upsert(
        {
            token,
            user_id: userId,
            expires_at: expiresAt,
        },
        { onConflict: "token" },
    );

    if (error) throw new Error(`Failed to store token: ${error.message}`);
}

// "invalid" means the token definitively isn't valid; "unavailable" means we
// could not find out. Callers must not treat the two alike: counting an
// unavailable lookup as a failed auth attempt would let a brief Supabase outage
// — during which *every* token looks invalid — trip the repeat-failure bans in
// rate-limit.ts and keep clients shed long after the database recovered.
export type TokenLookup =
    | { status: "valid"; kind: "user"; userId: string }
    | { status: "valid"; kind: "household"; householdId: string }
    | { status: "invalid" }
    | { status: "unavailable" };

// PostgREST's code for "no rows returned" from .single() — a real answer (this
// token does not exist), not a transport or availability failure.
const PGRST_NO_ROWS = "PGRST116";

async function lookupOauthToken(token: string): Promise<TableLookup> {
    try {
        const { data, error } = await getSupabase()
            .from("oauth_tokens")
            .select("user_id")
            .eq("token", token)
            .gt("expires_at", new Date().toISOString())
            .single();

        if (error) {
            return error.code === PGRST_NO_ROWS
                ? { status: "miss" }
                : { status: "unavailable" };
        }
        if (!data?.user_id) return { status: "miss" };
        return { status: "hit", id: data.user_id as string };
    } catch {
        return { status: "unavailable" };
    }
}

async function lookupHouseholdToken(token: string): Promise<TableLookup> {
    try {
        const { data, error } = await getSupabase().rpc(
            "resolve_household_mcp_token",
            {
                p_token_hash_hex: householdTokenHashHex(
                    hashHouseholdToken(token),
                ),
            },
        );

        if (error) return { status: "unavailable" };
        if (typeof data !== "string" || data.length === 0) {
            return { status: "miss" };
        }
        return { status: "hit", id: data };
    } catch {
        return { status: "unavailable" };
    }
}

export async function lookupBearer(token: string): Promise<TokenLookup> {
    const oauth = await lookupOauthToken(token);
    if (oauth.status === "hit") {
        return { status: "valid", kind: "user", userId: oauth.id };
    }
    return combineBearerLookups(oauth, await lookupHouseholdToken(token));
}

// ---------- Auth codes ----------

export async function storeAuthCode(
    code: string,
    redirectUri: string,
    userId: string,
    codeChallenge?: string,
): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await getSupabase()
        .from("auth_codes")
        .insert({
            code,
            redirect_uri: redirectUri,
            user_id: userId,
            code_challenge: codeChallenge ?? null,
            expires_at: expiresAt,
        });

    if (error) throw new Error(`Failed to store auth code: ${error.message}`);
}

export interface AuthCodeData {
    code: string;
    redirect_uri: string;
    user_id: string;
    code_challenge: string | null;
}

export async function consumeAuthCode(
    code: string,
): Promise<AuthCodeData | null> {
    const now = new Date().toISOString();

    const { data, error } = await getSupabase()
        .from("auth_codes")
        .delete()
        .eq("code", code)
        .gt("expires_at", now)
        .select()
        .single();

    if (error || !data) return null;
    return data as AuthCodeData;
}

// ---------- Refresh tokens ----------

export async function storeRefreshToken(
    token: string,
    userId: string,
): Promise<void> {
    const expiresAt = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await getSupabase().from("refresh_tokens").insert({
        token,
        user_id: userId,
        expires_at: expiresAt,
    });

    if (error)
        throw new Error(`Failed to store refresh token: ${error.message}`);
}

export async function consumeRefreshToken(
    token: string,
): Promise<string | null> {
    const { data, error } = await getSupabase()
        .from("refresh_tokens")
        .delete()
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .select("user_id")
        .single();

    if (error || !data) return null;
    return data.user_id as string;
}

// ---------- Registered clients ----------

export function registerClient(
    clientName: string | null,
    redirectUris: string[],
): void {
    getSupabase()
        .from("registered_clients")
        .insert({
            client_name: clientName,
            redirect_uris: redirectUris,
        })
        .then(({ error }) => {
            if (error) {
                console.warn(
                    "Failed to persist client registration:",
                    error.message,
                );
            }
        });
}

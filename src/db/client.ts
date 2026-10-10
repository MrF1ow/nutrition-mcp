import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient;

export const SUPABASE_TIMEOUT_MS = 15_000;

export function createTimedFetch(timeoutMs: number): typeof fetch {
    const timedFetch = (input: string | URL | Request, init?: RequestInit) => {
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = init?.signal
            ? AbortSignal.any([init.signal, timeout])
            : timeout;
        return fetch(input, { ...init, signal });
    };
    return timedFetch as typeof fetch;
}

const timedFetch = createTimedFetch(SUPABASE_TIMEOUT_MS);

function buildClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
    }
    // persistSession: false keeps the client stateless — signIn/signUp on this
    // client won't attach a user JWT to future requests. Without this, the
    // singleton would silently downgrade from service-role to authenticated
    // after any auth call, making RLS fire on subsequent writes.
    return createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
        global: { fetch: timedFetch },
    });
}

export function getSupabase(): SupabaseClient {
    if (!supabase) supabase = buildClient();
    return supabase;
}

// ---------- Auth ----------

// Carries Supabase's HTTP status and error code so the login page can tell a
// wrong password (400 / invalid_credentials) from Supabase being unreachable,
// timed out or rate limited.
export class SignInError extends Error {
    constructor(
        message: string,
        readonly status: number | undefined,
        readonly code: string | undefined,
    ) {
        super(message);
        this.name = "SignInError";
    }
}

export async function signUpUser(
    email: string,
    password: string,
): Promise<string> {
    // Use a throw-away client so the session never lands on the shared singleton.
    const { data, error } = await buildClient().auth.signUp({
        email,
        password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Sign-up failed");
    return data.user.id;
}

export async function signInUser(
    email: string,
    password: string,
): Promise<string> {
    const { data, error } = await buildClient().auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw new SignInError(error.message, error.status, error.code);
    return data.user.id;
}

export async function authUserCount(): Promise<number> {
    const { data, error } = await getSupabase().auth.admin.listUsers({
        page: 1,
        perPage: 1,
    });
    if (error) throw new Error(error.message);
    if ("total" in data && typeof data.total === "number") {
        return data.total;
    }
    return data.users.length;
}

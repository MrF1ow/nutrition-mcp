const CLAUDE_EXACT = [
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
] as const;

const CHATGPT_LEGACY_EXACT =
    "https://chatgpt.com/connector_platform_oauth_redirect";

const CHATGPT_OAUTH_PREFIX = "/connector/oauth/";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const PKCE_CHALLENGE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export function extraRedirectUris(
    env: NodeJS.ProcessEnv = process.env,
): string[] {
    const raw = env.ALLOWED_REDIRECT_URIS?.trim();
    if (!raw) return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseUri(raw: string): URL | null {
    try {
        return new URL(raw);
    } catch {
        return null;
    }
}

function rejectUriBasics(url: URL): boolean {
    if (url.username || url.password) return true;
    if (url.hash) return true;
    return false;
}

function isLoopback(url: URL): boolean {
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

function matchesExactBuiltin(url: URL): boolean {
    const href = url.href;
    for (const allowed of CLAUDE_EXACT) {
        if (parseUri(allowed)?.href === href) return true;
    }
    if (parseUri(CHATGPT_LEGACY_EXACT)?.href === href) return true;
    return false;
}

function matchesChatGptOAuthPath(url: URL): boolean {
    if (url.protocol !== "https:" || url.hostname !== "chatgpt.com") {
        return false;
    }
    if (!url.pathname.startsWith(CHATGPT_OAUTH_PREFIX)) return false;
    const segment = url.pathname.slice(CHATGPT_OAUTH_PREFIX.length);
    if (!segment || segment.includes("/")) return false;
    return true;
}

function matchesExtra(url: URL, extra: string[]): boolean {
    const href = url.href;
    for (const entry of extra) {
        const parsed = parseUri(entry);
        if (parsed && parsed.href === href) return true;
    }
    return false;
}

export function isAllowedRedirectUri(raw: string, extra: string[]): boolean {
    const url = parseUri(raw);
    if (!url) return false;
    if (rejectUriBasics(url)) return false;

    if (isLoopback(url)) return true;

    if (url.search) return false;

    if (matchesExactBuiltin(url)) return true;
    if (matchesChatGptOAuthPath(url)) return true;
    if (matchesExtra(url, extra)) return true;

    return false;
}

export function isValidPkceChallenge(challenge: string): boolean {
    return PKCE_CHALLENGE_RE.test(challenge);
}

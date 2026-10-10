import { test, expect } from "bun:test";
import {
    extraRedirectUris,
    isAllowedRedirectUri,
    isValidPkceChallenge,
} from "./oauth-redirect.js";

const EXTRA: string[] = [];

test("extraRedirectUris parses comma-separated env", () => {
    expect(
        extraRedirectUris({
            ALLOWED_REDIRECT_URIS:
                " https://bot.example/cb ,https://other.example/x ",
        }),
    ).toEqual(["https://bot.example/cb", "https://other.example/x"]);
    expect(extraRedirectUris({})).toEqual([]);
});

test("allowed Claude and ChatGPT callback patterns", () => {
    const allowed = [
        "https://claude.ai/api/mcp/auth_callback",
        "https://claude.com/api/mcp/auth_callback",
        "https://chatgpt.com/connector/oauth/my-callback-id",
        "https://chatgpt.com/connector_platform_oauth_redirect",
        "http://localhost:3118/callback",
        "http://127.0.0.1:8765/",
        "http://[::1]:9999/oauth/cb",
        "http://localhost:8080/cb?foo=bar",
    ];
    for (const uri of allowed) {
        expect(isAllowedRedirectUri(uri, EXTRA)).toBe(true);
    }
});

test("extra env entries match after URL normalization", () => {
    const extra = extraRedirectUris({
        ALLOWED_REDIRECT_URIS: "https://bot.example/cb",
    });
    expect(isAllowedRedirectUri("https://bot.example/cb", extra)).toBe(true);
});

test("lookalike and malicious redirect URIs are rejected", () => {
    const denied = [
        "https://claude.ai.evil.com/api/mcp/auth_callback",
        "https://evilclaude.ai/api/mcp/auth_callback",
        "https://claude.ai/api/mcp/auth_callback/../x",
        "http://claude.ai/api/mcp/auth_callback",
        "http://localhost.evil.com/callback",
        "javascript:alert(1)",
        "https://claude.ai/api/mcp/auth_callback#frag",
        "https://user:pass@claude.ai/api/mcp/auth_callback",
        "https://evil.com/?x=https://claude.ai/api/mcp/auth_callback",
        "https://chatgpt.com/connector/oauth/a/b",
        "https://chatgpt.com/connector/oauth/",
        "https://example.com/cb",
        "https://claude.ai/api/mcp/auth_callback?evil=1",
    ];
    for (const uri of denied) {
        expect(isAllowedRedirectUri(uri, EXTRA)).toBe(false);
    }
});

test("isValidPkceChallenge accepts RFC 7636 shape", () => {
    const ok = "a".repeat(43);
    expect(isValidPkceChallenge(ok)).toBe(true);
    expect(isValidPkceChallenge("a".repeat(42))).toBe(false);
    expect(isValidPkceChallenge("a".repeat(129))).toBe(false);
    expect(isValidPkceChallenge("not+valid")).toBe(false);
});

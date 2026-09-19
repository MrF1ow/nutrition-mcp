import { test, expect } from "bun:test";
import {
    mintSiteSession,
    readSiteSession,
    siteCookieHeader,
    SITE_COOKIE,
} from "./site-session.js";

const alice = "11111111-1111-4111-8111-111111111111";

process.env.OAUTH_CLIENT_SECRET ||= "test-client-secret";

test("minted cookie round-trips to the same user", () => {
    const token = mintSiteSession(alice);
    expect(readSiteSession(token)).toBe(alice);
});

test("tampered mac is rejected", () => {
    const token = mintSiteSession(alice);
    const broken = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(readSiteSession(broken)).toBeNull();
});

test("expired cookie is rejected", () => {
    const token = mintSiteSession(alice, Date.now() - 40 * 24 * 60 * 60 * 1000);
    expect(readSiteSession(token)).toBeNull();
});

test("cookie header is httpOnly and lax", () => {
    const header = siteCookieHeader("tok", false);
    expect(header).toContain(`${SITE_COOKIE}=tok`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).not.toContain("Secure");
    expect(siteCookieHeader("tok", true)).toContain("Secure");
});

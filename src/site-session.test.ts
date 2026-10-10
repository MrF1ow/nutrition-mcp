import { test, expect, spyOn, afterEach } from "bun:test";
import {
    mintSiteSession,
    readSiteSession,
    siteCookieHeader,
    SITE_COOKIE,
    resetSessionSecretWarningForTest,
} from "./site-session.js";

const alice = "11111111-1111-4111-8111-111111111111";

const secretA = "a".repeat(32);
const secretB = "b".repeat(32);

function withEnv(
    vars: Record<string, string | undefined>,
    fn: () => void,
): void {
    const saved: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
        saved[key] = process.env[key];
        const value = vars[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        fn();
    } finally {
        for (const key of Object.keys(vars)) {
            const value = saved[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

process.env.OAUTH_CLIENT_SECRET ||= "test-client-secret-fallback-32chars!!";

test("minted cookie round-trips to the same user", () => {
    const token = mintSiteSession(alice);
    expect(readSiteSession(token)).toBe(alice);
});

test("cookie minted under one SESSION_SECRET fails under another", () => {
    withEnv(
        {
            SESSION_SECRET: secretA,
            OAUTH_CLIENT_SECRET: "oauth-unused-32chars!!!!!!!!",
        },
        () => {
            const token = mintSiteSession(alice);
            process.env.SESSION_SECRET = secretB;
            expect(readSiteSession(token)).toBeNull();
        },
    );
});

test("fallback to OAUTH_CLIENT_SECRET still verifies", () => {
    const oauth = "oauth-fallback-secret-32-chars!!!!";
    withEnv({ SESSION_SECRET: undefined, OAUTH_CLIENT_SECRET: oauth }, () => {
        resetSessionSecretWarningForTest();
        const token = mintSiteSession(alice);
        expect(readSiteSession(token)).toBe(alice);
    });
});

test("SESSION_SECRET fallback warns once per process", () => {
    const oauth = "oauth-warn-once-secret-32-chars!!!!";
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
        withEnv(
            { SESSION_SECRET: undefined, OAUTH_CLIENT_SECRET: oauth },
            () => {
                resetSessionSecretWarningForTest();
                mintSiteSession(alice);
                mintSiteSession(alice);
            },
        );
        const lines = warnSpy.mock.calls.map((args) => String(args[0]));
        expect(
            lines.filter((line) => line.includes("SESSION_SECRET is unset")),
        ).toHaveLength(1);
    } finally {
        warnSpy.mockRestore();
    }
});

test("short SESSION_SECRET throws", () => {
    withEnv({ SESSION_SECRET: "too-short" }, () => {
        expect(() => mintSiteSession(alice)).toThrow(/at least 32/);
    });
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

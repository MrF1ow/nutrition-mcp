import { test, expect, describe } from "bun:test";
import { SITE_LOCALES } from "./routes.js";
import { SITE_COOKIE } from "./site-session.js";

// index.ts calls createOAuthRouter() at module scope, which throws without
// OAuth env. Same dance as src/index.test.ts: set defaults before the
// dynamic import, ||= so a real .env still wins.
process.env.OAUTH_CLIENT_ID ||= "test-client-id";
process.env.OAUTH_CLIENT_SECRET ||= "test-client-secret";

const { app } = await import("./index.js");

const MARKETING_GENERATORS = [
    "scripts/gen-index.ts",
    "scripts/gen-tools.ts",
    "scripts/gen-legal.ts",
    "scripts/gen-alternatives.ts",
    "scripts/gen-sitemap.ts",
] as const;

const MARKETING_PATHS = [
    "/tools",
    "/privacy",
    "/terms",
    "/alternatives",
    "/myfitnesspal-mcp",
    "/de",
    "/de/tools",
    "/llms.txt",
    "/sitemap.xml",
    "/api/stats",
    "/api/patreon-posts",
    "/map-data.json",
    "/og.png",
    "/apple-touch-icon.png",
] as const;

function loginPath(locale: (typeof SITE_LOCALES)[number]): string {
    return locale === "en"
        ? "./public/login.html"
        : `./public/${locale}/login.html`;
}

async function expectNotMarketingHtml(path: string): Promise<void> {
    const r = await app.request(`http://x${path}`);
    expect({
        path,
        status: r.status,
        location: r.headers.get("location"),
    }).toEqual({
        path,
        status: 404,
        location: null,
    });
    const body = await r.text();
    expect(body, path).not.toMatch(/<!doctype html/i);
    expect(body, path).not.toContain("Nutrition Facts");
}

describe("marketing HTTP is gone", () => {
    test("former marketing paths 404 and are not a redirect to /authorize", async () => {
        for (const path of MARKETING_PATHS) {
            await expectNotMarketingHtml(path);
        }
    });

    test("GET / without a session is login HTML, not marketing and not /authorize", async () => {
        const r = await app.request("http://x/");
        expect(r.status).toBe(200);
        expect(r.headers.get("location")).toBeNull();
        const body = await r.text();
        expect(body).toMatch(/<!doctype html/i);
        expect(body).toContain('action="/approve"');
        expect(body).not.toContain("MCP Tools");
        expect(r.headers.get("location")).toBeNull();
        expect(body).toContain('href="/"');
        expect(body).toContain("/?locale=");
        expect(body).not.toContain("response_type=code");
        expect(body).not.toContain("/authorize/google");
        expect(body).not.toContain("Continue with Google");
        expect(body).not.toContain("created automatically");
    });

    test("GET / with a bad site cookie is still login HTML", async () => {
        const r = await app.request("http://x/", {
            headers: { cookie: `${SITE_COOKIE}=not-a-session` },
        });
        expect(r.status).toBe(200);
        const body = await r.text();
        expect(body).toContain('action="/approve"');
        expect(body).not.toContain("widget-frame");
    });
});

describe("site session HTTP", () => {
    test("GET /logout clears the site cookie and returns to /", async () => {
        const r = await app.request("http://x/logout");
        expect(r.status).toBe(302);
        expect(r.headers.get("location")).toBe("/");
        const cookie = r.headers.get("set-cookie") ?? "";
        expect(cookie).toContain(`${SITE_COOKIE}=`);
        expect(cookie).toContain("Max-Age=0");
    });
});

describe("runtime surfaces that stay", () => {
    test("GET /health is ok", async () => {
        const r = await app.request("http://x/health");
        expect(r.status).toBe(200);
        expect(await r.text()).toBe("ok");
    });

    test("login assets still answer and site.js does not poll /api/stats", async () => {
        const css = await app.request("http://x/styles.css");
        expect(css.status).toBe(200);
        const js = await app.request("http://x/site.js");
        expect(js.status).toBe(200);
        const siteJs = await js.text();
        expect(siteJs).not.toContain("/api/stats");
        expect(siteJs).not.toContain("data-live-badge");
    });

    test("GET /robots.txt disallows crawlers", async () => {
        const r = await app.request("http://x/robots.txt");
        expect(r.status).toBe(200);
        expect(await r.text()).toContain("Disallow: /");
    });

    test("unauthenticated POST /mcp is still 401", async () => {
        const r = await app.request("http://x/mcp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        });
        expect(r.status).toBe(401);
    });

    test("GET /authorize without OAuth params is JSON 400, not login HTML", async () => {
        const r = await app.request("http://x/authorize");
        expect(r.status).toBe(400);
        expect(r.headers.get("content-type") ?? "").toContain(
            "application/json",
        );
        expect(await r.text()).not.toMatch(/<!doctype html/i);
    });

    test("GET /authorize with a valid OAuth query returns login HTML", async () => {
        const r = await app.request(
            `http://x/authorize?response_type=code&client_id=${encodeURIComponent(
                process.env.OAUTH_CLIENT_ID!,
            )}&redirect_uri=https://example.com/cb&state=xyz`,
        );
        expect(r.status).toBe(200);
        const html = await r.text();
        expect(html).toMatch(/<!doctype html/i);
        expect(html).toContain('action="/approve"');
        expect(html).toContain("session_id");
        expect(html).not.toContain("{{SESSION_ID}}");
        expect(html).not.toContain('href="/terms"');
        expect(html).not.toContain('href="/privacy"');
        expect(html).not.toMatch(/<a class="brand"[^>]*href="\/"/);
    });
});

describe("cannot republish the marketing site", () => {
    test("gen:all is login-only and the marketing generators are gone", async () => {
        const pkg = (await Bun.file("./package.json").json()) as {
            scripts: Record<string, string>;
        };
        expect(pkg.scripts["gen:pages"]).toBe("bun run scripts/gen-login.ts");
        expect(pkg.scripts["gen:all"]).toBe("bun run gen:pages");
        for (const path of MARKETING_GENERATORS) {
            expect(await Bun.file(path).exists(), path).toBe(false);
        }
        const genLogin = await Bun.file("./scripts/gen-login.ts").text();
        expect(genLogin).toContain("removeStaleMarketingHtml");
        expect(genLogin).toContain("public/index.html");
        expect(genLogin).toContain("public/llms.txt");
    });

    test("login templates are present (CI/dev run gen:all before tests)", async () => {
        for (const locale of SITE_LOCALES) {
            const path = loginPath(locale);
            expect(await Bun.file(path).exists(), path).toBe(true);
        }
    });

    test("bun run gen:all does not write marketing HTML", async () => {
        await Bun.write(
            "public/index.html",
            "<!doctype html><title>stale marketing</title>",
        );
        const proc = Bun.spawn(["bun", "run", "gen:all"], {
            stdout: "pipe",
            stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        expect(exitCode, `${stderr}\n${stdout}`).toBe(0);
        for (const file of [
            "public/index.html",
            "public/tools.html",
            "public/privacy.html",
            "public/terms.html",
            "public/alternatives/index.html",
            "public/sitemap.xml",
            "public/llms.txt",
        ]) {
            expect(await Bun.file(file).exists(), file).toBe(false);
        }
        expect(await Bun.file("public/login.html").exists()).toBe(true);
    });
});

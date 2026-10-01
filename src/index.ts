import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { beginSiteLogin, createOAuthRouter } from "./oauth.js";
import {
    createHouseholdFormHtml,
    forbiddenDashboardHtml,
    renderDashboardPage,
    renderFridgeInventoryPage,
    renderHouseholdSettingsRoute,
    renderSettingsAccountPage,
    renderStubPage,
} from "./dashboard.js";
import { parseAppearanceInput } from "./app/shell.js";
import { parseNutritionPrefsInput } from "./app/settings/page.js";
import {
    authenticateBearer,
    rateLimit,
    banRepeatAuthFailures,
} from "./middleware.js";
import { handleMcp, closeMcpHandler } from "./mcp.js";
import { startExportCleanup } from "./export.js";
import { registerDiscoveryRoutes } from "./discovery.js";
import { maskIp } from "./net.js";
import { warmWidgets } from "./widgets.js";
import {
    clearSiteCookieHeader,
    readSiteSession,
    SITE_COOKIE,
} from "./site-session.js";
import {
    HouseholdAlreadyExistsError,
    parseMemberInput,
    requireOwner,
} from "./household.js";
import {
    addHouseholdMemberForHousehold,
    createHouseholdForCaller,
    getHouseholdConfig,
    getHouseholdMembership,
    liveFridgeStore,
    liveRulesStore,
    liveSettingsStore,
    rotateHouseholdMcpToken,
    updateHouseholdConfig,
    updateMemberDisplayName,
    upsertProfile,
} from "./supabase.js";
import { lookupBarcode, type FoodResult } from "./foods.js";
import { PICKER_DEMO_FOODS } from "./app/components/food-picker.js";
import {
    addFoodByBarcode,
    addLocation,
    addManualFood,
    addSupply,
    deleteItem,
    deleteLocation,
    FridgeInputError,
    moveItem,
    updateItemQuantity,
} from "./fridge.js";
import {
    createGroceryStore,
    renameSection,
    setHouseholdLocation,
    SettingsInputError,
} from "./settings.js";
import {
    addAllergen,
    addDislike,
    addPersonRule,
    addStoreRule,
    RulesInputError,
} from "./rules.js";
import {
    generateHouseholdToken,
    hashHouseholdToken,
    householdTokenHashHex,
} from "./household-token.js";
import { validateTz } from "./tz.js";

const app = new Hono();

// Access log — records every non-health HTTP request (method, path, status,
// duration, masked client subnet) so traffic that never reaches a tool handler
// — and is therefore invisible to tool analytics — is still attributable in the
// runtime logs: unauthenticated /mcp probes (401), rate-limited hits (429),
// OAuth discovery crawls, vuln scanners. Registered first so it runs outermost
// and observes the final response status. /health is skipped to keep the
// platform's frequent health checks from evicting real traffic from the buffer.
// Requests from IPs banned for repeated auth failures are skipped too — they are
// announced once by a [ban] line and would otherwise dominate the log.
app.use("*", async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path === "/health") return next();
    const start = performance.now();
    await next();
    if (c.get("suppressAccessLog")) return;
    const ms = Math.round(performance.now() - start);
    const ip = maskIp(c.req.header("x-forwarded-for"));
    // /mcp serves two protocol eras from one endpoint, and the only way to know
    // when the 2025-11-25 leg can be retired is to count who still uses it.
    // handleMcp publishes the era the SDK actually negotiated (not a guess from
    // headers); requests refused before the factory runs carry none, and simply
    // omit the field.
    const era = c.get("mcpEra");
    // Which client is on which era. The era alone cannot tell a Claude surface
    // from a third-party MCP client sharing an IP range, and that is the
    // question the legacy retirement actually turns on. Absent when the
    // protocol did not carry it — see the note on mcpClient in middleware.ts.
    const client = c.get("mcpClient");
    console.log(
        `[req] ${c.req.method} ${path} ${c.res.status} ${ms}ms ip=${ip}${era ? ` era=${era}` : ""}${client ? ` client=${client}` : ""}`,
    );
});

// Security headers
app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    if (!c.res.headers.get("Content-Security-Policy")) {
        c.header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://www.google.com https://*.googletagmanager.com https://api.github.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' https://www.googletagmanager.com; frame-ancestors 'none'",
        );
    }
    c.header("Referrer-Policy", "no-referrer");
});

// Body limit
app.use(
    "*",
    bodyLimit({
        maxSize: 1024 * 1024,
        onError: (c) => c.json({ error: "payload_too_large" }, 413),
    }),
);

// CORS
app.use(
    "*",
    cors({
        origin: (origin) => {
            if (!origin) return null;
            if (
                origin.match(/^https?:\/\/localhost(:\d+)?$/) ||
                origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/)
            ) {
                return origin;
            }
            const allowed =
                process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ??
                [];
            return allowed.includes(origin) ? origin : null;
        },
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
        // allowHeaders is deliberately omitted so Hono reflects the preflight's
        // Access-Control-Request-Headers verbatim (and appends
        // Vary: Access-Control-Request-Headers). A static list structurally
        // cannot work here: the 2026-07-28 revision defines an open-ended
        // Mcp-Param-* family (sent whenever a tool declares x-mcp-header), and
        // CORS allow-lists match exact names, not prefixes — so a pinned list
        // silently breaks any such tool for browser clients. Reflection adds no
        // exposure in this configuration: `origin` above is a strict allowlist,
        // so only origins we already trust get an Allow-Origin at all, and
        // credentials is false, so no cookies or Authorization are attached by
        // the browser on our behalf.
        exposeHeaders: [
            "Mcp-Session-Id",
            "Mcp-Protocol-Version",
            "Content-Type",
        ],
        credentials: false,
        maxAge: 86400,
    }),
);

// Shutdown gate. The signal handlers at the bottom of this file flip
// `shuttingDown`, and from that instant every request is refused here — before
// auth, before rate limiting, before any route. This gate, not closeMcpHandler,
// is what makes a deploy clean: closing the SDK handler flips it to "closed"
// while Bun.serve keeps accepting connections, so without the gate every POST
// /mcp in the shutdown window fell through to the onError catch-all as
// {"error":"internal_server_error"} 500 ("This MCP handler has been closed").
// A 500 reads to a connector as a tool failure; 503 + Retry-After reads as
// "this instance is going away, come back" — which is the truth, and on a
// DigitalOcean deploy (SIGTERM) that window hits real users.
// Registered after CORS so the refusal still carries Allow-Origin (a browser
// client sees the 503 rather than an opaque CORS error) and is still access
// logged. OPTIONS preflights never reach it: cors() answers those itself.
let shuttingDown = false;

// Exported for src/index.test.ts. The gate's entire value is WHERE it sits — it
// must run before authenticateBearer and before the /mcp route, which only the
// real `app` can demonstrate. The test flips the flag directly rather than
// calling shutdown(), which would exit the test runner.
export function setShuttingDownForTest(value: boolean): void {
    shuttingDown = value;
}

app.use("*", async (c, next) => {
    if (!shuttingDown) return next();
    const path = new URL(c.req.url).pathname;
    if (path === "/mcp") {
        // /mcp clients speak JSON-RPC, and the flat {"error": …} body used
        // elsewhere in this file is not something an MCP client can surface —
        // it reports a bare transport failure with no reason. Mirror the
        // JSON-RPC error envelope handleMcp's own 405 returns so the client
        // gets a readable message. `id` is null because the body is
        // deliberately not read here; the point of the gate is to answer
        // without doing work.
        return c.json(
            {
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32000,
                    message: "Server is shutting down, retry shortly",
                },
            },
            503,
            { "Retry-After": "1" },
        );
    }
    // /health is gated too, on purpose: a health check that starts failing is
    // how the platform's load balancer learns to stop routing here, which is
    // exactly what draining wants. Everything else (OAuth, unauthenticated
    // probes) gets the flat {"error": …} shape the 413 and 500 responses in
    // this file already use.
    return c.json({ error: "shutting_down" }, 503, { "Retry-After": "1" });
});

// OAuth discovery metadata (MCP spec requirement) — protected-resource and
// authorization-server documents, served at the root and at the path-folded
// variants clients derive from the /mcp endpoint. See src/discovery.ts.
registerDiscoveryRoutes(app);

// Glama connector ownership verification. Glama polls this file and matches the
// maintainer email against the Glama account email to claim the listing.
app.get("/.well-known/glama.json", (c) => {
    return c.json({
        $schema: "https://glama.ai/mcp/schemas/connector.json",
        maintainers: [{ email: "akutishevsky@gmail.com" }],
    });
});

// OAuth routes
app.route("/", createOAuthRouter());

// MCP endpoint (protected). banRepeatAuthFailures runs first so a client stuck
// in a failed-auth retry loop is rejected before any token verification.
app.all(
    "/mcp",
    banRepeatAuthFailures,
    authenticateBearer,
    rateLimit,
    handleMcp,
);

function siteUserId(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${SITE_COOKIE}=([^;]+)`),
    );
    if (!match?.[1]) return null;
    return readSiteSession(decodeURIComponent(match[1]));
}

app.get("/", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const page = await renderDashboardPage(userId, c.req.query("member"));
    return c.html(page.html, page.status);
});

app.get("/nutrition", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    return c.redirect("/");
});

app.get("/fridge", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const page = await renderFridgeInventoryPage(userId);
    return c.html(page.html, page.status);
});

async function fridgeActor(c: {
    req: {
        header: (name: string) => string | undefined;
        query: (k: string) => string | undefined;
    };
}) {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return { userId: null as string | null, member: null };
    return {
        userId,
        member: await getHouseholdMembership(userId),
    };
}

function formText(body: Record<string, string | File>, key: string): string {
    const value = body[key];
    return typeof value === "string" ? value : "";
}

function formAmount(body: Record<string, string | File>, key: string): number {
    return Number(formText(body, key));
}

function demoFridgeFood(barcode: string): FoodResult | null {
    const demo = PICKER_DEMO_FOODS.find((food) => food.barcode === barcode);
    if (!demo) return null;
    return {
        name: demo.name,
        brand: demo.brand,
        serving: null,
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        sugar_g: null,
        alcohol_g: null,
        nutriscore_grade: null,
        nova_group: null,
        source: `off:${demo.barcode}`,
        source_name: "openfoodfacts",
        barcode: demo.barcode,
    };
}

async function fridgeBarcodeLookup(
    barcode: string,
): Promise<FoodResult | null> {
    const demo = demoFridgeFood(barcode);
    if (demo) return demo;
    try {
        return await lookupBarcode(barcode);
    } catch {
        return null;
    }
}

async function fridgeFormError(userId: string, err: unknown) {
    const message =
        err instanceof FridgeInputError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update the fridge.";
    const page = await renderFridgeInventoryPage(userId, message);
    return { html: page.html, status: 400 as const };
}

app.post("/fridge/locations", async (c) => {
    const { userId, member } = await fridgeActor(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (member == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await addLocation(
            liveFridgeStore(),
            member.householdId,
            formText(body, "name"),
        );
    } catch (err) {
        const page = await fridgeFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/fridge");
});

app.post("/fridge/locations/:id/delete", async (c) => {
    const { userId, member } = await fridgeActor(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (member == null) return c.html(forbiddenDashboardHtml(), 403);
    await deleteLocation(
        liveFridgeStore(),
        member.householdId,
        c.req.param("id"),
    );
    return c.redirect("/fridge");
});

app.post("/fridge/items", async (c) => {
    const { userId, member } = await fridgeActor(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (member == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    const store = liveFridgeStore();
    const locationId = formText(body, "location_id");
    const kind = formText(body, "kind");
    const amount = formAmount(body, "qty_amount");
    try {
        if (kind === "supply") {
            await addSupply(store, {
                householdId: member.householdId,
                locationId,
                name: formText(body, "name"),
                amount,
                unit: formText(body, "qty_unit"),
            });
        } else if (formText(body, "barcode")) {
            await addFoodByBarcode(
                store,
                {
                    householdId: member.householdId,
                    locationId,
                    barcode: formText(body, "barcode"),
                    amount,
                },
                { lookup: fridgeBarcodeLookup },
            );
        } else {
            await addManualFood(store, {
                householdId: member.householdId,
                locationId,
                name: formText(body, "food_name"),
                amount,
            });
        }
    } catch (err) {
        const page = await fridgeFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/fridge");
});

app.post("/fridge/items/:id/delete", async (c) => {
    const { userId, member } = await fridgeActor(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (member == null) return c.html(forbiddenDashboardHtml(), 403);
    await deleteItem(liveFridgeStore(), member.householdId, c.req.param("id"));
    return c.redirect("/fridge");
});

app.post("/fridge/items/:id", async (c) => {
    const { userId, member } = await fridgeActor(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (member == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    const store = liveFridgeStore();
    const itemId = c.req.param("id");
    try {
        await updateItemQuantity(store, member.householdId, itemId, {
            amount: formAmount(body, "qty_amount"),
            unit: formText(body, "qty_unit"),
        });
        const locationId = formText(body, "location_id");
        if (locationId) {
            await moveItem(store, member.householdId, itemId, locationId);
        }
    } catch (err) {
        const page = await fridgeFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/fridge");
});

app.get("/grocery", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const page = await renderStubPage(userId, "grocery");
    return c.html(page.html, page.status);
});

app.get("/recipes", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const page = await renderStubPage(userId, "recipes");
    return c.html(page.html, page.status);
});

app.get("/settings", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const page = await renderSettingsAccountPage(userId);
    return c.html(page.html, page.status);
});

app.get("/settings/household", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const page = await renderHouseholdSettingsRoute(userId);
    return c.html(page.html, page.status);
});

app.post("/settings", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const member = await getHouseholdMembership(userId);
    if (member == null) {
        return c.html(forbiddenDashboardHtml(), 403);
    }
    const body = await c.req.parseBody();
    const group = formText(body, "group");
    if (group === "nutrition") {
        const prefs = parseNutritionPrefsInput({
            timezone: body.timezone,
            locale: body.locale,
            preferred_weight_unit: body.preferred_weight_unit,
            widgets_enabled: formText(body, "widgets_enabled") === "true",
            alcohol_tracking_enabled:
                formText(body, "alcohol_tracking_enabled") === "true",
            preferred_drink_unit: body.preferred_drink_unit,
        });
        if (prefs.timezone) {
            if (!validateTz(prefs.timezone)) {
                const page = await renderSettingsAccountPage(
                    userId,
                    "Enter a valid IANA timezone.",
                );
                return c.html(page.html, 400);
            }
        } else {
            delete prefs.timezone;
        }
        await upsertProfile(userId, prefs);
        return c.redirect("/settings");
    }
    const appearance = parseAppearanceInput({
        theme: body.theme,
        accent_swatch: body.accent_swatch,
    });
    await upsertProfile(userId, appearance);
    const displayName = formText(body, "display_name").trim();
    if (displayName) {
        await updateMemberDisplayName(member.householdId, userId, displayName);
    }
    return c.redirect("/settings");
});

app.post("/create-household", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const body = await c.req.parseBody();
    const name = String(body.household_name ?? "").trim();
    const displayName = String(body.display_name ?? "").trim();
    if (!name || !displayName) {
        return c.html(
            createHouseholdFormHtml("Enter a household name and your name."),
            400,
        );
    }
    try {
        await createHouseholdForCaller(userId, name, displayName);
    } catch (err) {
        if (err instanceof HouseholdAlreadyExistsError) {
            return c.html(forbiddenDashboardHtml(), 403);
        }
        const message =
            err instanceof Error
                ? err.message
                : "Could not create the household.";
        return c.html(createHouseholdFormHtml(message), 400);
    }
    return c.redirect("/");
});

app.post("/settings/household", async (c) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const member = await getHouseholdMembership(userId);
    const owner = requireOwner(member);
    if (!owner.ok) {
        return c.html(forbiddenDashboardHtml(), 403);
    }
    const body = await c.req.parseBody();
    const parsed = parseMemberInput({
        display_name: String(body.display_name ?? ""),
        password: String(body.password ?? ""),
        email: String(body.email ?? ""),
        username: String(body.username ?? ""),
    });
    if (!parsed.ok) {
        const page = await renderHouseholdSettingsRoute(userId, {
            error: parsed.error,
        });
        return c.html(page.html, 400);
    }
    const added = await addHouseholdMemberForHousehold(
        owner.member.householdId,
        parsed.value,
    );
    if (!added.ok) {
        const page = await renderHouseholdSettingsRoute(userId, {
            error: added.error,
        });
        return c.html(page.html, 400);
    }
    return c.redirect("/settings/household");
});

async function householdOwner(c: {
    req: {
        header: (name: string) => string | undefined;
        query: (k: string) => string | undefined;
    };
}) {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return { userId: null as string | null, owner: null };
    const member = await getHouseholdMembership(userId);
    const check = requireOwner(member);
    return {
        userId,
        owner: check.ok ? check.member : null,
        member,
    };
}

async function householdFormError(userId: string, err: unknown) {
    const message =
        err instanceof SettingsInputError || err instanceof RulesInputError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update household settings.";
    const page = await renderHouseholdSettingsRoute(userId, { error: message });
    return { html: page.html, status: 400 as const };
}

app.post("/settings/household/name", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    const name = formText(body, "name").trim();
    if (!name) {
        const page = await renderHouseholdSettingsRoute(userId, {
            error: "Enter a household name.",
        });
        return c.html(page.html, 400);
    }
    const config = await getHouseholdConfig(owner.householdId);
    await updateHouseholdConfig(owner.householdId, { ...config, name });
    return c.redirect("/settings/household");
});

app.post("/settings/household/location", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    await setHouseholdLocation(
        liveSettingsStore(),
        owner.householdId,
        formText(body, "location"),
    );
    return c.redirect("/settings/household");
});

app.post("/settings/household/rotate-token", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const token = generateHouseholdToken();
    await rotateHouseholdMcpToken({
        householdId: owner.householdId,
        tokenHashHex: householdTokenHashHex(hashHouseholdToken(token)),
        issuedBy: owner.userId,
    });
    const page = await renderHouseholdSettingsRoute(userId, {
        issuedToken: token,
    });
    return c.html(page.html, 200);
});

app.post("/settings/household/stores", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await createGroceryStore(
            liveSettingsStore(),
            owner.householdId,
            formText(body, "name"),
        );
    } catch (err) {
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

app.post("/settings/household/sections/:id", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await renameSection(
            liveSettingsStore(),
            owner.householdId,
            c.req.param("id"),
            formText(body, "name"),
        );
    } catch (err) {
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

app.post("/settings/household/stores/:id/rules", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await addStoreRule(liveRulesStore(), {
            householdId: owner.householdId,
            storeId: c.req.param("id"),
            body: formText(body, "body"),
        });
    } catch (err) {
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

app.post("/settings/household/members/:userId/allergens", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await addAllergen(liveRulesStore(), {
            householdId: owner.householdId,
            userId: c.req.param("userId"),
            allergen: formText(body, "allergen"),
            otherLabel: formText(body, "other_label"),
        });
    } catch (err) {
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

app.post("/settings/household/members/:userId/dislikes", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await addDislike(liveRulesStore(), {
            householdId: owner.householdId,
            userId: c.req.param("userId"),
            displayName: formText(body, "display_name"),
        });
    } catch (err) {
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

app.post("/settings/household/members/:userId/rules", async (c) => {
    const { userId, owner } = await householdOwner(c);
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    if (owner == null) return c.html(forbiddenDashboardHtml(), 403);
    const body = await c.req.parseBody();
    try {
        await addPersonRule(liveRulesStore(), {
            householdId: owner.householdId,
            userId: c.req.param("userId"),
            body: formText(body, "body"),
        });
    } catch (err) {
        const page = await householdFormError(userId, err);
        return c.html(page.html, page.status);
    }
    return c.redirect("/settings/household");
});

app.get("/logout", (c) => {
    const secure =
        c.req.header("x-forwarded-proto") === "https" ||
        new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", clearSiteCookieHeader(secure));
    return c.redirect("/");
});

// Login assets. Marketing HTML, sitemap, llms.txt, and landing APIs are
// gone; leftover files on disk must not become routes (a registered path
// that reads a missing file 500s).
app.get("/robots.txt", async (c) => {
    return c.body(await Bun.file("./public/robots.txt").text(), 200, {
        "Content-Type": "text/plain",
    });
});
app.get("/styles.css", async (c) => {
    const file = Bun.file("./public/styles.css");
    return c.body(await file.text(), 200, { "Content-Type": "text/css" });
});
app.get("/app.css", async (c) => {
    const file = Bun.file("./public/app.css");
    return c.body(await file.text(), 200, { "Content-Type": "text/css" });
});
app.get("/site.js", async (c) => {
    const file = Bun.file("./public/site.js");
    return c.body(await file.text(), 200, {
        "Content-Type": "text/javascript; charset=utf-8",
    });
});
app.get("/favicon.ico", async (c) => {
    try {
        const file = Bun.file("./public/favicon.ico");
        return c.body(await file.arrayBuffer(), 200, {
            "Content-Type": "image/x-icon",
        });
    } catch {
        return c.notFound();
    }
});

// Health check
app.get("/health", (c) => c.text("ok"));

// Error handler
app.onError((_err, c) => {
    console.error("Unhandled error:", _err);
    return c.json({ error: "internal_server_error" }, 500);
});

const port = parseInt(process.env.PORT || "8080");

// Boot side effects run only when this file IS the entrypoint. src/index.test.ts
// imports `app` to pin the shutdown gate's position in the middleware chain, and
// an import must not start the export-sweep interval (which would hit Supabase
// on a timer and hold the test process open) or register signal handlers.
// `bun run src/index.ts` still takes this branch — verified: import.meta.main is
// true for the entrypoint and false under `bun test`.
if (import.meta.main) {
    console.log(`Nutrition MCP server listening on 0.0.0.0:${port}`);

    // Assemble every MCP Apps widget from its source partials up front, so a
    // broken @include/partial fails fast at boot rather than on a client's
    // first tool call.
    await warmWidgets();

    // Periodically delete expired meal-export files from the storage bucket.
    startExportCleanup();

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

// Exit cleanly on shutdown signals (e.g. deploys). /mcp is stateless — no
// server-side sessions are held — so the only thing worth sequencing is the
// order of the two steps below.
//
// Setting `shuttingDown` is the load-bearing one: it arms the 503 gate above,
// which is what actually stops new work and what keeps a deploy from serving
// 500s. closeMcpHandler is not a general drain and must not be described as
// one — it aborts only 2026-era exchanges the SDK handler is tracking, so
// legacy-era (2025-11-25) requests in flight are unaffected either way. The
// gate runs first precisely because close() cannot be relied on to cover them.
//
// The 2s bound exists so a single wedged exchange cannot hold the process past
// the platform's grace period and turn a clean stop into a SIGKILL, and the
// .catch is there because a rejected close() would otherwise surface as an
// unhandled rejection on the way out.
function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);
    void Promise.race([
        closeMcpHandler(),
        new Promise((r) => setTimeout(r, 2000)),
    ])
        .catch((err) => console.error("Error closing MCP handler:", err))
        .finally(() => process.exit(0));
}
// Exported for src/index.test.ts, which drives the real route table through
// app.request(). Bun serves from the default export below.
export { app };

export default {
    port,
    hostname: "0.0.0.0",
    // Long-lived MCP streams (StreamableHTTP GET/SSE) can idle between events;
    // Bun's 10s default closes them and logs "request timed out after 10
    // seconds". Raise it so legitimate streaming connections aren't severed.
    idleTimeout: 120,
    fetch: app.fetch,
};

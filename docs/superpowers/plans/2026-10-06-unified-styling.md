# Unified Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the household web app, the login page and the in-chat widgets on one design system: the widget system's tokens and components, served to the app as a single assembled `/app.css`.

**Architecture:** The widget partials in `public/widgets/src/shared/` stay the single source of truth. A new source file `public/app/app.css` `@include`s them, and `getAppCss()` in `src/widgets.ts` assembles it with the same resolver the widgets use. Native form controls inside a `.native` container get the widget control look through zero-specificity `:where(.native …)` selectors added to `form.css`, so app markup needs no per-control classes and component classes (`.btn-primary`, `.btn-danger`) always win. Page markup then moves onto `.panel`, a small list/row vocabulary and `<details class="more">` disclosures. Theme becomes System / Light / Dark. The accent picker, the old marketing stylesheet, `site.js` and the web fonts are removed.

**Tech Stack:** Bun, TypeScript, Hono, plain CSS (no library, no build step), `bun:test`, headless Chromium for visual checks.

## Global Constraints

- No new dependencies. No CSS framework, no PostCSS, no Tailwind.
- English only. Do not restore locale switchers, `set_language`, or `src/copy/*.<locale>.ts`.
- Do not add a Foodable logo. Keep `public/favicon.ico`.
- Brand accent is the widget green: `--accent: #4a7c59` (light) / `#6ab98a` (dark), from `public/widgets/src/shared/tokens.css`. No other accent anywhere.
- Fonts: the system stack from `base.css` only. No web fonts.
- Widgets stay self-contained (inline CSS + JS, zero network requests). Do not add `<link>` or `<script src>` to any widget template.
- Schema: no migration. `profiles.theme` already allows `null`, which now means "system". `profiles.accent_swatch` stays in the database and in the `Profile` type, but nothing reads or writes it after Task 3. Dropping the column is a later contract migration, not part of this plan (expand / backfill / switch / contract).
- Keep every class name that a test pins exactly. In particular: `class="quantity-field"`, `class="food-picker"`, `class="food-picker-search"` (as the start of the search form tag), `class="member-multi-select"`, `class="grocery-add-store"`, `class="error-banner"`, `class="already-have-tag"`, `class="empty-fridge"`, `class="empty-grocery"`, `class="empty-recipes"`, `class="empty-recipe-store"`, `class="add-item-prompt"`, `class="fridge-item"`, `class="grocery-line"`, `class="recipe-card"`, `class="recipe-ingredient"`, `class="dislike-note"`, `class="peer-note"`, `class="bottom-nav"`, `class="store-section-list"`. Do not append classes to these elements; style them by their class name instead.
- Keep pinned text: `<h1>…</h1>` page titles, `<h2>STORE NAME</h2>` on grocery stores, `<h3>Add food</h3>` (grocery and fridge), `<h3>Add supply</h3>` (fridge), "Add household member".
- Page sources (`src/web/pages/*.ts`, `src/app/nutrition.ts`) must not contain `class="fridge-item"`, `class="recipe-card"`, `class="recipe-ingredient"`, `class="grocery-line…"`, `class="error-banner"` or the `empty-*` classes. Those live only in `src/web/components/page-markup.ts` (`src/web/components/shared-import.test.ts` enforces this).
- The food picker's inline script and its hit markup (`'<li><button type="submit" name="food_id" …'`) are pinned by `shared-import.test.ts`. Do not change `pickerScript()`.
- Run `bun run format` before every commit. CI runs `bun run format:check`, `bun run typecheck` and `bun test`.
- Commits end with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Shipping

Four PRs, each independently mergeable:

| PR                     | Tasks | What changes for the user                                                                                                                        |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. One stylesheet      | 1–2   | App controls, panels and lists take the widget look; the hidden food-picker tabs stop showing; still the sky accent (the shell still injects it) |
| 2. Theme               | 3–4   | Green everywhere, System/Light/Dark theme, swatch picker gone, widgets line up with the page and lose the chat-only footer                       |
| 3. Page layouts        | 5–9   | Compact rows, edit-behind-disclosure, segmented picker tabs, tidy nutrition log                                                                  |
| 4. Login and leftovers | 10–11 | Login on the shared sheet, marketing CSS/JS/fonts deleted, docs updated                                                                          |

## File Structure

| Path                                                                                  | Responsibility                                                                          | Tasks                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `public/app/app.css` (create, from `git mv public/app.css`)                           | App stylesheet source: `@include`s the shared partials, then app-only layout            | 1, 2, 3, 4, 5, 6, 7, 9, 10 |
| `src/widgets.ts` (modify)                                                             | `getAppCss()` assembler; `withWidgetData` theme-only injection                          | 1, 3                       |
| `src/index.ts` (modify)                                                               | `/app.css` route; CSP `img-src data:`; delete `/styles.css`, `/site.js`, `/fonts/:file` | 1, 2, 10                   |
| `scripts/app-preview.ts` (create)                                                     | Renders every app page with fixture data, light and dark; optional screenshots          | 1                          |
| `public/widgets/src/shared/form.css` (modify)                                         | `:where(.native …)` hooks so native controls get the control look                       | 2                          |
| `public/widgets/src/shared/seg.css` (modify)                                          | `.seg-btn[aria-selected="true"]` as an alias of `.active`                               | 2                          |
| `public/widgets/src/shared/bridge.js` (modify)                                        | No chat footer when data was seeded by the web app                                      | 4                          |
| `public/widgets/STYLE_GUIDE.md` (modify)                                              | Documents the app consumer and the `.native` hook                                       | 2                          |
| `src/app/shell.ts` (modify)                                                           | `ThemePref`, `htmlOpen`, `appHead`; no accent                                           | 2, 3                       |
| `src/app/nutrition.ts` (modify)                                                       | Theme-only chrome; compact log panel                                                    | 3, 9                       |
| `src/web/components/settings-nav.ts` (create)                                         | Account / Household / Foods sub-navigation                                              | 8                          |
| `src/web/components/page-markup.ts` (modify)                                          | Row helpers: fridge item, grocery line, recipe card, ingredient, expiring strip         | 5, 6, 7                    |
| `src/web/components/food-picker.ts` (modify)                                          | Segmented tabs, primary submit buttons                                                  | 5                          |
| `src/web/pages/*.ts`, `src/app/settings/household.ts` (modify)                        | Page layouts                                                                            | 2, 3, 5–8                  |
| `src/web/dashboard.ts` (modify)                                                       | Settings builder without swatch; bare pages on `/app.css`                               | 3, 11                      |
| `src/web/routes/settings.ts` (modify)                                                 | Theme-only appearance save                                                              | 3                          |
| `scripts/gen-login.ts`, `scripts/site-partials.ts`, `src/copy/login.ts` (modify)      | Login on `/app.css`                                                                     | 10                         |
| `public/styles.css`, `public/site.js`, `public/fonts/`, `src/copy/chrome.ts` (delete) | Marketing leftovers                                                                     | 10                         |
| `CLAUDE.md` (modify)                                                                  | App styling rules                                                                       | 10, 11                     |

---

## PR 1 — One stylesheet

### Task 1: Serve `/app.css` through the widget assembler, and add a page preview

A pure move: `public/app.css` becomes `public/app/app.css` and is served through `getAppCss()`. The served bytes do not change yet. The preview script is used for visual checks in every later task.

**Files:**

- Move: `public/app.css` → `public/app/app.css`
- Modify: `src/widgets.ts` (add `getAppCss`, extend `warmWidgets`)
- Modify: `src/index.ts` (the `/app.css` route and the `./widgets.js` import)
- Create: `scripts/app-preview.ts`
- Modify: `package.json` (add `preview:app`)
- Modify: `.gitignore` (add `/tmp/`)
- Create: `src/app-css.test.ts`
- Modify: `src/public-site.test.ts`

**Interfaces:**

- Produces: `export const APP_CSS_SOURCE = "./public/app/app.css"` and `export async function getAppCss(): Promise<string>` in `src/widgets.ts`. Later tasks edit `public/app/app.css` and rely on `getAppCss()` expanding its `/*@include shared/…@*/` markers against `public/widgets/src/`.
- Produces: `bun run preview:app [--shots]`, which writes `tmp/app-preview/<page>-<light|dark>.html` (and `.png` with `--shots`) for the pages `nutrition`, `fridge`, `grocery`, `recipes`, `recipe`, `settings`, `household`, `foods`, `create-household`.

- [ ] **Step 1: Write the failing test**

Create `src/app-css.test.ts`:

```ts
import { test, expect } from "bun:test";
import { getAppCss } from "./widgets.js";

test("app.css assembles with no unresolved include markers", async () => {
    const css = await getAppCss();
    expect(css.length).toBeGreaterThan(0);
    expect(css.match(/\/\*@include/g)).toBeNull();
    expect(css).toContain(".bottom-nav");
});
```

In `src/public-site.test.ts`, inside `describe("runtime surfaces that stay", …)`, add after the `GET /health is ok` test:

```ts
test("GET /app.css serves the assembled app stylesheet", async () => {
    const r = await app.request("http://x/app.css");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type") ?? "").toContain("text/css");
    const css = await r.text();
    expect(css).not.toContain("/*@include");
    expect(css).toContain(".bottom-nav");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/app-css.test.ts`
Expected: FAIL with `SyntaxError: Export named 'getAppCss' not found in module` (or similar "not found" import error).

- [ ] **Step 3: Move the file**

```bash
mkdir -p public/app
git mv public/app.css public/app/app.css
```

- [ ] **Step 4: Add `getAppCss` to `src/widgets.ts`**

Insert directly after the `getWidgetHtml` function:

```ts
// The household web app's stylesheet, served at /app.css. Assembled from the
// same shared partials as the widgets so the two surfaces cannot drift: its
// @include markers resolve against public/widgets/src/ exactly like a
// template's. Cached like a widget and warmed at boot.
export const APP_CSS_SOURCE = "./public/app/app.css";
let appCss: string | undefined;

export async function getAppCss(): Promise<string> {
    if (appCss !== undefined) return appCss;
    const file = Bun.file(APP_CSS_SOURCE);
    if (!(await file.exists())) {
        throw new Error(`app stylesheet source not found: ${APP_CSS_SOURCE}`);
    }
    appCss = await resolveIncludes(await file.text(), APP_CSS_SOURCE, [
        APP_CSS_SOURCE,
    ]);
    return appCss;
}
```

Replace `warmWidgets` with:

```ts
// Assemble every widget and the app stylesheet once, so a broken partial or
// marker fails fast at startup rather than on a client's first request.
export async function warmWidgets(): Promise<void> {
    await Promise.all([
        ...Object.keys(WIDGET_TEMPLATES).map((key) => getWidgetHtml(key)),
        getAppCss(),
    ]);
}
```

- [ ] **Step 5: Serve it from `src/index.ts`**

Change the import `import { warmWidgets } from "./widgets.js";` to:

```ts
import { getAppCss, warmWidgets } from "./widgets.js";
```

Replace the `/app.css` route:

```ts
app.get("/app.css", async (c) => {
    return c.body(await getAppCss(), 200, {
        "Content-Type": "text/css; charset=utf-8",
    });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/app-css.test.ts src/public-site.test.ts`
Expected: PASS. (`public-site.test.ts` runs `bun run gen:all` itself.)

- [ ] **Step 7: Add the preview script**

Create `scripts/app-preview.ts`:

```ts
/**
 * Renders every household-app page with fixture data, in light and dark, and
 * serves the result next to the real /app.css so the pages can be looked at
 * without Supabase. The widget equivalent is scripts/widget-harness.ts.
 *
 *   bun run preview:app            # writes tmp/app-preview/*.html, serves :4787
 *   bun run preview:app --shots    # also writes a 430px-wide PNG per page, then exits
 *
 * --shots needs Chromium on PATH (chromium, chromium-browser or google-chrome).
 * The server never imports this file.
 */
import { renderFridgePage } from "../src/web/pages/fridge.js";
import { renderGroceryPage } from "../src/web/pages/grocery.js";
import {
    renderRecipeDetailPage,
    renderRecipesPage,
} from "../src/web/pages/recipes.js";
import { renderSettingsPage } from "../src/web/pages/settings.js";
import { renderFoodsSettingsPage } from "../src/web/pages/foods.js";
import { renderHouseholdSettingsPage } from "../src/app/settings/household.js";
import {
    renderNutritionPage,
    viewerChromeFromProfile,
} from "../src/app/nutrition.js";
import { createHouseholdFormHtml } from "../src/web/dashboard.js";
import { getAppCss } from "../src/widgets.js";

const OUT = "./tmp/app-preview";
const PORT = 4787;
const H = "hh-1";
const ME = {
    householdId: H,
    userId: "u1",
    role: "owner",
    displayName: "Ethan",
};
const SAM = { ...ME, userId: "u2", role: "member", displayName: "Sam" };

// The widget templates carry a SAMPLE payload for standalone preview; reuse it
// so the nutrition page shows real cards.
async function widgetSample(key: string): Promise<unknown> {
    const src = await Bun.file(
        `./public/widgets/src/templates/${key}.html`,
    ).text();
    const m = src.match(/const SAMPLE = (\{[\s\S]*?\n {12}\});/);
    return m ? new Function(`return (${m[1]})`)() : { locale: "en" };
}

function fridgeView(chrome: unknown) {
    const loc = (id: string, name: string, sortOrder: number) => ({
        id,
        householdId: H,
        name,
        sortOrder,
    });
    const item = (
        id: string,
        locationId: string,
        displayName: string,
        amount: number,
        unit: string,
        expiresOn: string | null,
        food = true,
    ) => ({
        id,
        householdId: H,
        locationId,
        kind: food ? "food" : "supply",
        displayName,
        quantity: { amount, unit },
        identity: {},
        foodId: food ? `f-${id}` : null,
        expiresOn,
    });
    return {
        chrome,
        locations: [loc("l1", "Fridge", 0), loc("l2", "Pantry", 1)],
        items: [
            item("i1", "l1", "Eggs", 6, "each", "2026-10-08"),
            item("i2", "l1", "Milk", 1000, "ml", "2026-10-07"),
            item("i3", "l2", "Paper towels", 3, "roll", null, false),
        ],
    };
}

function groceryView(chrome: unknown) {
    const section = (
        id: string,
        name: string,
        isOther: boolean,
        lines: unknown[],
    ) => ({
        id,
        householdId: H,
        storeId: "s1",
        name,
        sortOrder: isOther ? 8 : 0,
        hidden: false,
        isOther,
        lines,
    });
    const line = (
        id: string,
        name: string,
        amount: number,
        unit: string,
        checked: boolean,
        alreadyHave: unknown = null,
    ) => ({
        id,
        householdId: H,
        storeId: "s1",
        sectionId: "sec1",
        kind: "food",
        displayName: name,
        quantity: { amount, unit },
        identity: {},
        foodId: `f-${id}`,
        checked,
        alreadyHave,
    });
    return {
        chrome,
        isOwner: true,
        locations: [
            { id: "l1", name: "Fridge" },
            { id: "l2", name: "Pantry" },
        ],
        stores: [
            {
                id: "s1",
                householdId: H,
                name: "Safeway",
                sortOrder: 0,
                rules: [{ id: "r1", body: "Prefer store brand." }],
                sections: [
                    section("sec1", "Produce", false, [
                        line("g1", "Bananas", 6, "each", false),
                        line("g2", "Spinach", 300, "g", true),
                    ]),
                    section("sec2", "Other", true, [
                        line("g3", "Eggs", 12, "each", false, {
                            cover: "partial",
                            have: { amount: 6, unit: "each" },
                            need: { amount: 12, unit: "each" },
                        }),
                    ]),
                ],
            },
        ],
    };
}

const RECIPE = {
    id: "r1",
    householdId: H,
    creatorId: "u1",
    name: "Shakshuka",
    yieldPortions: 4,
    instructions: "Simmer tomatoes, crack eggs, cover.",
    sourceUrl: null,
    tags: ["dinner", "vegetarian"],
    notes: null,
    prepMinutes: 10,
    cookMinutes: 20,
};

const MACROS = {
    calories: 320,
    protein_g: 18,
    carbs_g: 22,
    fat_g: 17,
    fiber_g: 5,
    sugar_g: 9,
    alcohol_g: 0,
    incomplete: false,
    incompleteReasons: [],
};

function food(id: string, name: string, calories: number | null) {
    return {
        id,
        householdId: H,
        kind: "food",
        name,
        normalizedName: name.toLowerCase(),
        brand: null,
        defaultUnit: "g",
        gramsPerEach: null,
        gramsPerMl: null,
        calories,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
        sugarG: null,
        alcoholG: null,
        caffeineMg: null,
        nutritionSource: null,
        allergens: [],
        offSourceId: null,
        createdBy: null,
        archivedAt: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
        aliases: [],
    };
}

// Views are cast with `as never`: this script is not typechecked (CI's
// typecheck covers src/ only) and the fixtures only carry what renderers read.
async function pages(theme: "light" | "dark"): Promise<Record<string, string>> {
    const chrome = viewerChromeFromProfile({ theme });
    const nutrition = await renderNutritionPage({
        access: { ok: true, mode: "self", viewer: ME, subject: ME },
        members: [ME, SAM],
        summary: await widgetSample("nutrition-summary"),
        goals: await widgetSample("goal-progress"),
        trends: await widgetSample("trends"),
        weight: await widgetSample("weight-trends"),
        chrome,
    } as never);
    return {
        nutrition,
        fridge: renderFridgePage(fridgeView(chrome) as never),
        grocery: renderGroceryPage(groceryView(chrome) as never),
        recipes: renderRecipesPage({
            chrome,
            recipes: [RECIPE],
            members: [ME, SAM],
            viewerId: "u1",
        } as never),
        recipe: renderRecipeDetailPage({
            chrome,
            recipe: RECIPE,
            ingredients: [
                {
                    id: "ing1",
                    recipeId: "r1",
                    foodId: "f1",
                    displayName: "Eggs",
                    quantity: { amount: 6, unit: "each" },
                    note: "large",
                    sortOrder: 0,
                    perPortionAmount: 1.5,
                    personAmount: 1.5,
                },
            ],
            members: [ME, SAM],
            stores: [{ id: "s1", name: "Safeway" }],
            viewerId: "u1",
            filterUserId: "u1",
            portionCount: 1,
            macros: MACROS,
            isOwner: true,
        } as never),
        settings: renderSettingsPage({
            chrome,
            selectedSwatch: null,
            displayName: "Ethan",
            timezone: "America/Los_Angeles",
            weightUnit: "kg",
            widgetsEnabled: true,
            alcoholTrackingEnabled: false,
            drinkUnit: "",
        } as never),
        household: renderHouseholdSettingsPage({
            chrome,
            householdName: "Flow house",
            location: "Portland",
            members: [ME, SAM],
            stores: [
                {
                    id: "s1",
                    householdId: H,
                    name: "Safeway",
                    sortOrder: 0,
                    sections: [
                        {
                            id: "sec1",
                            householdId: H,
                            storeId: "s1",
                            name: "Produce",
                            sortOrder: 0,
                            hidden: false,
                            isOther: false,
                        },
                    ],
                    rules: [{ id: "r1", body: "Prefer store brand." }],
                },
            ],
            memberRules: [
                { member: ME, rules: [], allergens: [], dislikes: [] },
            ],
            isOwner: true,
        } as never),
        foods: renderFoodsSettingsPage({
            chrome,
            foods: [food("f1", "Eggs", 143), food("f2", "Milk", 64)],
        } as never),
        "create-household": createHouseholdFormHtml(),
    };
}

function findChromium(): string | null {
    for (const bin of ["chromium", "chromium-browser", "google-chrome"]) {
        const path = Bun.which(bin);
        if (path) return path;
    }
    return null;
}

const names: string[] = [];
for (const theme of ["light", "dark"] as const) {
    for (const [name, html] of Object.entries(await pages(theme))) {
        const file = `${name}-${theme}`;
        await Bun.write(`${OUT}/${file}.html`, html);
        names.push(file);
    }
}

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === "/app.css") {
            return new Response(await getAppCss(), {
                headers: { "content-type": "text/css; charset=utf-8" },
            });
        }
        if (path === "/") {
            const links = names
                .map((n) => `<li><a href="/${n}.html">${n}</a></li>`)
                .join("");
            return new Response(`<!doctype html><ul>${links}</ul>`, {
                headers: { "content-type": "text/html" },
            });
        }
        const file = Bun.file(`${OUT}${path}`);
        if (await file.exists()) return new Response(file);
        const pub = Bun.file(`./public${path}`);
        return (await pub.exists())
            ? new Response(pub)
            : new Response("not found", { status: 404 });
    },
});
console.log(`app preview: http://localhost:${server.port}/`);

if (process.argv.includes("--shots")) {
    const chromium = findChromium();
    if (!chromium) {
        console.error("--shots: no chromium on PATH");
        process.exit(1);
    }
    for (const name of names) {
        await Bun.$`${chromium} --headless=new --disable-gpu --hide-scrollbars --window-size=430,2400 --virtual-time-budget=3000 --screenshot=${OUT}/${name}.png http://localhost:${PORT}/${name}.html`.quiet();
        console.log(`${OUT}/${name}.png`);
    }
    server.stop();
}
```

In `package.json` `scripts`, add after `"harness"`:

```json
        "preview:app": "bun run scripts/app-preview.ts",
```

Append to `.gitignore`:

```gitignore

# Local page previews written by scripts/app-preview.ts
/tmp/
```

- [ ] **Step 8: Check the preview runs**

Run: `bun run preview:app --shots`
Expected: prints `app preview: http://localhost:4787/` then 18 paths ending in `.png` (9 pages × light/dark), and exits 0. Open `tmp/app-preview/fridge-light.png`: it looks exactly like before the move (sky buttons, all three food-picker panels visible). That is the baseline for Task 2.

- [ ] **Step 9: Run the full suite, format, commit**

```bash
bun test && bun run typecheck && bun run format
git add public/app/app.css src/widgets.ts src/index.ts scripts/app-preview.ts package.json .gitignore src/app-css.test.ts src/public-site.test.ts
git commit -m "Serve /app.css through the widget assembler and add a page preview.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Expected: all tests pass; `git status` shows `public/app.css` as renamed.

---

### Task 2: Build the app stylesheet on the shared partials

`public/app/app.css` is rewritten to `@include` the widget partials and add only app layout. `form.css` gains zero-specificity hooks so native controls inside `.native` look like `.input` / `.select` / `.btn`. Section wrappers get `.panel`. The CSP gains `img-src data:` because `form.css` draws the select chevron as a `data:` SVG, which `img-src 'self'` blocks on the app pages and inside their srcdoc widget frames.

**Files:**

- Modify: `public/widgets/src/shared/form.css`
- Modify: `public/widgets/src/shared/seg.css`
- Rewrite: `public/app/app.css`
- Modify: `src/app/shell.ts` (`<main class="app-main native">`)
- Modify: `src/index.ts` (CSP)
- Modify: `src/web/pages/fridge.ts`, `src/web/components/page-markup.ts`, `src/web/pages/grocery.ts`, `src/app/settings/household.ts`, `src/web/pages/settings.ts`, `src/web/pages/foods.ts` (add `panel` to section wrappers)
- Modify: `public/widgets/STYLE_GUIDE.md`
- Test: `src/app-css.test.ts`, `src/public-site.test.ts`, `src/app/shell.test.ts`

**Interfaces:**

- Consumes: `getAppCss()` from Task 1.
- Produces (CSS classes later tasks use): `.native` (on `<main>`), `.app-main`, `.app-bar`, `.panel` (from `base.css`), `.btn-primary`, `.btn-danger`, `.btn-sm` (from `form.css`), `.seg`, `.seg-btn` (from `seg.css`; `[aria-selected="true"]` counts as active), `.pill`, `.pill-dim`, `.pill-bad` (from `table.css`), `.muted`, `.member-switch`, `.subnav`, `.dash-head`, `.visually-hidden`. App rules use zero specificity (`:where(.native …)`), so any class above overrides them.

- [ ] **Step 1: Write the failing tests**

Replace `src/app-css.test.ts` with:

```ts
import { test, expect } from "bun:test";
import { getAppCss } from "./widgets.js";
import { comingSoonPage } from "./app/shell.js";

const SHARED = ["tokens.css", "base.css", "form.css", "table.css", "seg.css"];

test("app.css assembles with no unresolved include markers", async () => {
    const css = await getAppCss();
    expect(css.match(/\/\*@include/g)).toBeNull();
    expect(css).toContain(".bottom-nav");
});

test("app.css inlines each shared partial in full", async () => {
    const css = await getAppCss();
    for (const partial of SHARED) {
        const src = await Bun.file(
            `./public/widgets/src/shared/${partial}`,
        ).text();
        expect(css, partial).toContain(src.trim());
    }
});

test("app.css carries the widget brand green and none of the old per-form rules", async () => {
    const css = await getAppCss();
    expect(css).toContain("--accent: #4a7c59");
    expect(css).not.toContain("#2f8fd4");
    expect(css).not.toContain(".grocery-add-store button");
    expect(css).not.toContain(".recipe-create input");
});

test("the hidden attribute beats component display rules", async () => {
    const css = await getAppCss();
    expect(css).toMatch(
        /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/,
    );
});

test("native control hooks have zero specificity so component classes win", async () => {
    const form = await Bun.file("./public/widgets/src/shared/form.css").text();
    expect(form).toContain(":where(.native button)");
    expect(form).toContain(":where(.native select)");
    // A bare `.native button` (one not wrapped in :where) would outrank
    // `.btn-primary` and repaint it.
    expect(form).not.toMatch(
        /(?<!:where\(\s*)\.native\s+(button|select|input|textarea)/,
    );
});

test("seg buttons accept aria-selected as the active state", async () => {
    const seg = await Bun.file("./public/widgets/src/shared/seg.css").text();
    expect(seg).toContain('.seg-btn[aria-selected="true"]');
});

test("the app shell opts its main element into native control styling", () => {
    expect(comingSoonPage("fridge")).toContain(
        '<main class="app-main native">',
    );
});
```

In `src/public-site.test.ts`, inside the `self-hosted login fonts are served…` test, add after the last CSP assertion:

```ts
expect(r.headers.get("content-security-policy") ?? "").toContain(
    "img-src 'self' data:",
);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/app-css.test.ts src/public-site.test.ts`
Expected: FAIL in `inlines each shared partial`, `brand green`, `hidden attribute`, `native control hooks`, `seg buttons`, `opts its main element`, and the CSP assertion.

- [ ] **Step 3: Add the native hooks to `public/widgets/src/shared/form.css`**

Make these replacements, top to bottom.

Under the header comment, add one paragraph at the end of the comment block (before `/* ---- layout ---- */`):

```css
/* The household web app includes this partial too (public/app/app.css). Its
 * markup is plain HTML — <input>, <select>, <button> with no classes — inside
 * <main class="native">. The :where(.native …) selectors below give those
 * controls the same look at ZERO specificity, so a component class on the same
 * element (.btn-primary, .btn-danger, .btn-sm) always wins. Never write a bare
 * `.native button`: it would outrank .btn-primary. Widgets never contain a
 * .native ancestor, so none of these selectors match inside a widget. */
```

Replace the shared control surface selector:

```css
.input,
.select {
```

with:

```css
.input,
.select,
:where(
        .native
            :is(
                input:not(
                        [type="checkbox"],
                        [type="radio"],
                        [type="hidden"],
                        [type="file"]
                    ),
                select,
                textarea
            )
    ) {
```

Replace:

```css
.input::placeholder {
```

with:

```css
.input::placeholder,
:where(.native :is(input, textarea))::placeholder {
```

Replace:

```css
.input:hover:not(:disabled),
.select:hover:not(:disabled) {
```

with:

```css
.input:hover:not(:disabled),
.select:hover:not(:disabled),
:where(.native :is(input, select, textarea)):hover:not(:disabled) {
```

Replace:

```css
.input:disabled,
.select:disabled {
```

with:

```css
.input:disabled,
.select:disabled,
:where(.native :is(input, select, textarea)):disabled {
```

Replace the chevron rule's selector:

```css
.select {
    padding-right: 30px;
```

with:

```css
.select,
:where(.native select) {
    padding-right: 30px;
```

Replace the focus rule's selector:

```css
.input:focus-visible,
.select:focus-visible,
.btn:focus-visible,
.drop:focus-visible,
.seg-btn:focus-visible {
```

with:

```css
.input:focus-visible,
.select:focus-visible,
.btn:focus-visible,
.drop:focus-visible,
.seg-btn:focus-visible,
:where(.native :is(input, select, textarea, button)):focus-visible {
```

Replace:

```css
.btn {
    appearance: none;
```

with:

```css
.btn,
:where(.native button) {
    appearance: none;
```

Replace:

```css
.btn:hover:not(:disabled) {
```

with:

```css
.btn:hover:not(:disabled),
:where(.native button):hover:not(:disabled) {
```

Replace:

```css
.btn:disabled {
```

with:

```css
.btn:disabled,
:where(.native button):disabled {
```

- [ ] **Step 4: Let `aria-selected` drive `.seg-btn` in `public/widgets/src/shared/seg.css`**

Replace:

```css
.seg-btn.active {
```

with:

```css
/* aria-selected is the same state for a role="tab" control (the app's food
   picker), so it does not need a second class kept in sync by script. */
.seg-btn.active,
.seg-btn[aria-selected="true"] {
```

- [ ] **Step 5: Rewrite `public/app/app.css`**

Replace the whole file with:

```css
/* Household web app stylesheet, served at /app.css.
 *
 * Assembled by getAppCss() in src/widgets.ts from the same shared partials the
 * in-chat widgets inline, so the app and the widgets share one set of tokens
 * and components (spec: public/widgets/STYLE_GUIDE.md). Anything both surfaces
 * use belongs in a shared/ partial. Only app layout lives below.
 *
 * App markup is plain HTML inside <main class="native">: form.css styles its
 * controls through zero-specificity :where(.native …) hooks, and the rules
 * here follow the same convention, so any component class wins.
 */

/*@include shared/tokens.css@*/

/*@include shared/base.css@*/

/*@include shared/form.css@*/

/*@include shared/table.css@*/

/*@include shared/seg.css@*/

/* ---- base ---- */

*,
*::before,
*::after {
    box-sizing: border-box;
}

/* `hidden` must beat any display rule. Without this, `.food-picker-panel
   { display: grid }` overrode the attribute and every picker showed all three
   tabs at once. */
[hidden] {
    display: none !important;
}

body {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-size: 15px;
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* ---- shell ---- */

.app-bar {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 16px 0;
}
.app-bar a {
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
}

.app-main {
    flex: 1;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 8px 16px 96px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.app-main h1 {
    margin: 4px 0 0;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
}
.app-main h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
}
.app-main h3 {
    margin: 0;
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
}
.app-main p {
    margin: 0;
}
.app-main a {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
}
.app-main .panel {
    padding: 14px 16px;
    gap: 12px;
}

.bottom-nav {
    position: sticky;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
    background: var(--panel);
    border-top: 1px solid var(--panel-border);
}
.bottom-nav a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 44px;
    padding: 8px 4px;
    color: var(--text-dim);
    text-decoration: none;
}
.bottom-nav svg {
    width: 24px;
    height: 24px;
    display: block;
    flex-shrink: 0;
}
.bottom-nav a[aria-current="page"] {
    color: var(--accent);
}

/* ---- native controls inside .native ----
   Phone-sized targets, and 16px field text so iOS Safari does not zoom the
   page when a field takes focus. */

:where(
    .native
        :is(
            input:not(
                [type="checkbox"],
                [type="radio"],
                [type="hidden"],
                [type="file"]
            ),
            select,
            textarea
        )
) {
    min-height: 44px;
    font-size: 16px;
}
:where(.native textarea) {
    resize: vertical;
}
:where(.native button) {
    min-height: 44px;
    font-size: 14px;
}
:where(.native) .btn-sm {
    min-height: 34px;
}
:where(.native label) {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-dim);
}
:where(.native label:has(> input[type="checkbox"], > input[type="radio"])) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
}
:where(.native :is(input[type="checkbox"], input[type="radio"])) {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--accent);
}
:where(.native form) {
    display: grid;
    gap: 8px;
    margin: 0;
}
:where(.native fieldset) {
    display: grid;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}
:where(.native legend) {
    padding: 0;
    margin-bottom: 4px;
    font-size: 13.5px;
    font-weight: 800;
    color: var(--text);
}

/* ---- notices and quiet text ---- */

.error-banner,
.allergen-warning {
    padding: 9px 11px;
    border: 1px solid color-mix(in srgb, var(--over) 45%, var(--panel-border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--over) 9%, var(--panel));
    color: var(--over);
    font-size: 13.5px;
    font-weight: 600;
}
.allergen-unknown {
    padding: 9px 11px;
    border: 1px solid color-mix(in srgb, var(--warn) 45%, var(--panel-border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--warn) 9%, var(--panel));
    color: var(--warn);
    font-size: 13.5px;
    font-weight: 600;
}
.token-once {
    padding: 9px 11px;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--panel-border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 9%, var(--panel));
    font-size: 13.5px;
    font-weight: 600;
    overflow-wrap: anywhere;
}

/* Empty states and secondary text. The empty-* classes are pinned by tests,
   so they are listed here rather than given a second class in markup. */
.muted,
.peer-note,
.empty-fridge,
.empty-grocery,
.empty-recipes,
.empty-recipe-store,
.empty-stores,
.add-item-prompt {
    color: var(--text-dim);
    font-size: 13.5px;
}
.dislike-note {
    color: var(--warn);
    font-size: 13.5px;
    font-weight: 600;
}

.already-have-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
}

/* ---- page header and segmented links ---- */

.dash-head {
    display: grid;
    gap: 10px;
}

/* Member switch (nutrition) and settings sub-navigation: links styled as the
   widgets' segmented control. */
.member-switch,
.subnav {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    width: fit-content;
    padding: 3px;
    border-radius: 999px;
    background: var(--track);
}
.member-switch a,
.subnav a {
    padding: 6px 14px;
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 600;
}
.member-switch a[aria-current="page"],
.subnav a[aria-current="page"] {
    background: var(--accent);
    color: var(--bg);
}

/* ---- shared form components ---- */

/* Amount and unit side by side, each label above its control. */
.quantity-field {
    display: grid;
    grid-template-rows: auto auto;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px 8px;
}

.food-picker,
.food-picker-panel,
.food-picker-panel > form {
    display: grid;
    gap: 8px;
}
.food-picker-results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
}
.food-picker-results:empty {
    display: none;
}
.food-picker-results button {
    width: 100%;
    text-align: left;
}

.member-multi-select {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 16px;
}
.member-multi-select legend {
    width: 100%;
}

/* ---- widgets embedded in the page ---- */

.widget-frame {
    display: block;
    width: 100%;
    min-height: 280px;
    margin: 0;
    border: 0;
}
```

- [ ] **Step 6: Opt the shell into `.native`**

In `src/app/shell.ts`, in `renderAppShell`, replace:

```ts
<main class="app-main">${chrome.body}</main>
```

with:

```ts
<main class="app-main native">${chrome.body}</main>
```

- [ ] **Step 7: Put section wrappers on `.panel`**

Make these one-word edits (each adds ` panel` to an existing class attribute):

- `src/web/pages/fridge.ts`: `<section class="fridge-location"` → `<section class="fridge-location panel"`
- `src/web/components/page-markup.ts`: `<section class="fridge-expiring">` → `<section class="fridge-expiring panel">`
- `src/web/pages/grocery.ts`: `<section class="grocery-store"` → `<section class="grocery-store panel"`
- `src/app/settings/household.ts`: `<section class="household-store"` → `<section class="household-store panel"` and `<section class="member-rules"` → `<section class="member-rules panel"`
- `src/web/pages/settings.ts`: `class="appearance"` → `class="appearance panel"` and `class="appearance nutrition-prefs"` → `class="appearance nutrition-prefs panel"`
- `src/web/pages/foods.ts`: `class="appearance food-edit"` → `class="appearance food-edit panel"` and, in the merge form, `class="appearance"` → `class="appearance panel"`

- [ ] **Step 8: Allow `data:` images in the CSP**

In `src/index.ts`, in the `Content-Security-Policy` string, replace `img-src 'self'` with `img-src 'self' data:`. Add this comment directly above the `c.res.headers.set(` call:

```ts
// img-src data: — form.css draws the <select> chevron as an inline
// SVG data URI; srcdoc widget frames inherit this policy too.
```

- [ ] **Step 9: Document the app consumer in `public/widgets/STYLE_GUIDE.md`**

Insert this section directly after the "Build system (how the shared code is reused)" section:

````markdown
## The household app is a second consumer

`public/app/app.css` `@include`s `tokens.css`, `base.css`, `form.css`,
`table.css` and `seg.css`, and `getAppCss()` (`src/widgets.ts`) assembles it into
`/app.css`. Changing a partial therefore changes the web app too; check both with
`bun run harness` and `bun run preview:app --shots`.

App pages are server-rendered plain HTML inside `<main class="app-main native">`.
`form.css` styles native `input`, `select`, `textarea` and `button` elements inside
`.native` through `:where(.native …)` selectors. `:where()` has zero specificity,
so a component class on the same element always wins:

```html
<button type="submit">Save</button>
<!-- neutral .btn look -->
<button type="submit" class="btn-primary">Save</button>
<!-- accent fill -->
<button type="submit" class="btn-sm btn-danger">Delete</button>
```

Never write a bare `.native button` rule. It outranks `.btn-primary` and repaints
every primary button. `.seg-btn[aria-selected="true"]` is the same state as
`.seg-btn.active`, for `role="tab"` controls.
````

- [ ] **Step 10: Run the tests to verify they pass**

Run: `bun test`
Expected: PASS, including `src/widgets.test.ts`. Widget output changes only by the added `:where(.native …)` selectors, which match nothing inside a widget.

- [ ] **Step 11: Look at the result**

Run: `bun run preview:app --shots`
Expected, in `tmp/app-preview/fridge-light.png`: each location is a white rounded card with a soft shadow; inputs and selects have rounded borders, 44px height and a chevron on selects; only the Barcode panel of each food picker is visible; buttons are still sky (the shell's inline accent override goes in Task 3). In `fridge-dark.png`: near-black page, `#1c1c1e` cards. Run `bun run harness` and open any widget: it looks unchanged.

- [ ] **Step 12: Format and commit**

```bash
bun run format
git add public/widgets/src/shared/form.css public/widgets/src/shared/seg.css public/app/app.css public/widgets/STYLE_GUIDE.md src/app/shell.ts src/index.ts src/web src/app src/app-css.test.ts src/public-site.test.ts
git commit -m "Build the app stylesheet on the shared widget partials.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## PR 2 — Theme

### Task 3: Replace the accent picker with a System / Light / Dark theme

`ViewerChrome` loses `accent` and `theme` becomes `ThemePref`. A null `profiles.theme` means "system": no `data-theme` on `<html>`, so the token media query decides. The settings form offers System / Light / Dark and no swatches. Widgets embedded in the app get only the explicit theme, never an accent.

**Files:**

- Rewrite: `src/app/shell.ts`
- Modify: `src/app/nutrition.ts` (`viewerChromeFromProfile`, `widgetCard`, imports, `renderAppShell` call)
- Modify: `src/widgets.ts` (`WidgetViewerChrome`, the injection helper)
- Modify: `src/web/pages/settings.ts` (view type, theme fieldset, no swatches)
- Modify: `src/web/dashboard.ts` (`renderSettingsAccountPage`, `isAccentSwatch` import)
- Modify: `src/web/routes/settings.ts` (`parseAppearanceInput` call)
- Modify: `src/web/pages/fridge.ts`, `grocery.ts`, `recipes.ts`, `foods.ts`, `src/app/settings/household.ts` (drop `accent:` from `renderAppShell` calls)
- Modify: `public/app/app.css` (add `.choice-row`)
- Test: `src/app/shell.test.ts`, `src/domain/settings.test.ts`, `src/web/dashboard.test.ts`, `src/mcp.test.ts`, plus a mechanical edit of `src/domain/fridge.test.ts`, `src/domain/grocery.test.ts`, `src/domain/recipes.test.ts`, `src/web/components/shared-import.test.ts`
- Modify: `scripts/app-preview.ts` (drop `selectedSwatch`)

**Interfaces:**

- Produces in `src/app/shell.ts`:
    - `export type ThemePref = "light" | "dark" | "system";`
    - `export type ViewerChrome = { theme: ThemePref };`
    - `export type AppChrome = ViewerChrome & { title: string; active: AppTabId; body: string };`
    - `export function resolveTheme(theme: string | null | undefined): ThemePref`
    - `export function htmlOpen(theme: ThemePref): string` returns `<html lang="en">` or `<html lang="en" data-theme="dark">`
    - `export function appHead(title: string, theme: ThemePref): string`
    - `export function parseAppearanceInput(input: { theme?: unknown }): { theme: "light" | "dark" | null }`
    - Removed: `ACCENT_SWATCHES`, `AccentSwatch`, `AccentTokens`, `Theme`, `isAccentSwatch`, `resolveAccent`, `accentColor`, `accentCssVars`.
- Produces in `src/widgets.ts`: `export type WidgetViewerChrome = { theme: "light" | "dark" | "system" };` with `withWidgetData(html, data, chrome?)` keeping its signature.
- `SettingsPageView` loses `selectedSwatch`.

- [ ] **Step 1: Write the failing tests**

In `src/app/shell.test.ts`:

1. Change the import block to:

```ts
import {
    APP_TABS,
    bottomNav,
    comingSoonPage,
    parseAppearanceInput,
    resolveTheme,
} from "./shell.js";
```

2. Delete the tests `null accent resolves to sky`, `unset theme is light`, `fridge stub uses the shell and marks Fridge active`, `dark viewer swatch beats app.css sky tokens` and `appearance form values coerce to theme and allowlisted swatch`. Add in their place:

```ts
test("unset theme follows the system", () => {
    expect(resolveTheme(null)).toBe("system");
    expect(resolveTheme("nope")).toBe("system");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
});

test("fridge stub uses the shell and marks Fridge active", () => {
    const html = comingSoonPage("fridge");
    expect(html).toContain("<h1>Fridge</h1>");
    expect(html).toContain("Coming soon.");
    expect(html).toContain('href="/fridge" aria-current="page"');
    expect(html).toContain('href="/logout"');
    expect(html).toContain('<link rel="stylesheet" href="/app.css" />');
});

test("system theme leaves data-theme off and offers both theme colors", () => {
    const html = comingSoonPage("fridge");
    expect(html).toContain('<html lang="en">');
    expect(html).not.toContain("data-theme");
    expect(html).toContain(
        '<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />',
    );
    expect(html).not.toContain("--accent");
});

test("an explicit theme stamps data-theme on html", () => {
    const html = comingSoonPage("settings", { theme: "dark" });
    expect(html).toContain('<html lang="en" data-theme="dark">');
    expect(html).toContain('<meta name="theme-color" content="#000000" />');
    expect(html).not.toContain("--accent");
});

test("the appearance form maps System to a cleared preference", () => {
    expect(parseAppearanceInput({ theme: "dark" })).toEqual({ theme: "dark" });
    expect(parseAppearanceInput({ theme: "light" })).toEqual({
        theme: "light",
    });
    expect(parseAppearanceInput({ theme: "system" })).toEqual({ theme: null });
    expect(parseAppearanceInput({ theme: "chartreuse" })).toEqual({
        theme: null,
    });
});
```

In `src/domain/settings.test.ts`:

1. Delete `import { ACCENT_SWATCHES } from "../app/shell.js";`.
2. Replace `const chrome = { theme: "light" as const, accent: ACCENT_SWATCHES.sky };` with `const chrome = { theme: "light" as const };`.
3. Replace the test `theme save form posts account fields to /settings` with:

```ts
test("theme save form posts account fields to /settings", () => {
    const html = renderSettingsPage({
        chrome: { theme: "dark" },
        displayName: "Alice",
        timezone: "America/Los_Angeles",
        weightUnit: "lb",
        widgetsEnabled: true,
        alcoholTrackingEnabled: false,
        drinkUnit: "",
    });
    expect(html).toContain("<h1>Settings</h1>");
    expect(html).toContain('href="/settings/household"');
    expect(html).toContain('href="/settings/foods"');
    expect(html).toContain('name="theme" value="dark" checked');
    expect(html).toContain('name="theme" value="system"');
    expect(html).toContain('name="theme" value="light"');
    expect(html).not.toContain('name="accent_swatch"');
    expect(html).toContain('<html lang="en" data-theme="dark">');
    expect(html).not.toContain("coming-soon");
});

test("a cleared theme preference checks System", () => {
    const html = renderSettingsPage({
        chrome: { theme: "system" },
        displayName: "Alice",
        timezone: "",
        weightUnit: "",
        widgetsEnabled: true,
        alcoholTrackingEnabled: false,
        drinkUnit: "",
    });
    expect(html).toContain('name="theme" value="system" checked');
    expect(html).not.toContain("data-theme");
});
```

In `src/web/dashboard.test.ts`:

1. Delete `import { ACCENT_SWATCHES } from "../app/shell.js";`.
2. Replace the `skyChrome` constant with:

```ts
const lightChrome = { theme: "light" as const };
```

and rename every `chrome: skyChrome` to `chrome: lightChrome`. 3. Replace the test `withWidgetData injects viewer accent after widget tokens` with:

```ts
test("withWidgetData stamps an explicit viewer theme and never overrides the accent", () => {
    const html =
        '<html data-theme="light"><head></head><script>initWidget({})</script></html>';
    const dark = withWidgetData(html, { locale: "en" }, { theme: "dark" });
    expect(dark).toContain('<html data-theme="dark">');
    expect(dark).not.toContain("viewer-accent");
    expect(dark).not.toContain("--accent");

    const system = withWidgetData(html, { locale: "en" }, { theme: "system" });
    expect(system).toContain("<html>");
    expect(system).not.toContain("data-theme");
});
```

4. In `self dashboard reuses widget iframes and has no household facts`, delete `expect(html).toContain("--accent:#2f8fd4");`.
5. Rename the test `peer dashboard is read-only and uses the viewer accent` to `peer dashboard is read-only`, change its `chrome:` to `chrome: lightChrome`, and delete `expect(html).toContain("--accent:#e25d8a");`.

In `src/mcp.test.ts`:

1. In `a site cookie renders the viewer's dashboard widgets`, replace `expect(html).toContain("--accent:#2f8fd4");` with `expect(html).toContain('href="/app.css"');`.
2. Replace the test `POST /settings persists dark theme for the next GET` with:

```ts
test("POST /settings persists dark theme for the next GET", async () => {
    const save = await siteApp.request("http://x/settings", {
        method: "POST",
        headers: {
            cookie: cookieFor(alice),
            "content-type": "application/x-www-form-urlencoded",
        },
        body: "theme=dark",
    });
    expect(save.status).toBe(302);
    expect(save.headers.get("location")).toBe("/settings");
    expect(db.profile?.theme).toBe("dark");
    const r = await siteApp.request("http://x/settings", {
        headers: { cookie: cookieFor(alice) },
    });
    const html = await r.text();
    expect(html).toContain('<html lang="en" data-theme="dark">');
    expect(html).not.toContain("--accent");
});

test("POST /settings with System clears the saved theme", async () => {
    const save = await siteApp.request("http://x/settings", {
        method: "POST",
        headers: {
            cookie: cookieFor(alice),
            "content-type": "application/x-www-form-urlencoded",
        },
        body: "theme=system",
    });
    expect(save.status).toBe(302);
    expect(db.profile?.theme).toBeNull();
    const r = await siteApp.request("http://x/settings", {
        headers: { cookie: cookieFor(alice) },
    });
    const html = await r.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('name="theme" value="system" checked');
});
```

Remove the swatch from the remaining fixtures with one mechanical edit:

```bash
perl -0pi -e 's/,\s*accent: ACCENT_SWATCHES\.\w+//g; s/^import \{ ACCENT_SWATCHES \} from "[^"]+";\n//mg' \
  src/domain/fridge.test.ts src/domain/grocery.test.ts src/domain/recipes.test.ts src/web/components/shared-import.test.ts
grep -rn "ACCENT_SWATCHES\|accent:" src --include=*.test.ts
```

Expected: the `grep` prints nothing.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/app/shell.test.ts src/domain/settings.test.ts src/web/dashboard.test.ts`
Expected: FAIL. `resolveTheme(null)` returns `"light"`, the shell still prints `--accent`, the settings page still has `accent_swatch`, and `withWidgetData` still injects `viewer-accent`.

- [ ] **Step 3: Rewrite `src/app/shell.ts`**

Replace the whole file with:

```ts
import { tabIcon } from "../web/components/bottom-nav.js";

export const APP_TABS = [
    { id: "fridge", href: "/fridge", label: "Fridge" },
    { id: "grocery", href: "/grocery", label: "Groceries" },
    { id: "nutrition", href: "/", label: "Nutrition" },
    { id: "recipes", href: "/recipes", label: "Recipes" },
    { id: "settings", href: "/settings", label: "Settings" },
] as const;

export type AppTabId = (typeof APP_TABS)[number]["id"];

/** The viewer's saved theme. "system" is a null `profiles.theme` and follows
 *  the OS through prefers-color-scheme. There is no accent preference: the
 *  app, the login page and the widgets share one brand green (tokens.css). */
export type ThemePref = "light" | "dark" | "system";

export type ViewerChrome = {
    theme: ThemePref;
};

export type AppChrome = ViewerChrome & {
    title: string;
    active: AppTabId;
    body: string;
};

// The page background (--bg in public/widgets/src/shared/tokens.css), so the
// mobile browser bar blends into the page.
const THEME_COLOR = { light: "#f5f5f7", dark: "#000000" } as const;

export function resolveTheme(theme: string | null | undefined): ThemePref {
    return theme === "light" || theme === "dark" ? theme : "system";
}

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function bottomNav(active: AppTabId): string {
    const links = APP_TABS.map((tab) => {
        const current = tab.id === active ? ' aria-current="page"' : "";
        const label = escapeHtml(tab.label);
        return `<a href="${tab.href}"${current} title="${label}" aria-label="${label}">${tabIcon(tab.id)}</a>`;
    }).join("");
    return `<nav class="bottom-nav" aria-label="App">${links}</nav>`;
}

/** The `<html>` opener. An explicit theme stamps data-theme, which the token
 *  blocks in tokens.css prefer over prefers-color-scheme in both directions;
 *  "system" leaves it off so the media query decides. */
export function htmlOpen(theme: ThemePref): string {
    const attr = theme === "system" ? "" : ` data-theme="${theme}"`;
    return `<html lang="en"${attr}>`;
}

function themeColorMeta(theme: ThemePref): string {
    if (theme !== "system") {
        return `<meta name="theme-color" content="${THEME_COLOR[theme]}" />`;
    }
    return `<meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="${THEME_COLOR.dark}" media="(prefers-color-scheme: dark)" />`;
}

export function appHead(title: string, theme: ThemePref): string {
    return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${themeColorMeta(theme)}
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.ico" />
<link rel="stylesheet" href="/app.css" />`;
}

export function renderAppShell(chrome: AppChrome): string {
    return `<!doctype html>
${htmlOpen(chrome.theme)}
<head>
${appHead(chrome.title, chrome.theme)}
</head>
<body>
<header class="app-bar"><a href="/logout">Log out</a></header>
<main class="app-main native">${chrome.body}</main>
${bottomNav(chrome.active)}
<script>
document.querySelectorAll(".widget-frame").forEach((frame) => {
    const fit = () => {
        try {
            const doc = frame.contentDocument;
            if (!doc) return;
            frame.style.height = Math.ceil(doc.documentElement.scrollHeight) + "px";
        } catch (_) {}
    };
    frame.addEventListener("load", fit);
    window.addEventListener("message", (e) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data;
        if (d && d.method && String(d.method).endsWith("size-changed") && d.params && d.params.height) {
            frame.style.height = d.params.height + "px";
        }
    });
});
</script>
</body>
</html>`;
}

/** The settings form posts theme=system|light|dark. System, or anything
 *  unrecognised, clears the preference (null) rather than pinning light. */
export function parseAppearanceInput(input: { theme?: unknown }): {
    theme: "light" | "dark" | null;
} {
    return {
        theme:
            input.theme === "light" || input.theme === "dark"
                ? input.theme
                : null,
    };
}

export function comingSoonPage(
    tab: Exclude<AppTabId, "nutrition">,
    chrome: ViewerChrome = { theme: "system" },
): string {
    const label = APP_TABS.find((t) => t.id === tab)!.label;
    return renderAppShell({
        title: label,
        active: tab,
        theme: chrome.theme,
        body: `<h1>${escapeHtml(label)}</h1><p class="coming-soon">Coming soon.</p>`,
    });
}
```

- [ ] **Step 4: Drop `accent:` from every page's `renderAppShell` call**

```bash
perl -0pi -e 's/\n\s*accent: view\.chrome\.accent,//g' \
  src/web/pages/fridge.ts src/web/pages/grocery.ts src/web/pages/recipes.ts \
  src/web/pages/settings.ts src/web/pages/foods.ts src/app/settings/household.ts src/app/nutrition.ts
grep -rn "chrome.accent" src
```

Expected: the `grep` prints nothing.

- [ ] **Step 5: Theme-only widget injection in `src/widgets.ts`**

Replace the `WidgetViewerChrome` type and `injectViewerAccent` with:

```ts
export type WidgetViewerChrome = {
    theme: "light" | "dark" | "system";
};

// The web app embeds widgets as srcdoc iframes. An explicit viewer theme is
// stamped on the widget's <html> so it matches the page; "system" leaves the
// attribute off and the widget follows prefers-color-scheme, as the page does.
// The accent is never overridden: there is one brand green.
function applyViewerTheme(html: string, chrome: WidgetViewerChrome): string {
    const withoutTheme = html.replace(/\sdata-theme="[^"]*"/g, "");
    if (chrome.theme === "system") return withoutTheme;
    return withoutTheme.replace(
        /<html\b/i,
        `<html data-theme="${chrome.theme}"`,
    );
}
```

In `withWidgetData`, replace `return chrome ? injectViewerAccent(seeded, chrome) : seeded;` with:

```ts
return chrome ? applyViewerTheme(seeded, chrome) : seeded;
```

- [ ] **Step 6: Theme-only chrome in `src/app/nutrition.ts`**

In the import from `./shell.js`, remove `accentColor` and `resolveAccent` (keep `resolveTheme` and the rest). Replace `viewerChromeFromProfile` with:

```ts
export function viewerChromeFromProfile(
    profile: { theme?: string | null } | null,
): ViewerChrome {
    return { theme: resolveTheme(profile?.theme) };
}
```

In `widgetCard`, replace the `withWidgetData(...)` call with:

```ts
const html = withWidgetData(await getWidgetHtml(key), data, {
    theme: chrome.theme,
});
```

- [ ] **Step 7: Settings page without swatches**

In `src/web/pages/settings.ts`, change the import from `../../app/shell.js` to:

```ts
import {
    escapeHtml,
    renderAppShell,
    type ViewerChrome,
} from "../../app/shell.js";
```

Delete `const SWATCH_ORDER = …;`. In `SettingsPageView`, delete `selectedSwatch: AccentSwatch | null;`. Replace the whole `renderSettingsPage` function with:

```ts
const THEME_CHOICES = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
] as const;

export function renderSettingsPage(view: SettingsPageView): string {
    const themes = THEME_CHOICES.map(({ value, label }) => {
        const checked = view.chrome.theme === value ? " checked" : "";
        return `<label><input type="radio" name="theme" value="${value}"${checked} /> ${label}</label>`;
    }).join("");
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const widgetsChecked = view.widgetsEnabled ? " checked" : "";
    const alcoholChecked = view.alcoholTrackingEnabled ? " checked" : "";
    const body = `
        <h1>Settings</h1>
        ${error}
        <p class="settings-lead"><a href="/settings/household">Household</a> · <a href="/settings/foods">Foods</a></p>
        <form method="POST" action="/settings" class="appearance panel">
            <input type="hidden" name="group" value="account" />
            <h2>Account</h2>
            <label for="display_name">Display name</label>
            <input id="display_name" name="display_name" value="${escapeHtml(view.displayName)}" maxlength="80" autocomplete="nickname" />
            <fieldset class="choice-row">
                <legend>Theme</legend>
                ${themes}
            </fieldset>
            <button type="submit" class="btn-primary">Save account</button>
        </form>
        <form method="POST" action="/settings" class="appearance nutrition-prefs panel">
            <input type="hidden" name="group" value="nutrition" />
            <h2>Nutrition prefs</h2>
            <label for="timezone">Timezone</label>
            <input id="timezone" name="timezone" value="${escapeHtml(view.timezone)}" placeholder="America/Los_Angeles" autocomplete="off" />
            <label for="preferred_weight_unit">Weight unit</label>
            <select id="preferred_weight_unit" name="preferred_weight_unit">${optionList(WEIGHT_UNITS, view.weightUnit)}</select>
            <label><input type="checkbox" name="widgets_enabled" value="true"${widgetsChecked} /> Show in-chat widgets</label>
            <label><input type="checkbox" name="alcohol_tracking_enabled" value="true"${alcoholChecked} /> Alcohol tracking</label>
            <label for="preferred_drink_unit">Drink unit</label>
            <select id="preferred_drink_unit" name="preferred_drink_unit">${optionList(DRINK_UNITS, view.drinkUnit, { us: "US drinks", uk: "UK units" })}</select>
            <button type="submit" class="btn-primary">Save nutrition prefs</button>
        </form>
    `;
    return renderAppShell({
        title: "Settings",
        active: "settings",
        theme: view.chrome.theme,
        body,
    });
}
```

Append to `public/app/app.css`:

```css
/* A row of radio or checkbox choices under one legend. */
.choice-row {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 18px;
}
.choice-row legend {
    width: 100%;
}
```

- [ ] **Step 8: Settings builder and route**

In `src/web/dashboard.ts`, change `import { isAccentSwatch, escapeHtml } from "../app/shell.js";` to:

```ts
import { escapeHtml } from "../app/shell.js";
```

In `renderSettingsAccountPage`, delete the `const swatch = …;` statement and the `selectedSwatch: swatch,` line.

In `src/web/routes/settings.ts`, replace:

```ts
const appearance = parseAppearanceInput({
    theme: body.theme,
    accent_swatch: body.accent_swatch,
});
```

with:

```ts
const appearance = parseAppearanceInput({ theme: body.theme });
```

In `scripts/app-preview.ts`, delete the line `selectedSwatch: null,`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `bun test && bun run typecheck`
Expected: PASS, and typecheck reports no errors. A leftover reference shows up as `Module '"../app/shell.js"' has no exported member 'ACCENT_SWATCHES'`; remove it the same way as Step 4.

- [ ] **Step 10: Look at the result**

Run: `bun run preview:app --shots`
Expected: every primary button and active nav icon is green (`#4a7c59` light, `#6ab98a` dark); `settings-light.png` shows two cards, Account (display name, then System / Light / Dark radios in one row) and Nutrition prefs; no colour swatches anywhere.

- [ ] **Step 11: Format and commit**

```bash
bun run format
git add -A src scripts/app-preview.ts public/app/app.css
git commit -m "Replace the accent picker with a System, Light, Dark theme.

profiles.accent_swatch is no longer read or written; dropping the column
is a later contract migration.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fit embedded widgets to the page

Two fixes for widgets shown on the Nutrition page. The bridge's footer ("just ask to update your settings") is chat copy; it is now skipped when the web app seeded the data. And the iframe is pulled out by the widget's own 12–14px gutter, so the widget card's edges line up with the page's panels.

**Files:**

- Modify: `public/widgets/src/shared/bridge.js` (`paint`, the seeded call)
- Create: `public/widgets/bridge-seeded.test.ts`
- Modify: `public/app/app.css` (`.widget-frame`)

**Interfaces:**

- Consumes: `window.__WIDGET_DATA__`, set by `withWidgetData` (`src/widgets.ts`).
- Produces: `paint(data, withFooter)` inside `initWidget`. `withFooter === false` skips the footer; every existing call keeps the footer.

- [ ] **Step 1: Write the failing test**

Create `public/widgets/bridge-seeded.test.ts`:

```ts
// The bridge appends a "just ask to update your settings" footer under every
// painted widget. That copy is for chat hosts. The household web app seeds the
// data itself (window.__WIDGET_DATA__, see withWidgetData in src/widgets.ts),
// and there the footer is wrong.
//
// Same technique as macros.test.ts: evaluate the real shared source with just
// enough window/document to run initWidget once.
import { test, expect } from "bun:test";

const BRIDGE = await Bun.file("./public/widgets/src/shared/bridge.js").text();
const FOOTER = "You can enable or disable these widgets anytime";

function paintedNotes(seeded: unknown, hasHost: boolean): string[] {
    const notes: string[] = [];
    const root = {
        innerHTML: "",
        appendChild(node: { textContent: string }) {
            notes.push(node.textContent);
        },
    };
    const docEl = {
        style: {},
        setAttribute() {},
        getBoundingClientRect: () => ({ height: 100 }),
    };
    const document = {
        getElementById: () => root,
        documentElement: docEl,
        body: docEl,
        createElement: () => ({ textContent: "", style: { cssText: "" } }),
    };
    const window: Record<string, unknown> = {
        __WIDGET_DATA__: seeded,
        innerWidth: 400,
        addEventListener() {},
    };
    window.parent = hasHost ? { postMessage() {} } : window;
    const run = new Function(
        "window",
        "document",
        "ResizeObserver",
        "requestAnimationFrame",
        `${BRIDGE}
initWidget({ name: "t", loading: "", coerce: (d) => d, sample: { s: 1 },
    render: () => { document.getElementById("root").innerHTML = "<p>card</p>"; } });`,
    );
    run(
        window,
        document,
        class {
            observe() {}
        },
        (cb: () => void) => cb(),
    );
    return notes;
}

test("data seeded by the household app paints without the chat footer", () => {
    expect(paintedNotes({ locale: "en" }, true)).toEqual([]);
});

test("the standalone preview still shows the footer", () => {
    expect(
        paintedNotes(undefined, false).some((n) => n.startsWith(FOOTER)),
    ).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test public/widgets/bridge-seeded.test.ts`
Expected: `data seeded by the household app…` FAILS (it receives the footer string); `the standalone preview…` PASSES.

- [ ] **Step 3: Skip the footer for seeded data**

In `public/widgets/src/shared/bridge.js`, replace the comment and opening of `paint`:

```js
    // Render, then append a small persistent note at the bottom explaining that
    // widget display is a user setting. render() replaces #root wholesale, so
    // the footer is re-appended after every paint. Skipped when a widget
    // deliberately renders nothing (e.g. meal-logged with no goals) so an empty
    // widget stays empty and the host collapses it.
    function paint(data) {
        config.render(data);
        painted = true;
        const el = root();
        if (!el || el.innerHTML.trim() === "") return;
```

with:

```js
    // Render, then append a small persistent note at the bottom explaining that
    // widget display is a user setting. render() replaces #root wholesale, so
    // the footer is re-appended after every paint. Skipped when a widget
    // deliberately renders nothing (e.g. meal-logged with no goals) so an empty
    // widget stays empty and the host collapses it, and when withFooter is
    // false: the household web app seeds its own data, and "just ask to update
    // your settings" is chat copy that is wrong on a web page.
    function paint(data, withFooter) {
        config.render(data);
        painted = true;
        const el = root();
        if (withFooter === false || !el || el.innerHTML.trim() === "") return;
```

Replace, in the seeded branch near the end of `initWidget`:

```js
    if (seeded) {
        paint(seeded);
```

with:

```js
    if (seeded) {
        paint(seeded, false);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test public/widgets/ src/widgets.test.ts`
Expected: PASS.

- [ ] **Step 5: Align the iframe with the page**

In `public/app/app.css`, replace the `.widget-frame` rule with:

```css
/* Widgets render in srcdoc iframes whose .wrap.tight adds a 12px gutter
   (14px from 560px; base.css). Pull the frame out by the same amount so the
   widget card's edges line up with the page's own panels. */
.widget-frame {
    display: block;
    width: calc(100% + 24px);
    min-height: 120px;
    margin: -12px;
    border: 0;
    background: transparent;
}
@media (min-width: 560px) {
    .widget-frame {
        width: calc(100% + 28px);
        margin: -14px;
    }
}
```

- [ ] **Step 6: Look at the result**

Run: `bun run preview:app --shots`
Expected in `nutrition-light.png`: the Nutrition summary and Goal progress cards are the same width as the page content (left and right edges line up with the member switch above them), and no "You can enable or disable these widgets" line appears under any card.

- [ ] **Step 7: Format and commit**

```bash
bun run format
git add public/widgets/src/shared/bridge.js public/widgets/bridge-seeded.test.ts public/app/app.css
git commit -m "Fit embedded widgets to the page and drop their chat footer there.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## PR 3 — Page layouts

### Task 5: Rows, disclosures and the food picker; the Fridge page

Introduces the list vocabulary (`.list`, `.row`, `.row-title`, `.row-meta`, `.row-actions`, `details.more`) and applies it to the fridge. Item edit and delete move behind an "Edit" disclosure; "Add food", "Add supply" and "Add location" become disclosures. The picker tabs become a segmented control.

**Files:**

- Modify: `public/app/app.css` (lists, rows, disclosure, picker tabs)
- Modify: `src/web/components/page-markup.ts` (`renderExpiringStrip`, `renderFridgeItemRow`)
- Modify: `src/web/components/food-picker.ts` (tab classes, primary submits)
- Modify: `src/web/pages/fridge.ts` (`itemRow`, `locationSection`, `renderFridgePage`)
- Test: `src/domain/fridge.test.ts`, `src/web/components/shared-import.test.ts`

**Interfaces:**

- Produces CSS: `.list` (ul, rows split by hairlines), `.row` (flex: `.row-title` left, `.row-meta` pushed right), `.row-actions` (wrapping button row; direct `form` children are `display: contents`; an open `details` takes the full width), `details.more` (button-like `summary` with a chevron; a heading inside `summary` keeps its tag but reads as the label).
- `renderFridgeItemRow(opts)` gains `expiresOn?: string | null`. Other options unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/fridge.test.ts` (imports `renderFridgePage` already exist in that file; if not, add `import { renderFridgePage } from "../web/pages/fridge.js";`):

```ts
test("fridge rows show quantity and expiry, with edit and delete behind a disclosure", () => {
    const html = renderFridgePage({
        chrome: { theme: "light" },
        locations: [
            { id: "loc-1", householdId: "hh-1", name: "Fridge", sortOrder: 0 },
        ],
        items: [
            {
                id: "it-1",
                householdId: "hh-1",
                locationId: "loc-1",
                kind: "food",
                displayName: "Eggs",
                quantity: { amount: 6, unit: "each" },
                identity: { kind: "food", via: "manual", displayName: "Eggs" },
                foodId: "f-1",
                expiresOn: "2026-10-08",
            },
        ],
    } as never);
    expect(html).toContain('<ul class="fridge-items list">');
    expect(html).toContain("6 each · exp 2026-10-08");
    expect(html).toMatch(
        /<details class="more">\s*<summary>Edit<\/summary>\s*<form class="fridge-item-edit"/,
    );
    expect(html).toContain(
        '<button type="submit" class="btn-danger">Delete</button>',
    );
    expect(html).toContain(
        '<button type="submit" class="btn-sm">Ate it</button>',
    );
    expect(html).toMatch(/<summary><h3>Add food<\/h3><\/summary>/);
    expect(html).toMatch(/<summary><h3>Add supply<\/h3><\/summary>/);
});

test("the add-location disclosure starts open only when there are no locations", () => {
    const empty = renderFridgePage({
        chrome: { theme: "light" },
        locations: [],
        items: [],
    } as never);
    expect(empty).toContain(
        '<details class="more" open>\n<summary>Add location</summary>',
    );
});
```

Append to `src/web/components/shared-import.test.ts`:

```ts
test("food picker tabs are a segmented control driven by aria-selected", () => {
    const html = renderFoodPicker();
    expect(html).toContain('class="food-picker-tabs seg" role="tablist"');
    expect(html).toContain(
        'class="seg-btn" id="food-picker-tab-barcode" data-tab="barcode"',
    );
    expect(html).toContain(
        '<button type="submit" class="btn-primary">Look up</button>',
    );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/domain/fridge.test.ts src/web/components/shared-import.test.ts`
Expected: the three new tests FAIL; existing tests pass.

- [ ] **Step 3: Add the row and disclosure vocabulary to `public/app/app.css`**

Append:

```css
/* ---- lists and rows ---- */

.list {
    list-style: none;
    margin: 0;
    padding: 0;
}
.list > li {
    display: grid;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid var(--panel-border);
}
.list > li:first-child {
    border-top: 0;
    padding-top: 2px;
}
.list:empty {
    display: none;
}

/* Title left, figure pushed right; wraps under the title on a narrow card. */
.row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
}
.row-title {
    min-width: 0;
    font-weight: 700;
    overflow-wrap: anywhere;
}
.row-meta {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

/* One wrapping line of row buttons. Each action is its own POST form; with
   display: contents the buttons sit in the line as if the forms were not
   there. An opened disclosure takes the whole width below them. */
.row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.row-actions > form {
    display: contents;
}
.row-actions > details[open] {
    flex-basis: 100%;
}
.row-actions select {
    width: auto;
    flex: 1 1 140px;
}

/* ---- disclosure ---- */

details.more > summary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    background: var(--panel);
    color: var(--text);
    font-size: 13.5px;
    font-weight: 600;
    list-style: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
details.more > summary::-webkit-details-marker {
    display: none;
}
details.more > summary::after {
    content: "";
    width: 7px;
    height: 7px;
    border-right: 1.75px solid var(--text-dim);
    border-bottom: 1.75px solid var(--text-dim);
    transform: translateY(-2px) rotate(45deg);
}
details.more[open] > summary::after {
    transform: translateY(1px) rotate(-135deg);
}
details.more[open] > summary {
    margin-bottom: 10px;
}
details.more > summary:hover {
    border-color: var(--text-dim);
}
details.more > summary:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
}
/* A heading inside a summary keeps its place in the outline but reads as the
   summary label. */
details.more > summary > :is(h2, h3) {
    margin: 0;
    font: inherit;
    color: inherit;
    text-transform: none;
    letter-spacing: normal;
}

/* ---- food picker tabs ---- */

.food-picker .seg {
    display: flex;
    margin: 0;
}
.food-picker .seg-btn {
    flex: 1;
    min-height: 36px;
}
```

- [ ] **Step 4: Fridge row helpers in `src/web/components/page-markup.ts`**

Replace `renderExpiringStrip` with:

```ts
export function renderExpiringStrip(
    items: { id: string; displayName: string; expiresOn: string }[],
): string {
    if (items.length === 0) return "";
    const rows = items
        .map(
            (item) =>
                `<li data-item-id="${escapeHtml(item.id)}"><div class="row"><span class="row-title">${escapeHtml(item.displayName)}</span><span class="row-meta">${escapeHtml(item.expiresOn)}</span></div></li>`,
        )
        .join("");
    return `<section class="fridge-expiring panel">
<h2>Expiring soon</h2>
<ul class="list">${rows}</ul>
</section>`;
}
```

Replace `renderFridgeItemRow` with:

```ts
export function renderFridgeItemRow(opts: {
    id: string;
    kind: string;
    displayName: string;
    quantityLabel: string;
    expiresOn?: string | null;
    editFields: string;
    extraActions?: string;
}): string {
    const id = escapeHtml(opts.id);
    const expires = opts.expiresOn
        ? ` · exp ${escapeHtml(opts.expiresOn)}`
        : "";
    return `<li class="fridge-item" data-item-id="${id}" data-kind="${opts.kind}">
<div class="fridge-item-head row">
<p class="fridge-item-name row-title">${escapeHtml(opts.displayName)}</p>
<p class="fridge-item-qty row-meta">${escapeHtml(opts.quantityLabel)}${expires}</p>
</div>
<div class="row-actions">
${opts.extraActions ?? ""}
<details class="more">
<summary>Edit</summary>
<form class="fridge-item-edit" method="post" action="/fridge/items/${id}">
${opts.editFields}
<button type="submit" class="btn-primary">Save</button>
</form>
<form class="fridge-item-delete" method="post" action="/fridge/items/${id}/delete">
<button type="submit" class="btn-danger">Delete</button>
</form>
</details>
</div>
</li>`;
}
```

- [ ] **Step 5: Segmented picker tabs in `src/web/components/food-picker.ts`**

In `renderFoodPicker`, make these replacements in the returned template:

- `<div class="food-picker-tabs" role="tablist" aria-label="Food identity">` → `<div class="food-picker-tabs seg" role="tablist" aria-label="Food identity">`
- each of the three `<button type="button" role="tab" id=` → `<button type="button" role="tab" class="seg-btn" id=`
- `<button type="submit">${escapeHtml(barcodeSubmit)}</button>` → `<button type="submit" class="btn-primary">${escapeHtml(barcodeSubmit)}</button>`

In `manualBlock` (the `method === "post"` branch), replace `<button type="submit">Add food</button>` with `<button type="submit" class="btn-primary">Add food</button>`.

Do not touch `pickerScript`.

- [ ] **Step 6: Fridge page layout in `src/web/pages/fridge.ts`**

In `itemRow`, add `expiresOn: item.expiresOn,` after `quantityLabel: quantityLabel(item),`, and replace the `extraActions` value with:

```ts
        extraActions:
            item.foodId == null
                ? ""
                : `<form class="fridge-item-eat" method="post" action="/fridge/items/${escapeHtml(item.id)}/eat">
<button type="submit" class="btn-sm">Ate it</button>
</form>
<form class="fridge-item-discard" method="post" action="/fridge/items/${escapeHtml(item.id)}/discard">
<button type="submit" class="btn-sm">Toss</button>
</form>`,
```

Replace the `return` of `locationSection` with:

```ts
return `<section class="fridge-location panel" data-location-id="${escapeHtml(location.id)}">
<div class="fridge-location-head row">
<h2 class="row-title">${escapeHtml(location.name)}</h2>
<form class="row-meta" method="post" action="/fridge/locations/${escapeHtml(location.id)}/delete">
<button type="submit" class="btn-sm btn-danger">Remove</button>
</form>
</div>
${empty}
<ul class="fridge-items list">${rows}</ul>
<details class="more">
<summary><h3>Add food</h3></summary>
${renderFoodPicker({
    id: pickerId,
    action: "/fridge/items",
    method: "post",
    hiddenFields: { kind: "food", location_id: location.id },
    includeQuantity: true,
})}
</details>
<details class="more">
<summary><h3>Add supply</h3></summary>
<form class="fridge-add-supply" method="post" action="/fridge/items">
<input type="hidden" name="kind" value="supply" />
<input type="hidden" name="location_id" value="${escapeHtml(location.id)}" />
<label for="supply-name-${escapeHtml(location.id)}">Name</label>
<input id="supply-name-${escapeHtml(location.id)}" name="name" type="text" required autocomplete="off" />
${renderQuantityField({
    kind: "supply",
    unit: "roll",
    units: SUPPLY_UNITS,
    idPrefix: `supply-qty-${location.id}`,
    namePrefix: "qty",
    required: true,
})}
<button type="submit" class="btn-primary">Add supply</button>
</form>
</details>
</section>`;
```

In `renderFridgePage`, replace the `body` template with:

```ts
const body = `
        <h1>Fridge</h1>
        ${error}
        ${emptyPrompt}
        ${expiring}
        ${sections}
        <details class="more"${view.locations.length === 0 ? " open" : ""}>
<summary>Add location</summary>
<form class="fridge-add-location" method="post" action="/fridge/locations">
<label for="location_name">Location name</label>
<input id="location_name" name="name" type="text" required maxlength="80" autocomplete="off" />
<button type="submit" class="btn-primary">Add location</button>
</form>
</details>
    `;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `bun test`
Expected: PASS.

- [ ] **Step 8: Look at the result**

Run: `bun run preview:app --shots`
Expected in `fridge-light.png`: "Expiring soon" card with two rows, the date right-aligned. Each location card shows its name with a small red "Remove", then one row per item (bold name left, "6 each · exp 2026-10-08" right) with "Ate it", "Toss" and an "Edit ⌄" pill beneath. "Add food" and "Add supply" are closed pills. "Add location" is a closed pill at the bottom. Nothing below the rows is expanded.

- [ ] **Step 9: Format and commit**

```bash
bun run format
git add public/app/app.css src/web/components/page-markup.ts src/web/components/food-picker.ts src/web/pages/fridge.ts src/domain/fridge.test.ts src/web/components/shared-import.test.ts
git commit -m "Compact fridge rows with edit behind a disclosure, and segmented picker tabs.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Grocery page

Lines become rows with a round check button on the left. Put-away is a single inline row. "Add food" (with its section select) and "Add store" become disclosures; "Clear checked" is a small button that only appears once a store exists.

**Files:**

- Modify: `public/app/app.css` (check button, grocery sections)
- Modify: `src/web/components/page-markup.ts` (`renderGroceryLineRow`)
- Modify: `src/web/pages/grocery.ts` (`lineRow`, `storeSection`, `renderGroceryPage`)
- Test: `src/domain/grocery.test.ts`

**Interfaces:**

- Consumes: `.list`, `.row`, `.row-title`, `.row-meta`, `.row-actions`, `details.more` from Task 5.
- Produces CSS: `.check-btn` (44px hit area, 24px circle; `aria-pressed="true"` fills it with the accent and draws a tick).
- `renderGroceryLineRow(opts)` keeps its options; its markup changes.

- [ ] **Step 1: Write the failing test**

Append to `src/domain/grocery.test.ts`:

```ts
test("grocery lines are rows with a labelled round check button", () => {
    const html = renderGroceryPage({
        chrome: { theme: "light" },
        isOwner: true,
        locations: [{ id: "l1", name: "Fridge" }],
        stores: [
            {
                id: "st-1",
                householdId: "hh-1",
                name: "Corner",
                sortOrder: 0,
                rules: [],
                sections: [
                    {
                        id: "sec-other",
                        householdId: "hh-1",
                        storeId: "st-1",
                        name: "Other",
                        sortOrder: 8,
                        hidden: false,
                        isOther: true,
                        lines: [
                            {
                                id: "line-1",
                                householdId: "hh-1",
                                storeId: "st-1",
                                sectionId: "sec-other",
                                kind: "food",
                                displayName: "Milk",
                                quantity: { amount: 1, unit: "each" },
                                identity: {
                                    kind: "food",
                                    via: "manual",
                                    displayName: "Milk",
                                },
                                foodId: "f-1",
                                checked: true,
                                alreadyHave: null,
                            },
                        ],
                    },
                ],
            },
        ],
    } as never);
    expect(html).toContain('<ul class="grocery-lines list">');
    expect(html).toContain(
        '<button type="submit" class="check-btn" aria-pressed="true"><span class="visually-hidden">Uncheck Milk</span></button>',
    );
    expect(html).toContain('<form class="grocery-put-away row-actions"');
    expect(html).toContain(
        '<button type="submit" class="btn-sm btn-primary">Put away</button>',
    );
    expect(html).toMatch(
        /<summary><h3>Add food<\/h3><\/summary>\s*<label for="section-st-1">/,
    );
    expect(html).toContain("<summary>Add store</summary>");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/domain/grocery.test.ts`
Expected: the new test FAILS; existing tests pass.

- [ ] **Step 3: Add grocery CSS to `public/app/app.css`**

Append:

```css
/* ---- grocery ---- */

.grocery-section {
    display: grid;
    gap: 6px;
}
.grocery-line-head {
    align-items: center;
    flex-wrap: nowrap;
}
.grocery-line-head .row-title {
    flex: 1 1 auto;
}
.grocery-line.is-checked .grocery-line-name {
    color: var(--text-dim);
    text-decoration: line-through;
}
.store-rule-list {
    margin: 0;
    padding-left: 1.1em;
}

/* Round check button: a 44px target with a 24px circle drawn inside it. */
.check-btn {
    position: relative;
    flex: none;
    width: 44px;
    height: 44px;
    min-height: 44px;
    margin: -10px -6px -10px -10px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
}
.check-btn::before {
    content: "";
    position: absolute;
    inset: 10px;
    border: 1.75px solid var(--text-dim);
    border-radius: 999px;
}
.check-btn:hover::before {
    border-color: var(--text);
}
.check-btn[aria-pressed="true"]::before {
    border-color: var(--accent);
    background: var(--accent);
}
.check-btn[aria-pressed="true"]::after {
    content: "";
    position: absolute;
    left: 19px;
    top: 14px;
    width: 6px;
    height: 11px;
    border-right: 2px solid var(--bg);
    border-bottom: 2px solid var(--bg);
    transform: rotate(45deg);
}
.check-btn:focus-visible {
    box-shadow: none;
}
.check-btn:focus-visible::before {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
}
```

- [ ] **Step 4: Grocery line markup in `src/web/components/page-markup.ts`**

Replace `renderGroceryLineRow` with:

```ts
export function renderGroceryLineRow(opts: {
    id: string;
    kind: string;
    checked: boolean;
    displayName: string;
    quantityLabel: string;
    alreadyHaveHtml: string;
    putAwayHtml?: string;
}): string {
    const checked = opts.checked ? "true" : "false";
    const next = opts.checked ? "0" : "1";
    const verb = opts.checked ? "Uncheck" : "Check";
    return `<li class="grocery-line${opts.checked ? " is-checked" : ""}" data-line-id="${escapeHtml(opts.id)}" data-checked="${checked}" data-kind="${opts.kind}">
<div class="grocery-line-head row">
<form class="grocery-line-check" method="post" action="/grocery/lines/${escapeHtml(opts.id)}/check">
<input type="hidden" name="checked" value="${next}" />
<button type="submit" class="check-btn" aria-pressed="${checked}"><span class="visually-hidden">${verb} ${escapeHtml(opts.displayName)}</span></button>
</form>
<p class="grocery-line-name row-title">${escapeHtml(opts.displayName)}</p>
${opts.alreadyHaveHtml}
<p class="grocery-line-qty row-meta">${escapeHtml(opts.quantityLabel)}</p>
</div>
${opts.putAwayHtml ?? ""}
</li>`;
}
```

- [ ] **Step 5: Grocery page layout in `src/web/pages/grocery.ts`**

In `lineRow`, replace the `putAwayHtml = …` assignment with:

```ts
putAwayHtml = `<form class="grocery-put-away row-actions" method="post" action="/grocery/lines/${escapeHtml(line.id)}/put-away">
<label class="visually-hidden" for="put-away-loc-${escapeHtml(line.id)}">Location</label>
<select id="put-away-loc-${escapeHtml(line.id)}" name="location_id">${options}</select>
<button type="submit" class="btn-sm btn-primary">Put away</button>
</form>`;
```

In `storeSection`, replace the per-section `return` inside `.map((section) => { … })` with:

```ts
return `<section class="grocery-section psec" data-section-id="${escapeHtml(section.id)}" data-section-name="${escapeHtml(section.name)}">
<h3>${escapeHtml(section.name)}</h3>
<ul class="grocery-lines list">${rows}</ul>
</section>`;
```

and replace the final `return` of `storeSection` with:

```ts
return `<section class="grocery-store panel" data-store-id="${escapeHtml(store.id)}">
<h2>${escapeHtml(store.name)}</h2>
${rules ? `<ul class="store-rule-list muted">${rules}</ul>` : ""}
${sections}
<details class="more">
<summary><h3>Add food</h3></summary>
${storeSectionSelect(store)}
${renderFoodPicker({
    id: pickerId,
    action: "/grocery/lines",
    method: "post",
    hiddenFields: hidden,
    includeQuantity: true,
})}
</details>
</section>`;
```

In `renderGroceryPage`, replace the `addStore` constant with:

```ts
const addStore = view.isOwner
    ? `<details class="more"${view.stores.length === 0 ? " open" : ""}>
<summary>Add store</summary>
<form class="grocery-add-store" method="post" action="/grocery/stores">
<label for="grocery_store_name">Grocery store</label>
<input id="grocery_store_name" name="name" maxlength="80" autocomplete="off" />
<button type="submit" class="btn-primary">Add store</button>
</form>
</details>`
    : "";
const clearChecked =
    view.stores.length === 0
        ? ""
        : `<form class="grocery-clear-checked" method="post" action="/grocery/clear-checked">
<button type="submit" class="btn-sm">Clear checked</button>
</form>`;
```

and replace the start of the `body` template, from `<h1>Groceries</h1>` up to and including `${stores}`, with:

```ts
        <h1>Groceries</h1>
        ${error}
        ${allergen}
        ${empty}
        ${stores}
        ${clearChecked}
        ${addStore}
```

Keep the `<script>` block that follows unchanged.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test`
Expected: PASS. The existing `owner grocery page…` tests still find `class="grocery-add-store"` (inside the disclosure) and `action="/grocery/clear-checked"` (a store exists in those fixtures).

- [ ] **Step 7: Look at the result**

Run: `bun run preview:app --shots`
Expected in `grocery-light.png`: one Safeway card. "Prefer store brand." in grey, then "PRODUCE" with Bananas (empty circle, "6 each" on the right) and Spinach (green filled circle with a tick, struck through, "300 g"), followed by a one-line "Fridge ⌄ | Put away" row. "OTHER" shows Eggs with the green "have 6 each, need 12 each" pill. A closed "Add food" pill ends the card. Below it, a small "Clear checked" button and a closed "Add store" pill.

- [ ] **Step 8: Format and commit**

```bash
bun run format
git add public/app/app.css src/web/components/page-markup.ts src/web/pages/grocery.ts src/domain/grocery.test.ts
git commit -m "Grocery lines as rows with a round check button.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Recipes list and recipe detail

The list becomes one card of rows with tag pills; filters and "New recipe" become disclosures. The detail page groups its eight forms into Nutrition, Ingredients, Cook and log, and Groceries cards. "Edit recipe" becomes a disclosure and "Delete recipe" a danger button.

**Files:**

- Modify: `public/app/app.css` (`.inline-form`, `.field-grid`, recipe bits)
- Modify: `src/web/components/page-markup.ts` (`renderRecipeCard`, `renderRecipeIngredientRow`)
- Modify: `src/web/pages/recipes.ts` (`renderRecipesPage` body, `renderRecipeDetailPage` body)
- Test: `src/domain/recipes.test.ts`

**Interfaces:**

- Consumes: Task 5 row vocabulary.
- Produces CSS: `.inline-form` (label on its own line, then control and button side by side), `.field-grid` (two columns of `<label>Text<input></label>` pairs; a direct `button` child spans both columns).

- [ ] **Step 1: Write the failing test**

Append to `src/domain/recipes.test.ts` (add `import { renderRecipeDetailPage, renderRecipesPage } from "../web/pages/recipes.js";` at the top if that file does not already import them):

```ts
test("recipe pages group forms into cards and disclosures", () => {
    const recipe = {
        id: "r1",
        householdId: "hh-1",
        creatorId: "u1",
        name: "Mac",
        yieldPortions: 4,
        instructions: null,
        sourceUrl: null,
        tags: ["dinner"],
        notes: null,
        prepMinutes: null,
        cookMinutes: null,
    };
    const list = renderRecipesPage({
        chrome: { theme: "light" },
        recipes: [recipe],
        members: [],
        viewerId: "u1",
    } as never);
    expect(list).toContain('<ul class="recipe-list list">');
    expect(list).toContain(
        '<span class="recipe-tag pill pill-dim">dinner</span>',
    );
    expect(list).toContain("<summary>Filter</summary>");
    expect(list).toContain("<summary>New recipe</summary>");

    const detail = renderRecipeDetailPage({
        chrome: { theme: "light" },
        recipe,
        ingredients: [
            {
                id: "ing1",
                recipeId: "r1",
                foodId: "f1",
                displayName: "Pasta",
                quantity: { amount: 400, unit: "g" },
                note: null,
                sortOrder: 0,
                perPortionAmount: 100,
                personAmount: 100,
            },
        ],
        members: [{ userId: "u1", displayName: "Ethan" }],
        stores: [{ id: "s1", name: "Safeway" }],
        viewerId: "u1",
        filterUserId: "u1",
        portionCount: 1,
        macros: {
            calories: 300,
            protein_g: 10,
            carbs_g: 50,
            fat_g: 5,
            fiber_g: 3,
            sugar_g: 2,
            alcohol_g: 0,
            incomplete: false,
            incompleteReasons: [],
        },
        isOwner: true,
    } as never);
    for (const heading of [
        "Nutrition",
        "Ingredients",
        "Cook and log",
        "Groceries",
    ]) {
        expect(detail).toContain(`<h2>${heading}</h2>`);
    }
    expect(detail).toContain('<ul class="recipe-ingredients list">');
    expect(detail).toContain('aria-label="Move Pasta up"');
    expect(detail).toContain("<summary>Edit recipe</summary>");
    expect(detail).toContain(
        '<button type="submit" class="btn-danger">Delete recipe</button>',
    );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/domain/recipes.test.ts`
Expected: the new test FAILS.

- [ ] **Step 3: Add form-layout and recipe CSS to `public/app/app.css`**

Append:

```css
/* ---- compact form layouts ---- */

/* Label on its own line, then the control and its button side by side. */
.inline-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 6px 8px;
}
.inline-form > label {
    grid-column: 1 / -1;
}

/* Two columns of <label>Text<input></label> pairs. */
.field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
    align-items: end;
}
.field-grid > label {
    display: grid;
    gap: 4px;
}
.field-grid > :is(button, fieldset, .span-2) {
    grid-column: 1 / -1;
}

/* ---- recipes ---- */

.recipe-card .row-title {
    color: var(--text);
}
.recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.recipe-macros {
    font-size: 14px;
    font-weight: 600;
}
.recipe-macros-reasons {
    margin: 0;
    padding-left: 1.1em;
    color: var(--text-dim);
    font-size: 13px;
}
.recipe-ingredient-note {
    font-style: italic;
}
```

- [ ] **Step 4: Recipe row helpers in `src/web/components/page-markup.ts`**

Replace `renderRecipeCard` with:

```ts
export function renderRecipeCard(opts: {
    id: string;
    name: string;
    yieldPortions: number;
    tags?: string[];
}): string {
    const tags =
        opts.tags && opts.tags.length > 0
            ? `<p class="recipe-tags">${opts.tags
                  .map(
                      (tag) =>
                          `<span class="recipe-tag pill pill-dim">${escapeHtml(tag)}</span>`,
                  )
                  .join("")}</p>`
            : "";
    return `<li class="recipe-card" data-recipe-id="${escapeHtml(opts.id)}">
<div class="row">
<a class="row-title" href="/recipes/${escapeHtml(opts.id)}">${escapeHtml(opts.name)}</a>
<p class="recipe-yield row-meta">Yield ${escapeHtml(String(opts.yieldPortions))}</p>
</div>
${tags}
</li>`;
}
```

Replace `renderRecipeIngredientRow` with:

```ts
export function renderRecipeIngredientRow(opts: {
    id: string;
    recipeId: string;
    displayName: string;
    totalLabel: string;
    perPortionLabel: string;
    personLabel: string;
    perPortionAmount: number;
    personAmount: number;
    totalAmount: number;
    note?: string | null;
}): string {
    const note = opts.note
        ? `<p class="recipe-ingredient-note muted">${escapeHtml(opts.note)}</p>`
        : "";
    const id = escapeHtml(opts.id);
    const recipeId = escapeHtml(opts.recipeId);
    const name = escapeHtml(opts.displayName);
    return `<li class="recipe-ingredient" data-ingredient-id="${id}" data-per-portion="${escapeHtml(String(opts.perPortionAmount))}" data-person-amount="${escapeHtml(String(opts.personAmount))}">
<div class="row">
<p class="recipe-ingredient-name row-title">${name}</p>
<p class="recipe-ingredient-total row-meta">Total ${escapeHtml(opts.totalLabel)}</p>
</div>
<p class="recipe-ingredient-per-portion muted">Per portion ${escapeHtml(opts.perPortionLabel)}</p>
<p class="recipe-ingredient-person muted">${escapeHtml(opts.personLabel)}</p>
${note}
<div class="row-actions">
<form class="recipe-ingredient-move" method="post" action="/recipes/${recipeId}/ingredients/${id}/move">
<button type="submit" name="direction" value="up" class="btn-sm" aria-label="Move ${name} up">↑</button>
<button type="submit" name="direction" value="down" class="btn-sm" aria-label="Move ${name} down">↓</button>
</form>
<details class="more">
<summary>Edit</summary>
<form class="recipe-ingredient-edit" method="post" action="/recipes/${recipeId}/ingredients/${id}">
<label for="note-${id}">Note</label>
<input id="note-${id}" name="note" type="text" maxlength="500" value="${escapeHtml(opts.note ?? "")}" autocomplete="off" />
<label for="amount-${id}">Amount</label>
<input id="amount-${id}" name="amount" type="number" min="0" step="any" required value="${escapeHtml(String(opts.totalAmount))}" />
<button type="submit" class="btn-primary">Save ingredient</button>
</form>
</details>
<form class="recipe-ingredient-delete" method="post" action="/recipes/${recipeId}/ingredients/${id}/delete">
<button type="submit" class="btn-sm btn-danger">Remove</button>
</form>
</div>
</li>`;
}
```

- [ ] **Step 5: Recipes list body in `src/web/pages/recipes.ts`**

In `renderRecipesPage`, replace the `body` template with:

```ts
const filtering =
    filter.tag !== "" || filter.canMakeNow || filter.safeFor !== "";
const list =
    view.recipes.length === 0
        ? ""
        : `<section class="panel"><ul class="recipe-list list">${cards}</ul></section>`;
const body = `
        <h1>Recipes</h1>
        ${error}
        <details class="more"${filtering ? " open" : ""}>
            <summary>Filter</summary>
            <form class="recipe-list-filters" method="get" action="/recipes">
                <label for="recipe-tag">Tag</label>
                <input id="recipe-tag" name="tag" type="text" value="${escapeHtml(filter.tag)}" autocomplete="off" />
                <label class="recipe-filter-check">
                    <input type="checkbox" name="can_make_now" value="1"${filter.canMakeNow ? " checked" : ""} />
                    Can make now
                </label>
                <label for="recipe-safe-for">Safe for</label>
                <select id="recipe-safe-for" name="safe_for">${memberOptions}</select>
                <button type="submit" class="btn-primary">Filter</button>
            </form>
        </details>
        ${empty}
        ${list}
        <details class="more"${view.recipes.length === 0 ? " open" : ""}>
            <summary>New recipe</summary>
            <form class="recipe-create" method="post" action="/recipes">
                <label for="recipe-name">Name</label>
                <input id="recipe-name" name="name" type="text" required maxlength="80" autocomplete="off" />
                <label for="recipe-yield">Yield</label>
                <input id="recipe-yield" name="yield_portions" type="number" min="0" step="any" required value="4" />
                <button type="submit" class="btn-primary">Create recipe</button>
            </form>
        </details>
    `;
```

- [ ] **Step 6: Recipe detail body in `src/web/pages/recipes.ts`**

In `renderRecipeDetailPage`, replace the `portion` constant with:

```ts
const portion = viewingSelf
    ? `<form class="recipe-portion inline-form" method="post" action="/recipes/${escapeHtml(view.recipe.id)}/portions">
<label for="portion-count">Your portion</label>
<input id="portion-count" name="portion_count" type="number" min="0" step="any" required value="${escapeHtml(String(view.portionCount))}" />
<button type="submit">Save</button>
</form>`
    : `<p class="person-portion muted" data-portion-count="${escapeHtml(String(view.portionCount))}" data-readonly="true">Portion ${escapeHtml(String(view.portionCount))}</p>`;
```

Replace, in the `grocery` constant, `<button type="submit">Add to grocery</button>` with `<button type="submit" class="btn-primary">Add to grocery</button>`.

Replace the `body` template with:

```ts
const body = `
        <p class="recipe-back"><a href="/recipes">← Recipes</a></p>
        <h1>${escapeHtml(view.recipe.name)}</h1>
        ${error}
        ${allergen}
        ${dislike}
        <p class="recipe-yield muted" data-yield="${escapeHtml(String(view.recipe.yieldPortions))}">Yield ${escapeHtml(String(view.recipe.yieldPortions))}</p>
        <section class="panel">
            <h2>Nutrition</h2>
            <form class="recipe-filter inline-form" method="get" action="/recipes/${recipeId}" data-filter-member="${escapeHtml(view.filterUserId)}">
                <label for="recipe-member">Filter by person</label>
                <select id="recipe-member" name="member">${memberOptions}</select>
                <button type="submit">View</button>
            </form>
            ${portion}
            ${macrosBlock(perPortion, "portion")}
            ${personMacros}
        </section>
        <section class="panel">
            <h2>Ingredients</h2>
            <ul class="recipe-ingredients list">${rows}</ul>
            <details class="more">
                <summary>Add ingredient</summary>
                ${renderFoodPicker({
                    id: "recipe-picker",
                    action: `/recipes/${view.recipe.id}/ingredients`,
                    method: "post",
                    includeQuantity: true,
                })}
            </details>
        </section>
        <section class="panel">
            <h2>Cook and log</h2>
            <form class="recipe-log-portion field-grid" method="post" action="/recipes/${recipeId}/log-portion">
                <label>Portions
                    <input id="log-portion-count" name="portions" type="number" min="0" step="any" required value="${escapeHtml(String(view.portionCount))}" />
                </label>
                <label>Meal type
                    <select id="log-portion-type" name="meal_type">
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="snack" selected>Snack</option>
                    </select>
                </label>
                <button type="submit" class="btn-primary">Log a portion</button>
            </form>
            <details class="more">
                <summary>Cooked it</summary>
                <form class="recipe-cook field-grid" method="post" action="/recipes/${recipeId}/cook">
                    ${view.members
                        .map((member) => {
                            const value =
                                member.userId === view.viewerId
                                    ? String(view.portionCount)
                                    : "1";
                            return `<label>${escapeHtml(member.displayName)}
<input id="cook-portion-${escapeHtml(member.userId)}" name="portion:${escapeHtml(member.userId)}" type="number" min="0" step="any" value="${escapeHtml(value)}" />
</label>`;
                        })
                        .join("")}
                    <label>Meal type
                        <select id="cook-meal-type" name="meal_type">
                            <option value="breakfast">Breakfast</option>
                            <option value="lunch">Lunch</option>
                            <option value="dinner" selected>Dinner</option>
                            <option value="snack">Snack</option>
                        </select>
                    </label>
                    <fieldset class="choice-row">
                        <legend>Also</legend>
                        <label><input type="checkbox" name="deduct_stock" value="1" checked /> Deduct stock</label>
                        <label><input type="checkbox" name="log_meals" value="1" checked /> Log meals</label>
                    </fieldset>
                    <button type="submit" class="btn-primary">Cooked it</button>
                </form>
            </details>
        </section>
        <section class="panel">
            <h2>Groceries</h2>
            ${grocery}
        </section>
        <details class="more">
            <summary>Edit recipe</summary>
            <form class="recipe-edit" method="post" action="/recipes/${recipeId}">
                <label for="edit-name">Name</label>
                <input id="edit-name" name="name" type="text" required maxlength="80" value="${escapeHtml(view.recipe.name)}" />
                <label for="edit-yield">Yield</label>
                <input id="edit-yield" name="yield_portions" type="number" min="0" step="any" required value="${escapeHtml(String(view.recipe.yieldPortions))}" />
                <label for="edit-source">Source URL</label>
                <input id="edit-source" name="source_url" type="text" value="${escapeHtml(view.recipe.sourceUrl ?? "")}" />
                <label for="edit-tags">Tags</label>
                <input id="edit-tags" name="tags" type="text" value="${tagsValue}" placeholder="dinner, vegetarian" />
                <label for="edit-prep">Prep minutes</label>
                <input id="edit-prep" name="prep_minutes" type="number" min="0" step="1" value="${escapeHtml(view.recipe.prepMinutes == null ? "" : String(view.recipe.prepMinutes))}" />
                <label for="edit-cook">Cook minutes</label>
                <input id="edit-cook" name="cook_minutes" type="number" min="0" step="1" value="${escapeHtml(view.recipe.cookMinutes == null ? "" : String(view.recipe.cookMinutes))}" />
                <label for="edit-instructions">Instructions</label>
                <textarea id="edit-instructions" name="instructions" rows="8">${escapeHtml(view.recipe.instructions ?? "")}</textarea>
                <label for="edit-notes">Notes</label>
                <textarea id="edit-notes" name="notes" rows="3">${escapeHtml(view.recipe.notes ?? "")}</textarea>
                <button type="submit" class="btn-primary">Save recipe</button>
            </form>
        </details>
        <form class="recipe-delete" method="post" action="/recipes/${recipeId}/delete">
            <button type="submit" class="btn-danger">Delete recipe</button>
        </form>
    `;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `bun test`
Expected: PASS. `recipes.test.ts`'s existing assertions on `class="quantity-field"`, `class="food-picker"`, `class="member-multi-select"` and `class="dislike-note"` still match.

- [ ] **Step 8: Look at the result**

Run: `bun run preview:app --shots`
Expected: `recipes-light.png` shows a closed "Filter" pill, one card with "Shakshuka … Yield 4" and two grey tag pills, and a closed "New recipe" pill. `recipe-light.png` shows four titled cards: Nutrition (person select and View side by side, portion field and Save side by side, the macro line), Ingredients (Eggs row with ↑ ↓, Edit, Remove), Cook and log (Portions and Meal type side by side, a green "Log a portion" button, a closed "Cooked it" pill) and Groceries. Then the "Edit recipe" pill and a red-outlined "Delete recipe".

- [ ] **Step 9: Format and commit**

```bash
bun run format
git add public/app/app.css src/web/components/page-markup.ts src/web/pages/recipes.ts src/domain/recipes.test.ts
git commit -m "Group recipe forms into cards and disclosures.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Settings, Household and Foods pages

Adds a shared Account / Household / Foods sub-navigation. The household page becomes four cards: Household, Members, Grocery stores and Rules. Allergens and dislikes become pills, and edit forms go behind disclosures. Foods becomes a list of rows, each with an "Edit" disclosure holding a two-column nutrient grid.

**Files:**

- Create: `src/web/components/settings-nav.ts`
- Create: `src/web/components/settings-nav.test.ts`
- Modify: `src/web/pages/settings.ts` (use the nav)
- Modify: `src/app/settings/household.ts` (`addMemberFormHtml`, `sectionRow`, `storeCard`, `memberRulesCard`, `renderHouseholdSettingsPage`)
- Modify: `src/web/pages/foods.ts` (`nutrientInput`, `foodCard` → `foodRow`, `renderFoodsSettingsPage`)
- Modify: `public/app/app.css` (`.pills`)
- Test: `src/domain/settings.test.ts`

**Interfaces:**

- Produces: `export type SettingsSection = "account" | "household" | "foods";` and `export function renderSettingsNav(active: SettingsSection): string` in `src/web/components/settings-nav.ts`. It returns `<nav class="subnav" aria-label="Settings sections">…</nav>` with `aria-current="page"` on the active link.
- Consumes: `.inline-form`, `.field-grid` (Task 7); `.list`, `.row`, `details.more` (Task 5); `.choice-row` (Task 3); `.subnav` (Task 2).

- [ ] **Step 1: Write the failing tests**

Create `src/web/components/settings-nav.test.ts`:

```ts
import { test, expect } from "bun:test";
import { renderSettingsNav } from "./settings-nav.js";

test("settings nav links every section and marks the active one", () => {
    const html = renderSettingsNav("household");
    expect(html).toBe(
        '<nav class="subnav" aria-label="Settings sections"><a href="/settings">Account</a><a href="/settings/household" aria-current="page">Household</a><a href="/settings/foods">Foods</a></nav>',
    );
});
```

Append to `src/domain/settings.test.ts`:

```ts
test("household settings groups owner tools into cards and disclosures", () => {
    const html = renderHouseholdSettingsPage({
        chrome,
        householdName: "Home",
        location: "",
        members: [alice, bob],
        stores: [],
        memberRules: [
            {
                member: alice,
                rules: [],
                allergens: [{ allergen: "peanut", otherLabel: null }],
                dislikes: [{ displayName: "Olives" }],
            },
        ],
        isOwner: true,
    } as never);
    expect(html).toContain(
        '<a href="/settings/household" aria-current="page">Household</a>',
    );
    for (const heading of ["Household", "Members", "Grocery stores", "Rules"]) {
        expect(html).toContain(`<h2>${heading}</h2>`);
    }
    expect(html).toContain("<summary>Add household member</summary>");
    expect(html).toContain('<li class="allergen pill pill-bad">');
    expect(html).toContain('<li class="dislike pill pill-dim">Olives</li>');
    expect(html).toContain(
        '<form method="post" action="/settings/household/name" class="household-name inline-form">',
    );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/web/components/settings-nav.test.ts src/domain/settings.test.ts`
Expected: FAIL. `./settings-nav.js` cannot be found, and the household assertions miss.

- [ ] **Step 3: Create `src/web/components/settings-nav.ts`**

```ts
const SECTIONS = [
    { id: "account", href: "/settings", label: "Account" },
    { id: "household", href: "/settings/household", label: "Household" },
    { id: "foods", href: "/settings/foods", label: "Foods" },
] as const;

export type SettingsSection = (typeof SECTIONS)[number]["id"];

/** Account / Household / Foods links, styled as a segmented control. */
export function renderSettingsNav(active: SettingsSection): string {
    const links = SECTIONS.map((section) => {
        const current = section.id === active ? ' aria-current="page"' : "";
        return `<a href="${section.href}"${current}>${section.label}</a>`;
    }).join("");
    return `<nav class="subnav" aria-label="Settings sections">${links}</nav>`;
}
```

- [ ] **Step 4: Use the nav on the Settings page**

In `src/web/pages/settings.ts`, add `import { renderSettingsNav } from "../components/settings-nav.js";` and, in the `body` template, replace:

```ts
        <p class="settings-lead"><a href="/settings/household">Household</a> · <a href="/settings/foods">Foods</a></p>
```

with:

```ts
        ${renderSettingsNav("account")}
```

and move `${error}` to directly after it, so the order is `<h1>`, nav, error, forms.

- [ ] **Step 5: Household page in `src/app/settings/household.ts`**

Add `import { renderSettingsNav } from "../../web/components/settings-nav.js";`.

Replace `addMemberFormHtml` with:

```ts
function addMemberFormHtml(error?: string): string {
    const banner = error
        ? `<p class="error-banner">${escapeHtml(error)}</p>`
        : "";
    return `<details class="more"${error ? " open" : ""}>
<summary>Add household member</summary>
<form method="POST" action="/settings/household" class="add-member">
${banner}
<label for="add_display_name">Name</label>
<input id="add_display_name" name="display_name" required maxlength="80" />
<label for="add_password">Password</label>
<input id="add_password" name="password" type="password" required />
<label for="add_email">Email</label>
<input id="add_email" name="email" type="email" />
<label for="add_username">Username</label>
<input id="add_username" name="username" autocomplete="username" />
<button type="submit" class="btn-primary">Add member</button>
</form>
</details>`;
}
```

In `sectionRow`, replace the editable branch's `return` with:

```ts
return `<li class="store-section">
<form class="section-rename inline-form" method="post" action="/settings/household/sections/${escapeHtml(section.id)}">
<label class="visually-hidden" for="section-name-${escapeHtml(section.id)}">Section name</label>
<input id="section-name-${escapeHtml(section.id)}" name="name" value="${escapeHtml(section.name)}" required maxlength="80" />
<button type="submit" class="btn-sm">Rename</button>
</form>
</li>`;
```

In `storeCard`, replace the `ruleForm` constant and the `return` with:

```ts
const ruleForm = canEdit
    ? `<details class="more">
<summary>Add store rule</summary>
<form method="post" action="/settings/household/stores/${escapeHtml(store.id)}/rules" class="store-rule-form">
<label for="store-rule-${escapeHtml(store.id)}">Store rule</label>
<textarea id="store-rule-${escapeHtml(store.id)}" name="body" required maxlength="500"></textarea>
<button type="submit" class="btn-primary">Save store rule</button>
</form>
</details>`
    : "";
return `<section class="household-store psec" data-store-id="${escapeHtml(store.id)}">
<h3>${escapeHtml(store.name)}</h3>
<ul class="store-section-list list">${sections}</ul>
<ul class="store-rule-list muted">${rules}</ul>
${ruleForm}
</section>`;
```

In `memberRulesCard`, replace the three `const allergens / dislikes / rules` list builders with:

```ts
const allergens = view.allergens
    .map(
        (row) =>
            `<li class="allergen pill pill-bad">${escapeHtml(allergenLabel(row))}</li>`,
    )
    .join("");
const dislikes = view.dislikes
    .map(
        (row) =>
            `<li class="dislike pill pill-dim">${escapeHtml(row.displayName)}</li>`,
    )
    .join("");
const rules = view.rules
    .map((row) => `<li class="person-rule">${escapeHtml(row.body)}</li>`)
    .join("");
```

In the `forms` template, change the three submit buttons to `class="btn-primary"` (`Save allergen`, `Save dislike`, `Save person rule`) and wrap the whole string in a disclosure:

```ts
const forms = canEdit
    ? `<details class="more">
<summary>Edit rules</summary>
<form method="post" action="/settings/household/members/${escapeHtml(view.member.userId)}/allergens" class="allergen-form">
<label for="allergen-${escapeHtml(view.member.userId)}">Allergen</label>
<select id="allergen-${escapeHtml(view.member.userId)}" name="allergen">
${allergenOptions}
<option value="other">Other</option>
</select>
<label for="allergen-other-${escapeHtml(view.member.userId)}">Other allergen</label>
<input id="allergen-other-${escapeHtml(view.member.userId)}" name="other_label" maxlength="80" />
<button type="submit" class="btn-primary">Save allergen</button>
</form>
<form method="post" action="/settings/household/members/${escapeHtml(view.member.userId)}/dislikes" class="dislike-form">
<label for="dislike-${escapeHtml(view.member.userId)}">Dislike</label>
<input id="dislike-${escapeHtml(view.member.userId)}" name="display_name" required maxlength="80" />
<button type="submit" class="btn-primary">Save dislike</button>
</form>
<form method="post" action="/settings/household/members/${escapeHtml(view.member.userId)}/rules" class="person-rule-form">
<label for="person-rule-${escapeHtml(view.member.userId)}">Person rule</label>
<textarea id="person-rule-${escapeHtml(view.member.userId)}" name="body" required maxlength="500"></textarea>
<button type="submit" class="btn-primary">Save person rule</button>
</form>
</details>`
    : "";
```

and replace its `return` with:

```ts
return `<section class="member-rules psec" data-user-id="${escapeHtml(view.member.userId)}">
<h3>${escapeHtml(view.member.displayName)}</h3>
<ul class="allergen-list pills">${allergens}</ul>
<ul class="dislike-list pills">${dislikes}</ul>
<ul class="person-rule-list muted">${rules}</ul>
${forms}
</section>`;
```

Replace everything in `renderHouseholdSettingsPage` from `const members = …` through the end of the `body` template with:

```ts
const members = view.members
    .map(
        (member) =>
            `<li class="household-member" data-role="${escapeHtml(member.role)}"><div class="row"><span class="row-title">${escapeHtml(member.displayName)}</span><span class="row-meta">${escapeHtml(member.role)}</span></div></li>`,
    )
    .join("");
const householdCard = view.isOwner
    ? `<form method="post" action="/settings/household/name" class="household-name inline-form">
<label for="household_name">Household name</label>
<input id="household_name" name="name" value="${escapeHtml(view.householdName)}" required maxlength="80" />
<button type="submit">Save</button>
</form>
<form method="post" action="/settings/household/location" class="household-location inline-form">
<label for="household_location">Household location</label>
<input id="household_location" name="location" value="${escapeHtml(view.location)}" maxlength="120" />
<button type="submit">Save</button>
</form>
<form method="post" action="/settings/household/rotate-token" class="rotate-token">
<button type="submit" class="btn-sm">Rotate household token</button>
</form>`
    : `<p class="household-name">${escapeHtml(view.householdName)}</p>
<p class="household-location muted">${view.location ? escapeHtml(view.location) : "No location set."}</p>`;
const addStore = view.isOwner
    ? `<details class="more"${view.stores.length === 0 ? " open" : ""}>
<summary>Add store</summary>
<form method="post" action="/settings/household/stores" class="add-store inline-form">
<label for="store_name">Grocery store</label>
<input id="store_name" name="name" required maxlength="80" autocomplete="off" />
<button type="submit" class="btn-primary">Add store</button>
</form>
</details>`
    : "";
const stores = view.stores
    .map((store) => storeCard(store, view.isOwner))
    .join("");
const memberRules = view.memberRules
    .map((row) => memberRulesCard(row, view.isOwner))
    .join("");
const body = `
        <h1>Household</h1>
        ${renderSettingsNav("household")}
        ${error}
        ${token}
        <section class="panel">
            <h2>Household</h2>
            ${householdCard}
        </section>
        <section class="panel">
            <h2>Members</h2>
            <ul class="household-members list">${members}</ul>
            ${view.isOwner ? addMemberFormHtml() : ""}
        </section>
        <section class="panel">
            <h2>Grocery stores</h2>
            ${stores || `<p class="empty-stores">Add a grocery store.</p>`}
            ${addStore}
        </section>
        <section class="panel">
            <h2>Rules</h2>
            ${memberRules}
        </section>
    `;
```

Delete the old `ownerForms` constant.

- [ ] **Step 6: Foods page in `src/web/pages/foods.ts`**

Add `import { renderSettingsNav } from "../components/settings-nav.js";`.

Replace `nutrientInput` with:

```ts
function nutrientInput(
    id: string,
    name: string,
    label: string,
    value: number | null,
): string {
    return `<label>${escapeHtml(label)}
<input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="number" min="0" step="0.1" value="${value == null ? "" : escapeHtml(String(value))}" />
</label>`;
}
```

Replace `foodCard` with:

```ts
function foodRow(food: Food & { aliases: string[] }): string {
    const allergenBoxes = [...NAMED_ALLERGENS, "other" as const]
        .map((code) => {
            const checked = food.allergens.includes(code) ? " checked" : "";
            return `<label><input type="checkbox" name="allergens" value="${escapeHtml(code)}"${checked} /> ${escapeHtml(ALLERGEN_LABELS[code])}</label>`;
        })
        .join("");
    const archived = food.archivedAt ? " checked" : "";
    const id = escapeHtml(food.id);
    const brand = food.brand
        ? ` <span class="muted">${escapeHtml(food.brand)}</span>`
        : "";
    const archivedPill = food.archivedAt
        ? ` <span class="pill pill-dim">Archived</span>`
        : "";
    const kcal =
        food.calories == null
            ? "kcal unknown"
            : `${escapeHtml(String(food.calories))} kcal / 100 g`;
    return `<li class="food-row" data-food-id="${id}">
<div class="row">
<p class="row-title">${escapeHtml(food.name)}${brand}${archivedPill}</p>
<p class="row-meta">${kcal}</p>
</div>
<details class="more">
<summary>Edit</summary>
<form method="post" action="/settings/foods/${id}" class="food-edit">
<input type="hidden" name="food_id" value="${id}" />
<label for="name-${id}">Name</label>
<input id="name-${id}" name="name" value="${escapeHtml(food.name)}" required maxlength="120" />
<label for="brand-${id}">Brand</label>
<input id="brand-${id}" name="brand" value="${escapeHtml(food.brand ?? "")}" maxlength="80" />
<label for="aliases-${id}">Aliases</label>
<input id="aliases-${id}" name="aliases" value="${escapeHtml(food.aliases.join(", "))}" />
<label for="unit-${id}">Default unit</label>
<input id="unit-${id}" name="default_unit" value="${escapeHtml(food.defaultUnit)}" />
<div class="field-grid">
${nutrientInput(`each-${food.id}`, "grams_per_each", "Grams per each", food.gramsPerEach)}
${nutrientInput(`ml-${food.id}`, "grams_per_ml", "Grams per millilitre", food.gramsPerMl)}
${nutrientInput(`cal-${food.id}`, "calories", "Calories / 100 g", food.calories)}
${nutrientInput(`pro-${food.id}`, "protein_g", "Protein g", food.proteinG)}
${nutrientInput(`carb-${food.id}`, "carbs_g", "Carbs g", food.carbsG)}
${nutrientInput(`fat-${food.id}`, "fat_g", "Fat g", food.fatG)}
${nutrientInput(`fib-${food.id}`, "fiber_g", "Fiber g", food.fiberG)}
${nutrientInput(`sug-${food.id}`, "sugar_g", "Sugar g", food.sugarG)}
${nutrientInput(`alc-${food.id}`, "alcohol_g", "Alcohol g", food.alcoholG)}
${nutrientInput(`caf-${food.id}`, "caffeine_mg", "Caffeine mg", food.caffeineMg)}
</div>
<fieldset class="allergens choice-row"><legend>Allergens</legend>${allergenBoxes}</fieldset>
<label><input type="checkbox" name="archived" value="1"${archived} /> Archived</label>
<button type="submit" class="btn-primary">Save food</button>
</form>
</details>
</li>`;
}
```

In `renderFoodsSettingsPage`, replace `const list = view.foods.map(foodCard).join("");` with:

```ts
const list =
    view.foods.length === 0
        ? ""
        : `<section class="panel"><ul class="food-list list">${view.foods.map(foodRow).join("")}</ul></section>`;
```

Replace the `merge` constant with:

```ts
const merge =
    view.foods.length >= 2
        ? `<details class="more">
<summary>Merge foods</summary>
<form method="post" action="/settings/foods/merge" class="food-merge field-grid">
<label>Keep
<select id="keep_id" name="keep_id">${options}</select>
</label>
<label>Drop
<select id="drop_id" name="drop_id">${options}</select>
</label>
<button type="submit" class="btn-danger">Merge</button>
</form>
</details>`
        : "";
```

and replace the `body` template with:

```ts
const body = `
        <h1>Foods</h1>
        ${renderSettingsNav("foods")}
        ${error}
        ${list || `<p class="empty">No foods in the catalog yet.</p>`}
        ${merge}
    `;
```

- [ ] **Step 7: Add the pill list CSS to `public/app/app.css`**

Append:

```css
/* A wrapping row of .pill list items. */
.pills {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.pills:empty,
.store-rule-list:empty,
.person-rule-list:empty {
    display: none;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun test && bun run typecheck`
Expected: PASS. The existing household tests still find "Add household member" (now the summary text), `action="/settings/household"` for owners only, and `href="/settings/foods"`.

- [ ] **Step 9: Look at the result**

Run: `bun run preview:app --shots`
Expected: `settings-light.png`, `household-light.png` and `foods-light.png` each start with the title and the Account / Household / Foods segmented control, with the current page in green. Household shows four cards. Name and location fields have their Save button on the same line, Members lists "Ethan · owner" / "Sam · member" rows above an "Add household member" pill, and the Safeway store sits under a hairline with its "Produce" rename row. Foods shows one card of rows ("Eggs … 143 kcal / 100 g") with Edit pills, and a "Merge foods" pill below.

- [ ] **Step 10: Format and commit**

```bash
bun run format
git add src/web/components/settings-nav.ts src/web/components/settings-nav.test.ts src/web/pages/settings.ts src/app/settings/household.ts src/web/pages/foods.ts public/app/app.css src/domain/settings.test.ts
git commit -m "Settings sub-navigation, household cards, and foods as rows.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Nutrition page log panel

The 12-field log form above the widgets becomes one compact card holding "Log meal", "Log water" and "Log weight" disclosures; an opened one moves to the top of the card. Labels that were not associated with their inputs now wrap them.

**Files:**

- Modify: `src/app/nutrition.ts` (`logForms`)
- Modify: `public/app/app.css` (log panel, meal item)
- Test: `src/web/dashboard.test.ts`

**Interfaces:**

- Consumes: `details.more` (Task 5), `.inline-form`, `.field-grid` (Task 7), `.food-picker-results` (Task 2).
- Keeps every `name=` and every `data-meal-*` hook that `mealItemScript()` and `/log-meal` read: `data-meal-items`, `data-meal-item`, `data-meal-item-name`, `data-meal-item-food-id`, `data-meal-item-results`, `data-add-meal-item`, `item_name`, `item_food_id`, `item_amount`, `item_unit`, `meal_type`, `description`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `amount_ml`, `weight`, `unit`.

- [ ] **Step 1: Write the failing test**

Append to `src/web/dashboard.test.ts`:

```ts
test("self dashboard logs through one compact panel of disclosures", async () => {
    const html = await renderDashboardHtml({
        access: { ok: true, mode: "self", viewer: alice, subject: alice },
        members: [alice],
        summary: { locale: "en" },
        goals: { locale: "en" },
        trends: { locale: "en" },
        weight: { locale: "en" },
        chrome: lightChrome,
    });
    expect(html).toContain(
        '<section class="panel log-panel" aria-label="Log">',
    );
    expect(html).toContain("<summary>Log meal</summary>");
    expect(html).toContain("<summary>Log water</summary>");
    expect(html).toContain("<summary>Log weight</summary>");
    expect(html).toContain(
        '<label class="meal-item-name">Food<input name="item_name" type="text" autocomplete="off" data-meal-item-name /></label>',
    );
    expect(html).not.toContain("fridge-add-supply");
    // The log panel sits above the first widget.
    expect(html.indexOf("log-panel")).toBeLessThan(
        html.indexOf("widget-frame"),
    );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/web/dashboard.test.ts`
Expected: the new test FAILS.

- [ ] **Step 3: Rewrite `logForms` in `src/app/nutrition.ts`**

```ts
function logForms(): string {
    return `<section class="panel log-panel" aria-label="Log">
<details class="more">
<summary>Log meal</summary>
<form class="meal-log" method="post" action="/log-meal">
${mealTypeSelect()}
<div class="meal-items" data-meal-items>
<div class="meal-item" data-meal-item>
<label class="meal-item-name">Food<input name="item_name" type="text" autocomplete="off" data-meal-item-name /></label>
<ul class="food-picker-results meal-item-results" data-meal-item-results></ul>
<input name="item_food_id" type="hidden" data-meal-item-food-id />
<label>Amount<input name="item_amount" type="number" min="0" step="any" inputmode="decimal" /></label>
<label>Unit<select name="item_unit">
<option value="g">g</option>
<option value="each" selected>each</option>
<option value="oz">oz</option>
<option value="ml">ml</option>
<option value="cup">cup</option>
</select></label>
</div>
</div>
<button type="button" class="btn-sm" data-add-meal-item>Add another food</button>
<p class="muted">Or describe it</p>
<label for="log-meal-description">Description</label>
<input id="log-meal-description" name="description" type="text" autocomplete="off" />
<div class="field-grid">
<label>Calories<input id="log-meal-calories" name="calories" type="number" min="0" step="any" inputmode="decimal" /></label>
<label>Protein (g)<input id="log-meal-protein" name="protein_g" type="number" min="0" step="any" inputmode="decimal" /></label>
<label>Carbs (g)<input id="log-meal-carbs" name="carbs_g" type="number" min="0" step="any" inputmode="decimal" /></label>
<label>Fat (g)<input id="log-meal-fat" name="fat_g" type="number" min="0" step="any" inputmode="decimal" /></label>
</div>
<button type="submit" class="btn-primary">Log meal</button>
</form>
</details>
<details class="more">
<summary>Log water</summary>
<form class="log-water inline-form" method="post" action="/log-water">
<label for="log-water-amount">Water (ml)</label>
<input id="log-water-amount" name="amount_ml" type="number" step="any" inputmode="decimal" />
<button type="submit" class="btn-primary">Log water</button>
</form>
</details>
<details class="more">
<summary>Log weight</summary>
<form class="log-weight inline-form" method="post" action="/log-weight">
<label for="log-weight-amount">Weight (kg)</label>
<input id="log-weight-amount" name="weight" type="number" step="any" inputmode="decimal" />
<input type="hidden" name="unit" value="kg" />
<button type="submit" class="btn-primary">Log weight</button>
</form>
</details>
</section>
${mealItemScript()}`;
}
```

- [ ] **Step 4: Add the log panel CSS to `public/app/app.css`**

Append:

```css
/* ---- nutrition log ---- */

/* Three disclosure pills in a row; the opened one moves to the top of the
   card and takes its full width. */
.log-panel {
    flex-direction: row;
    flex-wrap: wrap;
}
.log-panel > details[open] {
    flex-basis: 100%;
    order: -1;
}
.meal-items {
    display: grid;
    gap: 12px;
}
.meal-item {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
}
.meal-item > label {
    display: grid;
    gap: 4px;
}
.meal-item-name,
.meal-item-results {
    grid-column: 1 / -1;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test`
Expected: PASS, including `src/app/nutrition-log.test.ts` (the form handlers are unchanged) and the `/log-meal` route tests in `src/mcp.test.ts`.

- [ ] **Step 6: Check the meal-item script by hand**

Run: `bun run preview:app`, then open `http://localhost:4787/nutrition-light.html` in a browser. Open "Log meal" and click "Add another food".
Expected: a second Food / Amount / Unit block appears with empty fields, and the "Log meal" card sits above the widget cards. Stop the server with Ctrl-C.

- [ ] **Step 7: Look at the result**

Run: `bun run preview:app --shots`
Expected in `nutrition-light.png`: the title, the member switch, then one card holding three pills in a row ("Log meal", "Log water", "Log weight"), then the widget cards.

- [ ] **Step 8: Format and commit**

```bash
bun run format
git add src/app/nutrition.ts public/app/app.css src/web/dashboard.test.ts
git commit -m "Compact nutrition log panel above the widgets.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## PR 4 — Login and leftovers

### Task 10: Login on the shared stylesheet; delete the marketing CSS, site script and fonts

Login is regenerated as a plain card on `/app.css`, following the OS theme. `public/styles.css` (3,633 lines, mostly marketing), `public/site.js`, `public/fonts/`, `src/copy/chrome.ts` and their routes are deleted.

**Files:**

- Modify: `src/copy/login.ts` (add `footerNote`)
- Rewrite: `scripts/site-partials.ts`
- Modify: `scripts/gen-login.ts` (imports, delete `LOGIN_STYLE`, new `renderDoc`)
- Modify: `public/app/app.css` (login layout)
- Modify: `src/index.ts` (delete three routes)
- Delete: `public/styles.css`, `public/site.js`, `public/fonts/`, `src/copy/chrome.ts`
- Modify: `CLAUDE.md`
- Test: `src/oauth.test.ts`, `src/public-site.test.ts`

**Interfaces:**

- `LoginDoc` gains `footerNote: string`.
- `scripts/site-partials.ts` exports only `esc(s: string): string` and `generatedBanner(script: string): string`.
- `renderLoginPage` (`src/oauth.ts`) is unchanged: it still fills `{{SESSION_ID}}` and `{{ERROR}}` (with `<div class="error-banner">…</div>`, styled by `app.css`).

- [ ] **Step 1: Write the failing tests**

In `src/oauth.test.ts`, replace the test `generated login uses sky accent tokens, not FDA green` with:

```ts
test("generated login uses the shared app stylesheet and no web fonts", async () => {
    const html = await renderLoginPage("s1", fakeSession());
    expect(html).toContain('<link rel="stylesheet" href="/app.css" />');
    expect(html).toContain('class="auth-stage native"');
    expect(html).toContain('class="btn-primary"');
    expect(html).not.toContain("/styles.css");
    expect(html).not.toContain("/site.js");
    expect(html).not.toContain("/fonts/");
    expect(html).not.toContain("#2f8fd4");
    expect(html).not.toContain("auth-btn");
});
```

In `src/public-site.test.ts`:

1. In `GET / without a session is login HTML…`, replace

```ts
expect(body).toContain("--accent: #2f8fd4");
expect(body).not.toContain("#3b7a4f");
```

with

```ts
expect(body).toContain('<link rel="stylesheet" href="/app.css" />');
```

2. Replace the test `login assets still answer and site.js does not poll /api/stats` with:

```ts
test("the marketing stylesheet, site script and web fonts are gone", async () => {
    for (const path of [
        "/styles.css",
        "/site.js",
        "/fonts/bricolage-grotesque-latin.woff2",
    ]) {
        const r = await app.request(`http://x${path}`);
        expect(r.status, path).toBe(404);
    }
    for (const file of [
        "public/styles.css",
        "public/site.js",
        "public/fonts/bricolage-grotesque-latin.woff2",
        "src/copy/chrome.ts",
    ]) {
        expect(await Bun.file(file).exists(), file).toBe(false);
    }
});
```

3. In `GET /authorize with a valid OAuth query returns login HTML`, replace

```ts
expect(html).toContain("--accent: #2f8fd4");
expect(html).not.toContain("#3b7a4f");
```

with

```ts
expect(html).toContain('<link rel="stylesheet" href="/app.css" />');
```

and replace `expect(html).toContain("/fonts/bricolage-grotesque-latin.woff2");` with `expect(html).not.toContain("/fonts/");`.

4. Rename `self-hosted login fonts are served and CSP has no third-party font hosts` to `CSP has no third-party hosts`, and delete its first five lines (the `font` request and its two `expect`s), keeping the `/health` request and every CSP assertion.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/oauth.test.ts src/public-site.test.ts`
Expected: FAIL. The login still links `/styles.css`, and `/styles.css` still answers 200.

- [ ] **Step 3: Add the footer copy to `src/copy/login.ts`**

In `LoginDoc`, add after `afterConnectNote: string;`:

```ts
/** One line under the card. */
footerNote: string;
```

In `LOGIN`, add after `afterConnectNote: …,`:

```ts
    footerNote:
        "Free and open source. Nutrition figures are estimates, not medical advice.",
```

- [ ] **Step 4: Rewrite `scripts/site-partials.ts`**

```ts
// Shared HTML fragments for the OAuth login template (scripts/gen-login.ts).
// Login is the only generated public HTML and is styled by /app.css, the same
// stylesheet as the household app. Nothing here is escaped against untrusted
// input — callers pass developer-authored constants.

/** Minimal HTML-entity escaping for text interpolated into element bodies. */
export function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generatedBanner(script: string): string {
    return `        <!-- Generated by ${script} — edit the data there, not this file. -->`;
}
```

- [ ] **Step 5: New `renderDoc` in `scripts/gen-login.ts`**

Replace the import from `./site-partials.js` with:

```ts
import { esc, generatedBanner } from "./site-partials.js";
```

Delete the whole `LOGIN_STYLE` constant and its comment. Replace `renderDoc` with:

```ts
function renderDoc(doc: LoginDoc): string {
    const title = `${esc(doc.title)} — ${esc(doc.subtitle)}`;

    // Legal HTML is gone. Keep the consent sentence, but the {terms}/
    // {privacy} tokens are the localized names as text, not anchors.
    const consent = esc(doc.consentNote)
        .replace("{terms}", esc(doc.termsLinkText))
        .replace("{privacy}", esc(doc.privacyLinkText));

    // Styled by /app.css, the household app's stylesheet. No data-theme on
    // <html>: login always follows the OS theme.
    return `<!doctype html>
<html lang="${HTML_LANG.en}">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <!-- No canonical/hreflang: this page has no fixed URL (rendered
             per in-flight OAuth session via GET /authorize, not routed by
             path — see src/copy/login.ts). noindex is a defensive
             belt-and-suspenders in case a stray link to /authorize is ever
             crawled. -->
        <meta name="robots" content="noindex, nofollow" />
        <link rel="stylesheet" href="/app.css" />
    </head>
    <body class="auth">
${generatedBanner("scripts/gen-login.ts")}
        <main id="main" class="auth-stage native">
            <div class="auth-card panel">
                <div class="auth-head">
                    <span class="auth-mark" aria-hidden="true">🍏</span>
                    <h1 class="auth-title">${esc(doc.title)}</h1>
                    <p class="auth-sub">${esc(doc.subtitle)}</p>
                </div>

                {{ERROR}}

                <form method="POST" action="/approve" class="auth-form">
                    <input type="hidden" name="session_id" value="{{SESSION_ID}}" />
                    <label for="email">${esc(doc.emailLabel)}</label>
                    <input type="email" id="email" name="email" required autocomplete="email" />
                    <label for="password">${esc(doc.passwordLabel)}</label>
                    <input type="password" id="password" name="password" required minlength="6" autocomplete="current-password" />
                    <button type="submit" name="action" value="login" class="btn-primary">${esc(doc.continueButton)}</button>
                    <p class="auth-note">${consent}</p>
                    <p class="auth-note">${esc(doc.newHereNote)}</p>
                    <p class="auth-note">${esc(doc.afterConnectNote)}</p>
                </form>
            </div>
            <p class="auth-foot">${esc(doc.footerNote)}</p>
        </main>
    </body>
</html>
`;
}
```

- [ ] **Step 6: Add the login layout to `public/app/app.css`**

Append:

```css
/* ---- login (/authorize, scripts/gen-login.ts) ---- */

.auth-stage {
    flex: 1;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 16px;
    padding: clamp(24px, 8vw, 64px) 16px;
}
.auth-card {
    width: 100%;
    max-width: 400px;
    padding: 24px 22px;
    gap: 14px;
}
.auth-head {
    display: grid;
    justify-items: center;
    gap: 6px;
    text-align: center;
}
.auth-mark {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
    font-size: 28px;
}
.auth-title {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
}
.auth-sub {
    margin: 0;
    color: var(--text-dim);
    font-size: 14px;
}
.auth-form .btn-primary {
    margin-top: 6px;
}
.auth-note,
.auth-foot {
    margin: 0;
    color: var(--text-dim);
    font-size: 12.5px;
    line-height: 1.5;
    text-align: center;
}
.auth-foot {
    max-width: 400px;
    font-size: 12px;
}
```

- [ ] **Step 7: Delete the leftovers and their routes**

```bash
git rm public/styles.css public/site.js src/copy/chrome.ts
git rm -r public/fonts
```

In `src/index.ts`, delete the `app.get("/styles.css", …)`, `app.get("/site.js", …)` and `app.get("/fonts/:file", …)` handlers. Replace the comment above the remaining static routes (`// Login assets. Marketing HTML, …`) with:

```ts
// Static assets. Login and the household app share /app.css (assembled from
// the widget partials, src/widgets.ts). Marketing HTML, its stylesheet, site.js
// and the web fonts are gone; leftover files on disk must not become routes (a
// registered path that reads a missing file 500s).
```

- [ ] **Step 8: Update `CLAUDE.md`**

In "Architecture rules", replace the sentence

```
Do not add a Foodable logo until one exists; keep the current favicon and the sky login accent.
```

with

```
Do not add a Foodable logo until one exists; keep the current favicon. There is one accent, the widget green in `public/widgets/src/shared/tokens.css`, on the app, the login page and the widgets alike.
```

Replace the whole "### Chrome and assets" subsection (its heading and both paragraphs) with:

```markdown
### Chrome and assets

Login is a single card styled by `/app.css`, the household app's stylesheet. It follows the OS theme and has no header, theme toggle or web fonts. Consent `{terms}` / `{privacy}` render as plain text, not anchors.

Static assets served: `/app.css` (assembled, see "Household app styling"), `/favicon.ico`, `/robots.txt`. `public/styles.css`, `public/site.js` and `public/fonts/` were marketing leftovers and are deleted; `src/public-site.test.ts` fails if they come back.
```

In "## Login HTML and the household app", replace `Re-run \`bun run gen:all\` after editing login copy or \`site-partials.ts\`.`with`Re-run \`bun run gen:all\` after editing login copy, \`site-partials.ts\` or \`gen-login.ts\`.`

- [ ] **Step 9: Run the tests to verify they pass**

Run: `bun run gen:all && bun test && bun run typecheck`
Expected: PASS. A failure mentioning `chromeFor` or `LOGIN_SKY_TOKENS` means an import was missed; `grep -rn "chromeFor\|LOGIN_SKY_TOKENS\|THEME_PREPAINT\|HEAD_ASSETS\|SITE_SCRIPT" src scripts` must print nothing.

- [ ] **Step 10: Look at the result**

```bash
bun run gen:all
cp public/login.html tmp/app-preview/login.html
bun run preview:app &
sleep 2
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=430,900 --screenshot=tmp/app-preview/login.png http://localhost:4787/login.html
chromium --headless=new --disable-gpu --hide-scrollbars --force-dark-mode --window-size=430,900 --screenshot=tmp/app-preview/login-dark.png http://localhost:4787/login.html
kill %1
```

Expected: `login.png` shows a centred white card with the 🍏 mark on a pale green tile, "Foodable", grey "Sign in to connect", the literal `{{ERROR}}` (the preview serves the raw template), Email and Password fields, a green "Continue" button, three grey notes and the footer line under the card. `login-dark.png` is the same on near-black with a `#1c1c1e` card and a lighter green button. Neither uses Bricolage or any other web font.

- [ ] **Step 11: Format and commit**

```bash
bun run format
git add -A src scripts public CLAUDE.md
git commit -m "Move login onto /app.css and delete the marketing CSS, site.js and fonts.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Bare pages on `/app.css`, the CLAUDE.md styling section, and a final check

The create-household and forbidden pages still link the deleted `/styles.css` through `renderBare` in `src/web/dashboard.ts`. They move onto the app head. `CLAUDE.md` gets a "Household app styling" section, so the rules survive.

**Files:**

- Modify: `src/web/dashboard.ts` (`renderBare`, `createHouseholdFormHtml`, shell import)
- Modify: `CLAUDE.md`
- Test: `src/web/dashboard.test.ts`

**Interfaces:**

- Consumes: `htmlOpen(theme: ThemePref)` and `appHead(title: string, theme: ThemePref)` from Task 3.

- [ ] **Step 1: Write the failing test**

Append to `src/web/dashboard.test.ts`:

```ts
test("bare pages use the app stylesheet, not the deleted marketing one", () => {
    const html = createHouseholdFormHtml("Enter a household name.");
    expect(html).toContain('<link rel="stylesheet" href="/app.css" />');
    expect(html).not.toContain("/styles.css");
    expect(html).not.toContain("<style>");
    expect(html).toContain('<main class="app-main native">');
    expect(html).toContain(
        '<form method="POST" action="/create-household" class="create-household panel">',
    );
    expect(html).toContain(
        '<button type="submit" class="btn-primary">Create household</button>',
    );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/web/dashboard.test.ts`
Expected: the new test FAILS on `/app.css`.

- [ ] **Step 3: Move `renderBare` onto the app head**

In `src/web/dashboard.ts`, change `import { escapeHtml } from "../app/shell.js";` to:

```ts
import { appHead, escapeHtml, htmlOpen } from "../app/shell.js";
```

Replace `renderBare` with:

```ts
// Pages shown before the viewer has a household (create, forbidden). Same
// stylesheet as the app, no bottom nav, and no saved theme to read yet, so
// they follow the OS.
function renderBare(title: string, body: string): string {
    return `<!doctype html>
${htmlOpen("system")}
<head>
${appHead(title, "system")}
</head>
<body>
<main class="app-main native">
${body}
</main>
</body>
</html>`;
}
```

Replace the body string passed by `createHouseholdFormHtml` with:

```ts
        `<header class="dash-head">
            <h1>Create household</h1>
            <p class="muted">Name the household. Everyone else is added from Settings.</p>
        </header>
        <form method="POST" action="/create-household" class="create-household panel">
            ${formErrorHtml(error)}
            <label for="household_name">Household name</label>
            <input id="household_name" name="household_name" required maxlength="80" />
            <label for="display_name">Your name</label>
            <input id="display_name" name="display_name" required maxlength="80" />
            <button type="submit" class="btn-primary">Create household</button>
        </form>
        <p class="logout"><a href="/logout">Log out</a></p>`,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/web/dashboard.test.ts src/mcp.test.ts`
Expected: PASS. The existing `create-household form posts name fields and has no widgets` test still finds `<h1>Create household</h1>` and `href="/logout"`.

- [ ] **Step 5: Add the styling section to `CLAUDE.md`**

Insert after the "## Login HTML and the household app" section (before the "# Claude Code Operating Instructions" heading):

```markdown
## Household app styling

One design system. The widget partials in `public/widgets/src/shared/` (`tokens.css`, `base.css`, `form.css`, `table.css`, `seg.css`) are the source of truth for the in-chat widgets, the household app and the login page. `public/app/app.css` `@include`s them and adds only app layout. `getAppCss()` in `src/widgets.ts` assembles it with the widget resolver, caches it, warms it at boot and serves it at `/app.css`. Editing a partial changes the widgets and the app together; check both (`bun run harness`, `bun run preview:app --shots`).

- **Plain markup inside `.native`.** App pages render inside `<main class="app-main native">`. `form.css` styles native `input` / `select` / `textarea` / `button` there through `:where(.native …)`, which has zero specificity, so a component class on the same element always wins. Never add a bare `.native button` rule: it outranks `.btn-primary`. App-layer rules in `app.css` follow the same convention.
- **The vocabulary.** Sections are `.panel` (sub-blocks `.psec`). Lists are `ul.list` of rows: `.row` holding `.row-title` and a right-aligned `.row-meta`, then `.row-actions` (each action is its own POST form, `display: contents`). Secondary forms (edit, add, filter) go behind `<details class="more"><summary>…</summary>`. Buttons: plain = neutral, `.btn-primary` = the one main action, `.btn-danger` = destructive, `.btn-sm` = in-row. Two-column fields: `.field-grid` with `<label>Text<input></label>`. Label + control + button on one line: `.inline-form`. Picker tabs are `.seg` / `.seg-btn` with `aria-selected`.
- **One accent, three themes.** The accent is `--accent` from `tokens.css` and nothing overrides it: no swatch picker and no inline accent. `profiles.theme` is `light`, `dark` or null (System). Explicit themes stamp `data-theme` on `<html>` (`htmlOpen` in `src/app/shell.ts`); System leaves it off so the media query decides. Embedded widgets get the same treatment (`withWidgetData`). `profiles.accent_swatch` is unused, pending a contract migration.
- **`[hidden]` is `display: none !important`** in `app.css`. Component `display` rules used to override the attribute.
- **Embedded widgets.** `.widget-frame` is pulled out by the widget's own 12–14px gutter so cards line up with page panels, and `bridge.js` skips its chat-only footer when `window.__WIDGET_DATA__` seeded the paint.
- **Test-pinned class names.** Some classes are asserted exactly by tests (see `src/web/components/shared-import.test.ts`, `src/domain/*.test.ts`). Style those by name in `app.css` rather than appending classes in markup.
```

- [ ] **Step 6: Final verification**

Run each and check the expected result:

```bash
bun run gen:all            # wrote ./public/login.html
bun run format:check       # All matched files use Prettier code style!
bun run typecheck          # no errors
bun test                   # 0 fail
grep -rn "styles.css\|site.js\|/fonts/\|ACCENT_SWATCHES\|accent_swatch\|#2f8fd4" src scripts public --include=*.ts --include=*.css --include=*.js --include=*.html
```

The `grep` must print only:

- `src/db/profiles.ts`: the `accent_swatch` field on `Profile` and in `upsertProfile`.
- Profile fixtures that set `accent_swatch: null` (`src/mcp.test.ts`, `src/supabase.test.ts`, `src/domain/export.test.ts`).
- Negative assertions: the 404 test in `src/public-site.test.ts`, the `not.toContain` lines in `src/oauth.test.ts`, and `not.toContain("#2f8fd4")` in `src/app-css.test.ts`.

Anything else is a leftover.

Then run `bun run preview:app --shots` and look at all 18 PNGs. Every page should use the same card, field, button and segmented-control styling as the widget cards on `nutrition-*.png`, and in light and dark nothing should be sky blue.

- [ ] **Step 7: Format and commit**

```bash
bun run format
git add src/web/dashboard.ts src/web/dashboard.test.ts CLAUDE.md
git commit -m "Move the bare household pages onto /app.css and document the styling rules.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- **Coverage of the agreed direction.** Make everything match the widgets: Tasks 1–2 (one source, shared partials). Green default and no clashing swatches: Task 3 (swatch picker removed outright). System fonts on login: Task 10. Unified theme handling: Task 3 (app), Task 10 (login follows the OS), Task 3 `withWidgetData` (embedded widgets). Delete the dead marketing CSS: Task 10. Fix the layout problems CSS alone cannot: Tasks 5–9. Chat-only widget footer: Task 4. Two extra bugs found while planning: the `hidden` attribute overridden by `.food-picker-panel` (Task 2) and the CSP blocking the `data:` select chevron (Task 2).
- **Out of scope, on purpose.** Dropping `profiles.accent_swatch` (a later contract migration). Removing the unused `comingSoonPage` (unrelated dead code; its tests still exercise the shell).
- **Names used across tasks:** `getAppCss`, `APP_CSS_SOURCE` (Task 1); `ThemePref`, `ViewerChrome`, `htmlOpen`, `appHead`, `resolveTheme`, `parseAppearanceInput` (Task 3, used in Task 11); `WidgetViewerChrome` (Task 3); `renderSettingsNav`, `SettingsSection` (Task 8); CSS `.native`, `.list`, `.row`, `.row-title`, `.row-meta`, `.row-actions`, `details.more`, `.inline-form`, `.field-grid`, `.choice-row`, `.pills`, `.check-btn`, `.log-panel`, `.meal-item`, `.subnav`, `.muted` — each defined once in the task listed in its Interfaces block.

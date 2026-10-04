# Foodable architecture plan

Status: draft, not started. Written 2026-10-04 from a full walkthrough of the codebase at `47da66f`.

Foodable is a self-hosted MCP platform for one household. People use it through their AI agents and a small web app. It has five pillars: Fridge, Groceries, Nutrition, Recipes, and Settings. It is a fork of `akutishevsky/nutrition-mcp`. The fork is personal and open source. It is not a public hosted service. The deploy target and the domain are not decided yet.

The goal is one cohesive system. Every pillar refers to the same foods. Buying, storing, cooking, and eating are steps of one loop, not four separate trackers.

## Where we are

The baseline is healthy. After `bun install && bun run gen:all`, 1028 tests pass and `bun run typecheck` is clean. The domain modules (`fridge.ts`, `grocery.ts`, `recipes.ts`, `settings.ts`, `rules.ts`, `linking.ts`, `quantity.ts`) follow one sound pattern. Each has a store interface, an in-memory store, row mappers, and pure functions. Keep that pattern for everything new.

These gaps drive this plan.

1. **No food entity.** Fridge items, grocery lines, and recipe ingredients each carry their own `display_name` plus `identity` JSON. Meals carry nothing but free text and numbers.
2. **Manual identities never match.** Every manual add mints `householdManualId: crypto.randomUUID()`. Manual "eggs" in a recipe never matches manual "eggs" in the fridge. Already-have and the recipe-to-grocery remainder therefore only work for barcodes.
3. **Food is grams only.** `quantity-field.ts` `FOOD_UNITS = ["g"]`, and every add path hard-codes `unit: "g"`. That rules out "3 eggs" and "1 can".
4. **No loop closes.** A checked grocery line does not stock the fridge. Cooking does not deduct stock. Eating a recipe does not log a meal.
5. **The web picker search is a mock.** It filters `PICKER_DEMO_FOODS`, and `demoFridgeFood()` in `index.ts` returns fixed macros.
6. **Fridge locations are stored twice.** They live in `households.fridge_locations` (`update_fridge_locations`) and in the `fridge_locations` table (`add_fridge_location`).
7. **Allergen checks are weak.** They match substrings of display names. The grocery page always shows "unknown allergen data" when any member has an allergen.
8. **Oversized files.** `mcp.ts` is 7k lines, `supabase.ts` is 2.6k, and `index.ts` is 1.3k, with three copy-pasted actor helpers. There are 70 tools. `SERVER_INSTRUCTIONS` still describe a nutrition-only server.
9. **Upstream leftovers.** Patreon, landing stats and the world map, Google Analytics, registry publishing, `nutrition-mcp.com` copy, protocol-era analytics, and nine-locale i18n.

## Principles

- **Subtract before you add.** Phase 0 removes code before any feature work starts.
- **Moves before changes.** Phase 1 is pure file moves with zero behavior change. Feature diffs after it stay small and reviewable.
- **Expand, backfill, switch, contract.** Every schema change ships as additive columns or tables, then a backfill, then code reads the new shape, then a later migration drops the old shape. No migration is destructive and backfilling in the same step.
- **Keep the mature nutrition stack untouched.** Meals keep their denormalized totals (`calories`, `protein_g`, and the rest). Insights, widgets, goals, import, and export keep reading those columns. Food-backed meals compute the totals on write.
- **Pure functions plus thin adapters.** New logic (put-away, cook, eat, unit resolution) lives in pure modules with memory-store tests. `mcp.ts` and the routes only adapt.
- **One household per deploy stays.** New tables still carry `household_id` and the same RLS shape, for consistency and for a future multi-household option.

## Phase overview

| Phase | Theme                              | Ships                                                         | Depends on    |
| ----- | ---------------------------------- | ------------------------------------------------------------- | ------------- |
| 0     | Rename to Foodable, strip upstream | Smaller tree, new brand, host-agnostic config                 | none          |
| 1     | Structural split                   | Domain folders for tools, routes, and db. No behavior change  | 0             |
| 2     | Household food catalog             | `foods` and friends, `food_id` everywhere, real picker search | 1             |
| 3     | Units that fit food                | each, volume, and density per food                            | 2             |
| 4     | Food-backed meals                  | `meal_items`, log from food, recipe, or fridge                | 2, 3          |
| 5     | Close the loops                    | Stock ledger, put-away, cook, eat, discard                    | 2, 3, 4       |
| 6     | Recipes, fuller                    | Steps, edit and remove ingredients, tags, source URL          | 2, 3          |
| 7     | Agent surface                      | Instructions rewrite, tool consolidation, household widgets   | 4, 5, 6       |
| 8     | Contract                           | Drop `identity` and `nutrition` JSON and other dead columns   | 2 to 7 stable |

Phases 3 and 6 can run in parallel after 2. Each phase is one or more PRs. Each PR runs `bun run typecheck`, `bun test`, and `bun run format:check`.

---

## Phase 0. Rename to Foodable and strip upstream

### Rename

- [ ] Set `package.json` `name: "foodable"`, `description`, `author`, `homepage`, and `repository` to the new GitHub repo. Remove `keywords` that name the old product.
- [ ] Set the `McpServer` constructor name and title in `src/mcp.ts` to Foodable.
- [ ] Reset the version. Recommendation: `0.1.0`. The version then lives in two places, `package.json` and `src/mcp.ts`, because `server.json` goes away below.
- [ ] Rewrite `SERVER_INSTRUCTIONS` headline to Foodable. The full rewrite is Phase 7.
- [ ] Replace the product name in `src/copy/login*.ts` and `chrome*.ts`, `scripts/site-partials.ts`, `public/site.js` header, `public/styles.css` comments, and `src/export.ts` README text. Also replace it in `src/foods.ts`, where the default OFF User-Agent must name Foodable and keep the operator contact from `OFF_USER_AGENT`.
- [ ] Update `LICENSE` to add your copyright line. **Keep the original `akutishevsky` copyright notice.** MIT requires it to stay.
- [ ] Rewrite `README.md` for Foodable. Cover what it is, the five pillars, self-hosting, connecting an agent, and a "Forked from nutrition-mcp" credit.
- [ ] Rename the GitHub repo. Old URLs redirect, but update the remote anyway.

### Brand assets

The logos exist but are not in the repo yet. Drop them in `public/brand/`. Needed:

- [ ] `logo.svg` (mark), and `wordmark.svg` if one exists. Used in the login chrome and the app bar.
- [ ] `favicon.ico` containing 16, 32, and 48 px. This is also the MCP server icon (`/favicon.ico` is advertised as the icon URL).
- [ ] `apple-touch-icon.png` at 180 px.
- [ ] `icon-192.png` and `icon-512.png`, if the web app should become installable later (manifest is out of scope here).
- [ ] A brand accent hex. Decide whether it replaces `sky` as the default swatch in `ACCENT_SWATCHES` (`src/app/shell.ts`) and the widget tokens (`public/widgets/src/shared/tokens.css`).
- [ ] Delete `public/og.png`. There are no public pages to share.

### Remove upstream leftovers

- [ ] Remove Patreon: `src/patreon.ts`, `src/patreon.test.ts`, `getPatreonTokenStore` and `seedPatreonTokensFromEnv` in `src/supabase.ts`, the related wiring in `src/index.ts`, and `.github/FUNDING.yml`. Add a migration that drops the `patreon_tokens` table.
- [ ] Remove landing stats and the world map: `getLandingStats`, `timezoneLevels`, `TZ_LEVEL_THRESHOLDS`, `LEGACY_TZ_LEVEL`, `scripts/gen-map-data.ts`, `public/map-data.json`, and the `/api/stats` remnants in `ttl-cache.ts` comments. Add a migration that drops the landing-stats functions and views from `20260624090000`, `20260808120000`, and `20260815071050`.
- [ ] Remove Google Analytics and Glama: the gtag block in `scripts/site-partials.ts`, the GA and googletagmanager hosts in the CSP at `src/index.ts:160`, and the `/.well-known/glama.json` route.
- [ ] Remove `scripts/depersonalize.ts` and its `package.json` script. There is nothing left to depersonalize.
- [ ] Remove `src/alt-pages.test.ts` if it only pins removed marketing behavior.
- [ ] Trim `src/public-site.test.ts` to what still matters: the login template and `/` returning the app or login.
- [ ] Remove registry publishing: `server.json` and `.github/workflows/publish-mcp.yml`. Keep `ci.yml`.
- [ ] Decide on Google Fonts. Recommendation: self-host the three families under `public/fonts/` or switch to a system stack. Either way the CSP loses its third-party font and style hosts.
- [ ] Decide on protocol-era analytics. Recommendation: drop `protocol_era` and `client_name` from `tool_analytics`, and keep the plain per-tool duration and outcome rows. They are cheap and useful for a personal deploy. Keep the dual-era `/mcp` endpoint itself. It is the SDK default and costs nothing.
- [ ] Decide on i18n. **Recommendation: English only.** That deletes `src/copy/*.{de,es,fr,it,ja,nl,pl,uk}.ts`, `public/{locale}/`, `LOCALES` and the locale switcher, `set_language`, and `profiles.locale` reads. The widget `@i18n` marker would inline the English dictionary only. The new app pages are English-only already. If someone in the household needs another language, keep the machinery and keep just that one locale.
- [ ] Keep the CSV meal importer (`import.ts`, `csv.ts`, `import-meals` widget). It is how history comes in from MyFitnessPal, Cronometer, and similar apps.

### Host-agnostic config

- [ ] Add optional `PUBLIC_ORIGIN` to `.env.example`. When set, `getBaseUrl` in `src/url.ts` returns it and ignores `X-Forwarded-*`. Today `X-Forwarded-Host` is trusted unconditionally. Without a proxy that strips it, a client can steer the OAuth metadata URLs. When unset, keep current behavior for local dev.
- [ ] Strip the DigitalOcean, 512 MB, and auto-deploy commentary from `Dockerfile`. Keep `--smol`.
- [ ] Add a `docs/self-hosting.md` covering Supabase cloud vs self-hosted Supabase, migrations (`supabase db push`), the env vars, a reverse proxy example, and the first-user flow from `closed-household-plan.md`.
- [ ] Rewrite `CLAUDE.md`. Delete "Deploying" (DigitalOcean), "Publishing to the registry", the i18n sections that no longer apply, and the `tool_analytics` legacy-retirement paragraph. Add a section on the architecture rules in this plan.

### Verify

- [ ] `bun test`, `bun run typecheck`, `bun run format:check` are green.
- [ ] `grep -ri "nutrition-mcp\|akutishevsky\|patreon\|gtag"` over the tree hits only `LICENSE`, the README credit, and old migration files.
- [ ] Login renders with the Foodable logo. `/mcp` `initialize` returns server name Foodable. The icon URL resolves.

---

## Phase 1. Structural split, no behavior change

Each PR is a pure move. Test files move with their code. The diff should be renames plus import paths.

Target layout:

```
src/
  server/            index.ts (bootstrap only), middleware, url, rate-limit, analytics
  auth/              oauth, discovery, site-session, household-token, auth-context
  db/                client.ts (getSupabase), one file per domain:
                     nutrition.ts, profiles.ts, household.ts, fridge.ts,
                     grocery.ts, recipes.ts, settings.ts, rules.ts, foods.ts, tokens.ts
  domain/            pure logic: fridge, grocery, recipes, settings, rules, linking,
                     quantity, food-identity, insights, import, csv, export, tz, units …
  mcp/
    server.ts        factory, SERVER_INSTRUCTIONS, createMcpHandler wiring
    shared.ts        withAnalytics, actor resolution, uiMeta, common schemas
    tools/           nutrition.ts, water.ts, weight.ts, goals.ts, profile.ts,
                     fridge.ts, grocery.ts, recipes.ts, rules.ts, household.ts, food.ts
  web/
    routes/          one Hono sub-app per tab: nutrition, fridge, grocery, recipes, settings
    middleware.ts    requireSiteUser / requireMember / requireOwner (replaces the
                     copy-pasted nutritionActor / fridgeActor / groceryActor)
    pages/           today's src/app/*/page.ts
    components/      today's src/app/components/*
    dashboard.ts     the page loaders (today's src/dashboard.ts)
```

- [ ] **1a.** Split `supabase.ts` into `db/*`. Keep a temporary `supabase.ts` barrel that re-exports everything, so `mock.module("./supabase.js")` in tests keeps working. Respect the CLAUDE.md rule: one mock window, restore from a snapshot taken before `mock.module`. Retire the barrel in 1d.
- [ ] **1b.** Split `mcp.ts` into `mcp/tools/*`. Each file exports `registerXTools(server, ctx)`. `ctx` carries `auth`, `analytics`, actor helpers, and `uiMeta`. The tool list and order must be identical. `mcp.test.ts` asserts `TOOLS` against `tools/list`, which is the guard.
- [ ] **1c.** Split `index.ts` routes into `web/routes/*`, plus `web/middleware.ts` setting `c.var.member`. Add `formText` and `formAmount` to a `web/form.ts`.
- [ ] **1d.** Move pure modules into `domain/`, delete the barrel, and update `scripts/typecheck.ts` if paths matter.
- [ ] **1e.** Split `mcp.test.ts` (6.6k lines) by domain only if the single-mock-window rule allows it. Otherwise leave it and note why. The Linux CI mock leak is documented in CLAUDE.md.

### Verify

- [ ] Test count is unchanged (1028 or whatever Phase 0 leaves), all green.
- [ ] `tools/list` output is byte-identical before and after (snapshot it in 1b).
- [ ] No source file is over about 1,200 lines.

---

## Phase 2. Household food catalog

This is the core migration. Every pillar starts pointing at one `foods` row.

### Schema (migration `…_food_catalog.sql`, expand only)

```sql
create table public.foods (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    kind text not null check (kind in ('food', 'supply')),
    name text not null,
    normalized_name text not null,          -- lower, trimmed, collapsed spaces
    brand text,
    default_unit text not null default 'g', -- Phase 3 widens what is allowed
    grams_per_each numeric check (grams_per_each > 0),  -- Phase 3
    grams_per_ml numeric check (grams_per_ml > 0),      -- Phase 3 (density)
    -- nutrition per 100 g, null = unknown (never 0 for unknown)
    calories numeric check (calories >= 0),
    protein_g numeric check (protein_g >= 0),
    carbs_g numeric check (carbs_g >= 0),
    fat_g numeric check (fat_g >= 0),
    fiber_g numeric check (fiber_g >= 0),
    sugar_g numeric check (sugar_g >= 0),
    alcohol_g numeric check (alcohol_g >= 0),
    caffeine_mg numeric check (caffeine_mg >= 0),
    nutrition_source text check (nutrition_source in
        ('openfoodfacts', 'manual', 'estimate', 'recipe')),
    allergens text[] not null default '{}', -- codes from rules.ts NAMED_ALLERGENS
    off_source_id text,                     -- OFF product code when from OFF
    created_by uuid references auth.users (id) on delete set null,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index foods_household_name_uniq
    on public.foods (household_id, kind, normalized_name, coalesce(brand, ''))
    where archived_at is null;

create table public.food_barcodes (
    household_id uuid not null references public.households (id) on delete cascade,
    barcode text not null,
    food_id uuid not null references public.foods (id) on delete cascade,
    primary key (household_id, barcode)
);

create table public.food_aliases (
    household_id uuid not null references public.households (id) on delete cascade,
    alias text not null,                    -- normalized
    food_id uuid not null references public.foods (id) on delete cascade,
    primary key (household_id, alias)
);

alter table public.fridge_items       add column food_id uuid references public.foods (id);
alter table public.grocery_lines      add column food_id uuid references public.foods (id);
alter table public.recipe_ingredients add column food_id uuid references public.foods (id);
alter table public.member_dislikes    add column food_id uuid references public.foods (id);
-- RLS + grants: same member_all policy shape as fridge_items; service_role all.
```

Notes:

- **Why per household, not global.** `food_cache` stays the global OFF cache. `foods` is what this household calls things, including manual foods, chosen units, and corrections to bad OFF data. A barcode hit copies OFF values into a `foods` row once, and edits stay local.
- **Supplies are foods with `kind = 'supply'`.** One catalog, one picker, one identity path. Nutrition columns stay null.
- **Allergens become data.** OFF `allergens_tags` (`en:milk`, `en:peanuts`, …) map to `NAMED_ALLERGENS` when a barcode food is created. Manual foods get a multi-select. `groceryAllergenWarning` matches on `foods.allergens` first and falls back to the name match only when a food has no allergen data. That fallback is the only honest case for "unknown allergen data". It fixes gap 7, including the always-on banner bug in `renderGroceryListPage`.

### Backfill (migration `…_food_catalog_backfill.sql`, idempotent)

Run as SQL in one transaction. Re-running must be a no-op.

1. **Barcode identities.** For each distinct `(household_id, identity->>'barcode')` across `fridge_items`, `grocery_lines`, and `recipe_ingredients` where `identity->>'via' = 'barcode'`:
    - Insert one `foods` row. Take the name from the most recent `display_name`. Take nutrition from `food_cache.payload` where `source = 'openfoodfacts' and source_id = barcode`, falling back to `recipe_ingredients.nutrition` when its `basisUnit = 'g'` and `basisAmount = 100`. Set `nutrition_source = 'openfoodfacts'`.
    - Insert into `food_barcodes`.
2. **Catalog identities.** Same as step 1, keyed on `(source, sourceId)` into `off_source_id`.
3. **Manual identities.** Group by `(household_id, kind, normalized(display_name))`. One `foods` row per group, `nutrition_source = null`. This is the step that makes "eggs" in the fridge and "eggs" in a recipe the same food.
4. **Link rows.** Set `food_id` on every row by joining on the barcode, source id, or normalized name per its `via`.
5. **Dislikes.** Set `member_dislikes.food_id` when the normalized dislike name exactly matches a food. Leave the rest null; they stay text matches.
6. **Assert.** Count rows with `food_id is null` in the three item tables. Must be 0, or the migration raises.

Before running against a real database:

- [ ] `pg_dump` the project (or Supabase dashboard backup).
- [ ] `export_all_data` for each member as a second safety net.

### Code

- [ ] Add a `domain/foods.ts`: `Food` type, `FoodsStore` interface, a memory store, row mappers, and `normalizeFoodName`. Add `findOrCreateFoodByBarcode(store, householdId, barcode, lookup)`, which checks `food_barcodes`, then OFF via `lookupBarcode`, then creates. Add `findOrCreateManualFood(store, householdId, kind, name)`, which checks normalized name and aliases, then creates. Add `updateFood` and `mergeFoods(keepId, dropId)`, which repoints every `food_id` and moves barcodes and aliases. Merge is how duplicates get cleaned up.
- [ ] Change `addFoodByBarcode`, `addManualFood`, `addSupply`, the grocery equivalents, and the recipe-ingredient adds to resolve a `food_id` through the functions above, then write it. Keep writing `identity` too until Phase 8. Derive it from the food (`via: 'catalog', source: 'foodable', sourceId: food.id`) so `identityKey` keeps working during the transition.
- [ ] Switch `linking.ts` (`alreadyHaveTag`, `recipeToGroceryRemainder`) to key on `food_id`.
- [ ] Change `macrosForPerson` in `recipes.ts` to read nutrition from the joined `foods` row instead of `recipe_ingredients.nutrition`. Manual ingredients become complete as soon as someone fills in the food's nutrition once.
- [ ] Replace the demo picker search. Add `GET /api/foods/search?q=` (site cookie, member only). It returns household foods first (name and alias match), then `searchFoodsByName` OFF hits. The picker script fetches it with debounce. Delete `PICKER_DEMO_FOODS`, `demoFridgeFood`, and `DEMO_HOUSEHOLD_MEMBERS`. Search hits submit `food_id` for household foods or `barcode` for OFF hits.
- [ ] Add a **Foods** screen under Settings at `/settings/foods`. It lists foods and edits name, brand, aliases, default unit, nutrition per 100 g, allergens, and archive. It also merges two foods. This is the household's food truth.
- [ ] Add MCP tools: `search_food` returns household foods first, each with `food_id`. Add `get_food`, `upsert_food`, and `merge_foods`. Fridge, grocery, and recipe add tools accept `food_id` as the preferred input, with `barcode` and `name` still accepted and resolved through find-or-create.
- [ ] Fix the duplicate fridge locations. Add a migration that inserts every `households.fridge_locations` entry missing from `fridge_locations`, preserving order. Delete `update_fridge_locations` and the `fridgeLocations` field from household config. Drop the column in Phase 8.

### Verify

- [ ] Memory-store unit tests: find-or-create by barcode, name, and alias. Merge repoints all references. Manual "Eggs", "eggs ", and "EGGS" resolve to one food.
- [ ] `linking.test.ts`: a manual recipe ingredient and a manual fridge item with the same name produce a `full` or `partial` already-have tag. Today they produce `null`.
- [ ] Backfill test against a seeded local Supabase (`supabase start`): seed duplicate manual names and two barcodes, run the migrations, assert food counts and no null `food_id`.
- [ ] Live check: add "chicken thighs" manually to the fridge, create a recipe using "chicken thighs", add it to grocery, and confirm the remainder subtracts the stock.

---

## Phase 3. Units that fit food

- [ ] Allow food quantities in `g`, `oz`, `lb`, `ml`, `fl oz`, `cup`, `each`, and `tbsp` and `tsp` (add these two to `quantity.ts` and `units.ts`). The `unit` column on items stays text.
- [ ] Add `domain/food-quantity.ts` with `toGrams(quantity, food): number | null`. Mass converts directly. Volume needs `food.grams_per_ml`. `each` needs `food.grams_per_each`. A missing factor returns `null` (unknown), never a guess. Everything nutrition-related goes through this one function.
- [ ] `alreadyHaveTag` compares in the need's unit when dimensions match. Otherwise it compares through grams when both convert, and otherwise reports no tag. That is the same "unknown is not zero" rule.
- [ ] `quantity-field.ts` drops `FOOD_UNITS = ["g"]`. The picker preselects the food's `default_unit`. The fridge, grocery, and recipe pages print the stored unit, not a forced `g`.
- [ ] `macrosForPerson` uses `toGrams`. An ingredient whose grams are unknown marks the recipe `incomplete` and names the missing factor, for example "Eggs: set grams per each".
- [ ] Foods screen and `upsert_food`: edit `default_unit`, `grams_per_each`, and `grams_per_ml`. Prefill `grams_per_each` from OFF `serving_quantity` when the serving is a count.

### Verify

- [ ] Unit tests: 3 each at 50 g each is 150 g. 1 cup of milk at 1.03 g/ml is about 244 g. Each without a factor gives null and the recipe is incomplete with a named reason.
- [ ] A recipe needing 6 eggs, with 4 eggs in the fridge, shows partial: have 4, need 2.

---

## Phase 4. Food-backed meals

### Schema (expand only)

```sql
create table public.meal_items (
    id uuid primary key default gen_random_uuid(),
    meal_id uuid not null references public.meals (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    household_id uuid references public.households (id) on delete set null,
    food_id uuid references public.foods (id) on delete set null,
    recipe_id uuid references public.recipes (id) on delete set null,
    label text not null,           -- display text, survives food/recipe deletion
    amount numeric check (amount > 0),
    unit text,
    grams numeric check (grams >= 0),     -- resolved at write time, null if unknown
    portions numeric check (portions > 0),-- for recipe items
    -- nutrition snapshot at write time; edits to the food later do not rewrite history
    calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
    fiber_g numeric, sugar_g numeric, alcohol_g numeric, caffeine_mg numeric,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    check (food_id is not null or recipe_id is not null or label <> '')
);
create index meal_items_meal_idx on public.meal_items (meal_id, sort_order);
create index meal_items_user_food_idx on public.meal_items (user_id, food_id);
-- RLS: owner of the meal (user_id = auth.uid()) all; household peers select,
-- matching the existing peer-read model for meals.
```

Rules:

- **`meals` totals stay authoritative for reads.** When a meal has items, the write path sets `meals.calories` and the other totals to the sum of item snapshots, null-aware: a nutrient is null only if every item's value is null. Insights, goals, widgets, trends, `get_nutrition_summary`, and import all keep working unchanged.
- **Snapshots, not live joins.** Editing a food's nutrition next month must not change what someone ate last week.
- **Free text still works.** `log_meal` without items behaves exactly as today. Photo estimates and restaurant meals stay first-class.
- **Export.** `meals.csv` stays byte-identical, because it is the import contract in CLAUDE.md. Add a new `meal_items.csv` to the ZIP. It always has a header, has a `timezone` column, and is keyed by `meal_id`. Document it in the export README.

### Code

- [ ] Add a `domain/meals.ts` with `buildMealFromItems(items, foods, recipes)`. It resolves grams, snapshots nutrition, sums totals, and reports which items were unknown. Pure, and tested with memory stores.
- [ ] Add an optional `items: [{ food_id | recipe_id | name, amount, unit | portions }]` to MCP `log_meal` and `update_meal`. When items are present, totals are computed and any caller-sent totals are ignored, with a warning in `content`. Idempotency: the `auto:` digest includes the item list.
- [ ] Add MCP `log_recipe_portion(recipe_id, portions, member?, logged_at?, meal_type?)`. It creates a meal with one recipe item. Per-person macros come from `macrosForPerson`.
- [ ] Web nutrition page: replace the description-only form, which hard-codes `meal_type: "snack"` today. The new form takes a meal type select, then a food picker with quantity (repeatable rows), plus "or describe it" free text with optional macros. Add a "Log a portion" button on the recipe detail page.
- [ ] `get_meals_*` and `search_meals` include items in their text output. `groupMealVariations` can key on the sorted `food_id` set when items exist.

### Verify

- [ ] Unit: totals equal the sum of snapshots. A food without nutrition makes that item's nutrients null without zeroing the meal. Later food edits do not change logged meals.
- [ ] `export.test.ts`: `meals.csv` is byte-identical to before for the same data, and `meal_items.csv` has a header with zero rows.
- [ ] Live: log "2 eggs + 1 slice toast" from the web form, and the nutrition widgets reflect the computed totals.

---

## Phase 5. Close the loops

### Schema

```sql
create table public.stock_movements (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    food_id uuid not null references public.foods (id) on delete cascade,
    fridge_item_id uuid references public.fridge_items (id) on delete set null,
    delta numeric not null,          -- signed, in `unit`
    unit text not null,
    reason text not null check (reason in
        ('purchase', 'cook', 'eat', 'discard', 'adjust')),
    grocery_line_id uuid,            -- source refs, nullable, no FK (rows get deleted)
    recipe_id uuid,
    meal_id uuid,
    actor_user_id uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now()
);
create index stock_movements_food_idx on public.stock_movements (household_id, food_id, created_at desc);

alter table public.fridge_items
    add column purchased_on date,
    add column opened_on date,
    add column expires_on date;
```

`fridge_items` remains the current state. `stock_movements` is the audit trail: "where did the milk go", undo, and later "how fast do we go through eggs" for auto-suggesting groceries. Every stock change goes through one function, so the two cannot drift.

### Code

- [ ] Add a `domain/stock.ts` with `applyMovement(store, movement)`. It merges into an existing fridge item with the same `food_id`, location, and convertible unit, or creates one. It decrements across items in expiry order, oldest first. It never goes negative: a shortfall is reported, not clamped silently.
- [ ] **Put away.** On the grocery page, checking a line offers "Put away", which defaults to the food's last-used location. That does a `purchase` movement and deletes the line. MCP `put_away_grocery_lines(line_ids, location_id?)`. "Clear checked" stays for lines you do not want stocked.
- [ ] **Cook.** MCP `cook_recipe(recipe_id, portions_by_member, deduct_stock = true, log_meals = true)`, plus a "Cooked it" form on the recipe page. It deducts ingredients scaled to the total portions (`cook` movements). When `log_meals` is set, it writes one `log_recipe_portion` meal per member (Phase 4). It returns any shortfalls.
- [ ] **Eat from fridge.** "Ate it" on a fridge item does an `eat` movement plus a meal with that food item.
- [ ] **Discard.** "Toss" does a `discard` movement.
- [ ] Expiring-soon view: a strip at the top of the Fridge page, and MCP `list_expiring(days = 3)`.

### Verify

- [ ] Unit: put-away merges into existing stock with a compatible unit. Cook deducts across two fridge items oldest-expiry first and reports a shortfall. Ledger sum equals current state in property-style tests.
- [ ] Live, end to end: recipe, then add-to-grocery (remainder only), check, put away (fridge grows), cook for two members (fridge shrinks, two meals logged, both nutrition dashboards move).

---

## Phase 6. Recipes, fuller

- [ ] Schema: `recipes` gets `instructions text` (markdown), `source_url text`, `tags text[] default '{}'`, `notes text`, `prep_minutes int`, `cook_minutes int`. Add a `recipe_ingredients.note text` column, for things like "diced" or "room temp".
- [ ] Code: `updateRecipe`, `updateRecipeIngredient`, `removeRecipeIngredient`, `reorderRecipeIngredients` in `domain/recipes.ts`, mirrored in MCP and the web page. The `RecipesStore` interface gains the missing update and delete methods.
- [ ] MCP `import_recipe_from_text(text, source_url?)`. The agent sends structured fields it extracted. The server find-or-creates foods for each ingredient and returns which ingredients lack nutrition or unit factors so the agent can fill them in. Use the existing `households.recipe_search_places` config to tell the agent where to look.
- [ ] Filter recipes by tag, "can make now" (all ingredients fully covered by fridge stock, via `alreadyHaveTag`), and "safe for" a member (no allergen hits on `foods.allergens`, no dislikes).
- [ ] Recipe nutrition per portion is shown even when you are not filtering by person, and is stored as `foods` with `nutrition_source = 'recipe'` only if we ever want recipes as ingredients of other recipes. That is deferred, noted here only.

---

## Phase 7. Agent surface

- [ ] Rewrite `SERVER_INSTRUCTIONS` around the household model. Cover the five pillars, that foods are the shared identity (always `search_food` and then pass `food_id`), the loop (grocery, put away, fridge, cook or eat, meals), the member targeting rules, store and person rules plus allergens and dislikes as constraints the agent must honor, and the existing time and logging guidance kept as is.
- [ ] Consolidate tools. Target about 40, down from 70. Candidates:
    - `list_store_rules`, `set_store_rules`, `list_person_rules`, `set_person_rules`, `list_person_allergens`, `set_person_allergens`, `list_person_dislikes`, `set_person_dislikes` become `get_household_rules` and `set_household_rules({ store_rules?, person: { user_id, rules?, allergens?, dislikes? }[] })`.
    - `list_fridge_locations` and `list_fridge_items` become `get_fridge`, which returns locations with their items.
    - `get_meals_today`, `get_meals_by_date`, and `get_meals_by_date_range` become `get_meals(date? | from/to?)`.
    - The `get_water_*` tools become `get_water(date? | from/to?)`. The `get_weight_*` tools become `get_weight(date? | from/to?)`.
    - `get_nutrition_goals` folds into `get_goal_progress`.
    - Update `src/copy/tools.ts` `TOOLS` and the `mcp.test.ts` assertion in the same PR.
- [ ] Add MCP Apps widgets for the household pillars, reusing the shared partials: a `grocery-list` card returned by `list_grocery_lines` (store, then sections, then lines, with already-have tags and app-initiated check-off through `callTool`), and a `fridge` card returned by `get_fridge`. Follow every bridge and sizing invariant in CLAUDE.md, and test both in `bun run harness`.
- [ ] Optional: a weekly digest tool combining the pillars, covering what expires, what we ran out of, nutrition vs goals per member, and suggested grocery lines from the stock ledger.

---

## Phase 8. Contract

Run only after Phases 2 to 7 have been live and stable for a while, with a backup taken first.

- [ ] Drop `fridge_items.identity`, `grocery_lines.identity`, `recipe_ingredients.identity`, `recipe_ingredients.nutrition`, `member_dislikes.identity`.
- [ ] Set `fridge_items.food_id`, `grocery_lines.food_id`, and `recipe_ingredients.food_id` to `not null`.
- [ ] Drop `households.fridge_locations`.
- [ ] Delete `food-identity.ts`'s `ManualRef` and `householdManualId`, and any code path still writing `identity`.
- [ ] Drop `bootstrap_household` if `closed-household-plan.md` PR-4 has not already replaced it.

---

## Decisions still open

| Decision                               | Recommendation                                                        | Blocks                 |
| -------------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| i18n: keep any non-English locale?     | English only                                                          | Phase 0                |
| Fonts: self-host vs system stack       | Self-host the current three                                           | Phase 0                |
| Brand accent: replace `sky` default?   | Yes, once the logo color is known                                     | Phase 0 brand          |
| Starting version                       | `0.1.0`                                                               | Phase 0                |
| Hosting target                         | Any Docker host plus Supabase. `PUBLIC_ORIGIN` keeps it host-agnostic | Not blocking           |
| Supabase cloud vs self-hosted Supabase | Cloud first, document self-hosted                                     | `docs/self-hosting.md` |
| Rename Grocery to Shopping list        | Defer. Rename copy only, keep table names                             | Not blocking           |

# Nutrition MCP

A remote MCP server for personal nutrition tracking — log meals with calories, macros, fiber, total sugar and caffeine, log water and body weight, review nutrition history, and import an existing food diary from another app, all through conversation. Alcohol tracking is opt-in and off by default.

[Help me pay for the servers on Patreon][patreon]

[patreon]: https://patreon.com/akutishevskyi

## Table of Contents

- [Quick Start](#quick-start)
- [Demo](#demo)
- [Tech Stack](#tech-stack)
- [MCP Tools](#mcp-tools)
- [MCP Resources](#mcp-resources)
- [Self-hosting](#self-hosting)
    - [0. Get the code](#0-get-the-code)
    - [1. Supabase setup](#1-supabase-setup)
    - [2. Environment variables](#2-environment-variables)
- [Development](#development)
    - [Testing and quality](#testing-and-quality)
- [Connect to Claude.ai](#connect-to-claudeai)
- [API Endpoints](#api-endpoints)
- [Deploy](#deploy)
- [License](#license)

## Quick Start

Already hosted and ready to use — just connect it to your MCP client:

```
https://nutrition-mcp.com/mcp
```

**On Claude.ai:** Customize → Connectors → + → Add custom connector → paste the URL → Connect (see [Connect to Claude.ai](#connect-to-claudeai) below for the full walkthrough)

On first connect you'll be asked to register with an email and password. Your data persists across reconnections.

Bring your history with you: say "import my meals" and an importer opens in the chat, where you pick the CSV you exported from your old app, map its columns, and check what will be added before anything is saved. Exports from MyFitnessPal, Cronometer, Lose It! and MacroFactor are recognised automatically; any other CSV works by mapping its columns yourself. In clients that can't show in-chat panels, paste the export instead and the AI imports it for you. If your export has an alcohol column and you want it kept, turn alcohol tracking on before importing. The importer skips that column while tracking is off, and re-importing the same file later won't backfill it.

## Demo

[![Demo](https://img.youtube.com/vi/Y1EHbfimQ70/maxresdefault.jpg)](https://youtube.com/shorts/Y1EHbfimQ70)

Read the story behind it: [How I Replaced MyFitnessPal and Other Apps with a Single MCP Server](https://medium.com/@akutishevsky/how-i-replaced-myfitnesspal-and-other-apps-with-a-single-mcp-server-56ca5ec7d673)

## Tech Stack

- **Bun** — runtime and package manager
- **Hono** — HTTP framework
- **MCP SDK** — Model Context Protocol over Streamable HTTP
- **Supabase** — PostgreSQL database + user authentication
- **OAuth 2.0** — authentication for Claude.ai connectors

## MCP Tools

| Tool                       | Description                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `log_meal`                 | Log a meal with description, type, calories, macros, fiber, total sugar, alcohol, caffeine (mg), notes — from text or a photo of your plate                                 |
| `start_meal_import`        | Open the in-chat CSV importer: pick an export from another app, map its columns, preview, confirm                                                                           |
| `bulk_import_meals`        | Write up to 50 imported rows per call — each row validated, duplicates skipped so a re-send is safe                                                                         |
| `lookup_barcode`           | Look up a packaged product's label nutrition by barcode via Open Food Facts (read from a photo or typed)                                                                    |
| `get_meals_today`          | Get all meals logged today                                                                                                                                                  |
| `get_meals_by_date`        | Get meals for a specific date (YYYY-MM-DD)                                                                                                                                  |
| `get_meals_by_date_range`  | Get meals between two dates (inclusive)                                                                                                                                     |
| `search_meals`             | Search past meals by keyword, grouped into recurring variations (counts, last logged, typical macros)                                                                       |
| `get_nutrition_summary`    | Daily nutrition totals + goal progress for a date range                                                                                                                     |
| `update_meal`              | Update any fields of an existing meal                                                                                                                                       |
| `delete_meal`              | Delete a meal by ID                                                                                                                                                         |
| `set_nutrition_goals`      | Set daily calorie, macro, fiber and water targets to reach, sugar/alcohol/caffeine limits to stay under, plus an optional target weight                                     |
| `get_nutrition_goals`      | Get the current daily targets and limits                                                                                                                                    |
| `get_goal_progress`        | Get intake vs. targets and limits for a given day (default: today), plus latest weight vs. target                                                                           |
| `log_water`                | Log a hydration entry in milliliters                                                                                                                                        |
| `get_water_today`          | Get today's water intake total and entries                                                                                                                                  |
| `get_water_by_date`        | Get water intake for a specific date                                                                                                                                        |
| `delete_water`             | Delete a water log entry by ID                                                                                                                                              |
| `log_weight`               | Log a body-weight measurement in kg or lb (converted and stored server-side)                                                                                                |
| `get_weight_today`         | Get today's weight entries                                                                                                                                                  |
| `get_weight_by_date`       | Get weight entries for a specific date                                                                                                                                      |
| `get_weight_by_date_range` | Get weight entries between two dates (inclusive), grouped by day                                                                                                            |
| `get_weight_trends`        | Weight trend: latest, overall change, 7/14/30-day moving averages, min/max, and goal progress                                                                               |
| `update_weight`            | Update an existing weight entry                                                                                                                                             |
| `delete_weight`            | Delete a weight entry by ID                                                                                                                                                 |
| `set_weight_unit`          | Set the preferred weight unit (`kg` or `lb`; null to clear)                                                                                                                 |
| `get_trends`               | 7/14/30-day averages, std dev, streaks, day-of-week, best/worst day                                                                                                         |
| `get_meal_patterns`        | Pre-aggregated behavioural patterns (breakfast effect, late dinner, weekend vs weekday, outliers)                                                                           |
| `export_all_data`          | Export every table — meals, water, weight, goals, profile — as one ZIP of CSVs plus a README, and return a 60-minute download link                                          |
| `get_profile`              | Get timezone (+ local date/time), widget language, weight unit, widget display and alcohol tracking in one call                                                             |
| `set_timezone`             | Set the user's IANA timezone (e.g. `America/Los_Angeles`)                                                                                                                   |
| `set_language`             | Set the UI language for in-chat widgets (dashboards, charts) — not the language the AI replies in                                                                           |
| `get_current_time`         | Get the current date and time in the user's timezone, plus the UTC instant — for hosts with no clock in context                                                             |
| `set_widget_display`       | Enable or disable the in-chat visual widgets (dashboards, rings, charts); enabled by default                                                                                |
| `set_alcohol_tracking`     | Turn alcohol tracking on or off (off by default) and choose US standard drinks or UK units; turning it off hides alcohol rather than deleting it                            |
| `rotate_household_token`   | Issue a household bot token (`nt_hh_…`). Shown once; stored as a hash. Any member may rotate. A PAT may rotate and then stops working                                       |
| `list_members`             | List household members (`user_id`, `display_name`, `role`). A household PAT and any member may call this                                                                    |
| `add_household_member`     | Create an Auth login and household member. `display_name`, `password`, and either `email` or `username`. Username becomes `{username}@household.invalid`. Returns `user_id` |
| `get_household_config`     | Read household name, fridge locations, recipe search places, and shared preferences                                                                                         |
| `update_household_config`  | Merge household name, fridge locations, recipe places, or preferences. Places are labels, not a recipe table                                                                |
| `update_fridge_locations`  | Replace the household fridge and freezer location list                                                                                                                      |
| `delete_account`           | Permanently delete account and all associated data                                                                                                                          |

## MCP Resources

| URI                          | Description                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `nutrition://weekly-summary` | Rolling 7-day digest (averages vs targets, best/roughest day) for proactive pulls |

## Self-hosting

### 0. Get the code

```bash
git clone https://github.com/akutishevsky/nutrition-mcp.git
cd nutrition-mcp
bun install
cp .env.example .env   # fill in real values as you go through the steps below
```

Requires Bun 1.x (matches the Dockerfile's `oven/bun:1` base image; no exact minor version is pinned).

> **Making it yours:** Login HTML and `src/index.ts` include the maintainer's Google Analytics tag, Glama email, and domain. Run `bun run gen:all` to produce the login templates, then `bun run depersonalize` to strip those bits (analytics + CSP, Glama, widget support email, domain → a `your-domain.com` placeholder). Use `bun run depersonalize --dry` to preview without writing. Afterwards swap in your own `favicon.ico` and replace the domain placeholder. The script does not touch this README, so if you're publishing a fork, also edit or remove the Patreon line near the top and the Medium link in [Demo](#demo).

### 1. Supabase setup

1. Create a [Supabase](https://supabase.com) project.
2. Enable **Email Auth** (Authentication → Providers → Email) and disable email confirmation.
3. Apply the schema. The full schema lives in [`supabase/migrations/`](supabase/migrations/). With the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):

    ```bash
    supabase link --project-ref <your-project-ref>
    supabase db push
    ```

    This creates every table, index, RLS policy, and foreign key the app needs. No local Postgres is involved — migrations run against your hosted project.

4. Copy the **service role key** from Project Settings → API and use it as `SUPABASE_SECRET_KEY`. The same key already bypasses RLS and is what `add_household_member` uses for Auth admin `createUser`.

### 2. Environment variables

| Variable              | Description                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`        | Your Supabase project URL                                                                                                                                      |
| `SUPABASE_SECRET_KEY` | Supabase service role key (bypasses RLS). Also used for Auth admin `createUser` when adding a household member                                                 |
| `OAUTH_CLIENT_ID`     | Random string for OAuth client identification                                                                                                                  |
| `OAUTH_CLIENT_SECRET` | Random string for OAuth client authentication                                                                                                                  |
| `ALLOWED_ORIGINS`     | _(optional)_ Comma-separated list of extra browser origins allowed to call `/mcp` via CORS — `localhost`/`127.0.0.1` on any port are always allowed regardless |
| `OFF_USER_AGENT`      | Open Food Facts User-Agent for barcode lookups, in the form `AppName (email)`                                                                                  |
| `PORT`                | Server port (default: `8080`)                                                                                                                                  |

Generate OAuth credentials:

```bash
bun run generate-oauth-creds
```

or manually:

```bash
openssl rand -hex 16   # use as OAUTH_CLIENT_ID
openssl rand -hex 32   # use as OAUTH_CLIENT_SECRET
```

## Development

```bash
bun install
cp .env.example .env   # fill in your credentials — see Self-hosting above for what to put here
bun run dev             # regenerates login templates, then starts with hot reload on http://localhost:8080
```

The login templates under `public/` (`login.html` and locale mirrors) are build artifacts, not tracked in git. They are regenerated on every Docker build, in CI, and once at each `bun run dev` start. `--watch` only restarts the `src/index.ts` process on save, so it does **not** rerun generation. After editing `src/copy/login.ts` or `scripts/site-partials.ts`, run `bun run gen:all` yourself.

### Testing and quality

```bash
bun test                # run the test suite
bun run format           # format with Prettier (4-space indentation)
bun run format:check     # verify the tree is prettier-clean
bun run typecheck        # typecheck src/
```

CI runs `format:check` and `typecheck` on every PR; `typecheck` is scoped to `src/`, so a type error in a test file or under `scripts/` won't be caught by it.

For in-chat widget development (`public/widgets/`), `bun run harness` starts a local host simulator so you can test widgets without a real MCP client.

## Connect to Claude.ai

1. Open [Claude.ai](https://claude.ai) and click **Customize**
2. Click **Connectors**, then the **+** button
3. Click **Add custom connector**
4. Fill in:
    - **Name**: Nutrition Tracker
    - **Remote MCP Server URL**: `https://nutrition-mcp.com/mcp`
5. Click **Connect** — sign in or register when prompted
6. After signing in, Claude can use your nutrition tools. If you reconnect later, sign in with the same email and password to keep your data.

## API Endpoints

| Endpoint                                      | Description                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /health`                                 | Health check                                                                |
| `GET /robots.txt`                             | Crawlers: `Disallow: /`                                                     |
| `GET /.well-known/oauth-authorization-server` | OAuth metadata discovery (root + `/mcp`-scoped variants)                    |
| `GET /.well-known/oauth-protected-resource`   | OAuth protected-resource metadata discovery (root + `/mcp`-scoped variants) |
| `POST /register`                              | Dynamic client registration                                                 |
| `GET /authorize`                              | OAuth authorization (shows login page)                                      |
| `POST /approve`                               | Login/register handler                                                      |
| `POST /token`                                 | Token exchange                                                              |
| `GET /favicon.ico`                            | Server icon                                                                 |
| `ALL /mcp`                                    | MCP endpoint (authenticated)                                                |

## Deploy

The project includes a `Dockerfile` for container-based deployment.

1. Push your repo to a hosting provider (e.g. DigitalOcean App Platform)
2. Set the environment variables listed above
3. The app auto-detects the Dockerfile and deploys on port `8080`
4. Point your domain to the deployed URL

## License

[MIT](LICENSE)

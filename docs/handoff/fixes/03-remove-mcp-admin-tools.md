# Fix 3: Remove membership and token tools from the MCP

Status: implemented on branch `fix/remove-mcp-admin-tools`.

Source: deployment audit, 2026-10-07. Owner decision, 2026-10-10: adding people and rotating the bot token are manual, owner-only actions in the web app. The MCP should not be able to do either.

## Problem

Two MCP tools let an agent change who can get into the household:

- `add_household_member` creates an Auth user with a password and adds them to the household.
- `rotate_household_token` issues a new `nt_hh_` bot token, which invalidates the old one.

A household bot token (`auth.kind === "household"`) passes `callerOwnerHouseholdId()` in `src/mcp/shared.ts`, so a leaked bot token can call both. That means it can add a login for itself, or rotate the token and lock the real bots out. A prompt-injected agent running on the owner's OAuth token can do the same.

The web app already covers both actions, owner-only, behind `requireOwner`:

- `POST /settings/household` adds a member (`src/web/routes/settings.ts`).
- `POST /settings/household/rotate-token` rotates the token (same file).

## Decisions

- **Remove** `add_household_member` and `rotate_household_token` from the MCP. Do not hide them behind a flag.
- **Keep** `list_members`, `get_household_config`, `update_household_config` and `delete_account`. Household config is food settings, not people or credentials. `delete_account` already refuses household tokens.
- Keep the DB layer: `addHouseholdMemberForHousehold` and `rotateHouseholdMcpToken` in `src/db/household.ts` are still used by the web routes.
- The tool count goes from **69 to 67**.

## Changes

1. `src/mcp/tools/household.ts`: delete both `server.registerTool(...)` blocks, then drop the imports that become unused (`generateHouseholdToken`, `hashHouseholdToken`, `householdTokenHashHex`, `parseMemberInput`, `addHouseholdMemberForHousehold`, `rotateHouseholdMcpToken`, and any output schemas only those tools used). Run `bun run typecheck` to catch the rest.
2. `src/mcp/tools-list.snapshot.json`: remove both names and keep the order of the others.
3. `src/copy/tools.ts`: remove both entries from `TOOLS_BASE` and from `HOUSEHOLD_SCOPED_TOOL_NAMES`.
4. `src/mcp.test.ts`:
    - Delete the tests that call the removed tools: `rotate_household_token returns a nt_hh_ token once`, `PAT add_household_member ...` (two tests), the `describe("rotate_household_token from member OAuth")` and `describe("add_household_member from member OAuth")` blocks, and any related fixtures that become unused.
    - Fix the tests that only **list** them. `tools/list still advertises person tools and rotate_household_token` and `tools/list succeeds for a household PAT` should now assert the two names are **absent** (`toBe(false)` / `not.toContain`).
    - Add one test: calling `rotate_household_token` and `add_household_member` with a household PAT and with owner OAuth both fail as unknown tools (method-not-found / tool-not-found from the SDK).
    - Remember the `mock.module` rules in `CLAUDE.md`: do not open a new mock window, and edit within the existing ones.
5. Web coverage must stay. Confirm tests still exist for `POST /settings/household` (add member, owner-only) and `POST /settings/household/rotate-token`, and that a member (non-owner) gets 403 on both. Grep `src/*.test.ts` and `src/web/**/*.test.ts`. If either is missing, add it, because the web path is now the only path.
6. Docs:
    - `CLAUDE.md`: "There are 69 tools" becomes 67.
    - `docs/self-hosting.md`, "First-user flow" step 4: remove "or the MCP tool `add_household_member`". Say members and the bot token are managed only in **Settings → Household**.
    - `docs/handoff/foodable-launch-handoff.md`: both "returns 69 tools" lines become 67.
    - `docs/handoff/foodable-architecture-plan.md`: the "Tool count is 69" line gets a dated note ("67 since 2026-10, membership and token tools moved to the web app only").
    - Leave `docs/handoff/closed-household-plan.md` alone. It is a historical plan.
7. `SERVER_INSTRUCTIONS` in `src/mcp/server.ts` and the descriptions of other tools: grep for mentions of the removed tools and remove them. Add one sentence telling the model that adding people and rotating the bot token happen in the web app at Settings → Household, so it can point the user there instead of guessing.

## Out of scope

- Restricting `update_household_config` for bot tokens (the owner chose to keep it).
- OAuth (Fix 1), DB grants (Fix 2), and deploy hardening (Fix 4).

## Conflicts with sibling PRs

Fix 4 edits `docs/self-hosting.md` and `docs/handoff/foodable-launch-handoff.md` in different sections. Whichever merges second rebases.

## Done when

- [x] `bun test`, `bun run typecheck` and `bun run format:check` are green.
- [x] `tools/list` returns 67 names, matching the snapshot. Check with `bun run inspect` against a local server, or through the existing snapshot test.
- [ ] Manual: as the owner, add a member and rotate the token in the web app, and both still work. As a member, both are refused. (not done: no browser/manual session in this agent run; web paths covered by `authenticated dashboard HTTP` tests in `src/mcp.test.ts`.)
- [x] This file's checkboxes are ticked.

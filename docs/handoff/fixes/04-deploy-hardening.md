# Fix 4: Deploy hardening and the go-live checklist

Status: plan only. An implementation agent completes this branch and takes the PR out of draft.

Source: deployment audit, 2026-10-07, with owner decisions from 2026-10-10. Severity: **medium**. Small, independent changes that make the Railway deploy predictable, plus the written checklist the owner follows on deploy day.

## Owner decisions that bound this PR

- Nothing becomes short-lived. Tokens keep their 365-day lifetime and site cookies keep 30 days. No one should have to reconnect or re-create anything on a schedule.
- `SESSION_SECRET` is **one env var set once**. It is not rotated.
- Hosting is Railway (US East, next to Supabase project `dapbxswqfiqvxutsobhr`).

## Changes

### 1. Separate `SESSION_SECRET` for the site cookie

Today `src/site-session.ts` signs the `nm_site` cookie with `OAUTH_CLIENT_SECRET`. A secret that leaks from one area should not compromise the other.

- `sessionSecret()` reads `process.env.SESSION_SECRET` first.
- If it is unset, fall back to `OAUTH_CLIENT_SECRET` and `console.warn` **once** per process: `"[config] SESSION_SECRET is unset; signing site sessions with OAUTH_CLIENT_SECRET"`. The fallback keeps local dev and existing `.env` files working.
- If both are unset, throw as today.
- Require a minimum length of 32 characters for `SESSION_SECRET` when it is set, and throw with a clear message otherwise.
- Tests in `src/site-session.test.ts`:
    - A cookie minted with `SESSION_SECRET=A` fails to verify under `SESSION_SECRET=B`.
    - The fallback path still verifies.
    - The warning is logged once.
- `package.json` `generate-oauth-creds`: also print `SESSION_SECRET=$(openssl rand -hex 32)`.
- `.env.example`, both env tables in `docs/self-hosting.md`, and `README.md` line 32: add `SESSION_SECRET` and change the `OAUTH_CLIENT_SECRET` description from "also the site-session HMAC" to "MCP OAuth client secret".

Setting it on an existing deploy logs everyone out of the web app once. MCP tokens are unaffected. Say so in the docs row.

### 2. Timeout on every Supabase request

`src/db/client.ts` `buildClient()` has no request timeout. A stalled Supabase holds each request until Bun's 120-second `idleTimeout`. Pass a `global.fetch` wrapper to `createClient`:

```ts
const SUPABASE_TIMEOUT_MS = 15_000;
const timedFetch: typeof fetch = (input, init) => {
    const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
    const signal = init?.signal
        ? AbortSignal.any([init.signal, timeout])
        : timeout;
    return fetch(input, { ...init, signal });
};
// createClient(url, key, { auth: {...}, global: { fetch: timedFetch } })
```

Check the `@supabase/supabase-js` version in `bun.lock` and confirm that `global.fetch` is still the option name in its docs before relying on it. Make sure a timeout surfaces as an error the existing paths already handle: `lookupBearer` maps thrown errors to `"unavailable"`, so a timeout must **not** count as an auth strike. Add a test for that if one is cheap.

### 3. Pin the Bun base image

The `Dockerfile` uses `FROM oven/bun:1`, a floating tag, so a rebuild can silently change the runtime. Pin it to the exact version CI uses (`oven-sh/setup-bun@v2` resolves the latest version unless told otherwise):

- Pick one version, for example the one `bun --version` reports locally. **Verify the tag exists** on Docker Hub (`docker manifest inspect oven/bun:<version>`, or the Hub tags page) before writing it, per `CLAUDE.md` "No unverified version pinning".
- Set the same version in `.github/workflows/ci.yml` with `with: bun-version: <version>`, so CI and the image match.
- Optionally add `"packageManager"` or an `engines.bun` field to `package.json`. Skip it if it fights `bun install --frozen-lockfile`.

### 4. Remove the stale DigitalOcean / nutrition-mcp.com references

- `.github/workflows/ci.yml` lines 3–5 say merging to main auto-deploys to DigitalOcean at `nutrition-mcp.com`. Replace them: Railway deploys `main`, so CI is the last gate before the household's deploy.
- `src/middleware.ts` `getClientIp` comment: "Behind DigitalOcean's proxy" becomes Railway. Railway strips client-supplied `X-Forwarded-For` at its edge, so the first entry is the connecting IP ([Railway Station thread](https://station.railway.com/questions/security-critical-questions-on-edge-prox-8fddd775)). Note that the header is spoofable behind a proxy that **appends** instead, so the comment should warn anyone moving hosts.
- `src/index.ts`, the shutdown-gate comment ("on a DigitalOcean deploy (SIGTERM)") becomes "on a deploy (SIGTERM)".
- `grep -rn "DigitalOcean\|nutrition-mcp.com" src .github docs/self-hosting.md README.md` should then only match intentional mentions.

### 5. The go-live checklist (new doc)

Create `docs/deploy-checklist.md` and link it from `docs/self-hosting.md` (Railway section) and from the top of `docs/handoff/foodable-launch-handoff.md`. Content below, adjusted to what Fixes 1–3 actually merged. Keep it a checklist. Reference the handoff for detail rather than repeating it.

```markdown
# Deploy checklist

Merge Fixes 1–3 first. Fix 2's migration must be pushed before the URL is public.

## Supabase

- [ ] `PG_BIN=<postgres bin>/ bun run db:dryrun`, then `bunx supabase db push --dry-run`, then `bunx supabase db push`.
- [ ] Authentication → Sign In / Providers: email + password on, "Confirm email" off.
- [ ] Leave "Allow new users to sign up" **on** until the owner has signed up (step under Railway). Then turn it **off**.
      Members are created with the admin API, which ignores this toggle.
- [ ] Optional: Pro plan, so the project never pauses (free projects pause after 7 days idle).

## Railway

- [ ] New project → Deploy from GitHub repo → `MrF1ow/nutrition-mcp`, branch `main`. Region: US East.
- [ ] Variables (do **not** set `PORT`):
      `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (service role), `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `SESSION_SECRET`
      (all fresh from `bun run generate-oauth-creds`), `OFF_USER_AGENT=Foodable (<email>)`.
- [ ] Networking → Generate Domain. Set `PUBLIC_ORIGIN=https://<domain>` (no trailing slash). Redeploy.
- [ ] `curl https://<domain>/health` → `ok`. `/.well-known/oauth-authorization-server` shows `https://<domain>` URLs.
- [ ] **Immediately** open `https://<domain>/`, sign up as the owner, and create the household.
      While Auth is empty, the first visitor becomes the owner. Do not share the URL before this.
- [ ] Supabase: turn "Allow new users to sign up" **off**. Confirm a new email at `/` gets `signup_closed`.

## Members and bots

- [ ] Settings → Household: add each person (name, email or username, password). Hand them the login yourself.
- [ ] Each person: Claude.ai → Settings → Connectors → Add custom connector → `https://<domain>/mcp`, then sign in.
      Same URL in ChatGPT and Claude Code. Remove any old nutrition-mcp connector.
- [ ] Bots: Settings → Household → rotate the token, copy it once, then configure
      `Authorization: Bearer nt_hh_…` against `https://<domain>/mcp`. The bot passes `user_id` for the person it acts for.
- [ ] Run the walk in `docs/handoff/foodable-launch-handoff.md`, step 5 (tool count is now 67).

## Retire the old deploy (confirm first)

- [ ] Shut down the old server.
- [ ] Delete the old Supabase project.
- [ ] Remove old connectors and DNS records.
```

## Out of scope (logged for later)

- An `OWNER_EMAIL` env var to close the first-visitor-becomes-owner window in code. The checklist covers it by doing the sign-up immediately.
- An Origin check on web POSTs. `SameSite=Lax` already blocks cross-site form posts.
- Token hashing, revocation UI, and a membership / bearer-lookup cache. Performance is fine for one household.
- OAuth (Fix 1), DB grants (Fix 2), and MCP tools (Fix 3).

## Conflicts with sibling PRs

- Fix 1 also edits `.env.example` and the env tables in `docs/self-hosting.md`.
- Fix 3 edits `docs/self-hosting.md` (first-user flow) and `docs/handoff/foodable-launch-handoff.md` (tool count).
- Merge this one **last** and rebase onto the others.

## Done when

- [ ] `bun test`, `bun run typecheck` and `bun run format:check` are green, and CI runs on the pinned Bun version.
- [ ] `docker build .` succeeds locally on the pinned image, and the container answers `/health`.
- [ ] Local boot without `SESSION_SECRET` logs the one-time warning. Boot with it does not.
- [ ] `docs/deploy-checklist.md` exists and is linked.

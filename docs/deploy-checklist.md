# Deploy checklist

Use this on deploy day after the deploy-hardening fixes are on `main`. See `docs/handoff/foodable-launch-handoff.md` for step-by-step detail rather than duplicating it here.

Setting `SESSION_SECRET` on an existing deploy logs everyone out of the web app once (MCP tokens are unaffected).

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
- [ ] Run the walk in `docs/handoff/foodable-launch-handoff.md`, step 5 (`tools/list` returns 67 tools).

## Retire the old deploy (confirm first)

- [ ] Shut down the old server.
- [ ] Delete the old Supabase project.
- [ ] Remove old connectors and DNS records.

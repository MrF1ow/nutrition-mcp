# Closed household lifecycle plan

A self-hosted household is one deploy and one Supabase project. The first person signs up with email and password, then creates that household as owner. Later people exist only when the owner adds them. Public registration closes after the first Auth user. Google signup is deleted. Auto-join does not ship. Do these PRs in order. PR-1, PR-2, PR-3, then PR-4.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. The operator reviews and lands every PR. PR-1, PR-2, and PR-3 wait for the operator in chat. PR-4 is not review-gated.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] On the operator's go, arm a `/goal` with this exact text. "Plan `docs/handoff/closed-household-plan.md`. PRs PR-1, PR-2, PR-3, PR-4 in that order. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Root appends. Operator lands. Done when Google signup is gone, the first Auth user creates the household as owner, public registration is closed, only the owner can rotate the household token and add members, and a stranger who finds the URL cannot join."
- [ ] Read these from trunk at program start. Re-read them at every tick.
    - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
    - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
    - [ ] `git show origin/main:pstack/skills/control-ui/SKILL.md`
    - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
    - [ ] `git show origin/main:pstack/skills/principle-sequence-verifiable-units/SKILL.md`
    - [ ] `git show origin/main:pstack/skills/principle-subtract-before-you-add/SKILL.md`
- [ ] If those `git show` paths miss because this repo has no pstack tree, read the same files from the Cursor pstack plugin cache and record that in the trail. Do not skip the re-read.
- [ ] Arm the 30-minute audit tick. In a local session, a real terminal `/loop`. In a cloud root, a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a status message to the operator in chat, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.
- [ ] Discard any local uncommitted `ensureHouseholdMembership` auto-join. That patch must not land.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
    - [ ] PR-1 is first. Branch from `main`.
    - [ ] PR-2 after PR-1.
    - [ ] PR-3 after PR-2.
    - [ ] PR-4 after PR-3.
- [ ] Hold the file boundaries. PR-1 deletes Google login, then closes email signup and adds create-household. It touches `src/oauth.ts`, `src/supabase.ts`, login copy and `scripts/gen-login.ts`, `.env.example`, `README.md`, `docs/google-auth-setup.md`, dashboard create-household, household create helper, a new migration that also revokes `bootstrap_household` from `authenticated`, and the tests for those. PR-2 touches `src/mcp.ts` household admin tools, owner checks in `src/household.ts`, `README.md` rotate copy, and tests. PR-2 does not add a SQL migration. PR-3 touches the site dashboard add-member form, `src/dashboard.test.ts`, and `authenticated dashboard HTTP` in `src/mcp.test.ts`. PR-4 replaces join-as-member `bootstrapHousehold` and the SQL function body.
- [ ] Hold the review gate. PR-1, PR-2, and PR-3 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, with `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on. Commands are `bun run typecheck`, `bun test`, `bun run format:check`, and `bun run gen:all` after login copy edits.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `pstack/skills/poteto-mode/references/bugbot-triage.md`. If `git show origin/main` misses that path, read it from the Cursor pstack plugin cache.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. One audit lane that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh swarm and a fresh verdict.
- [ ] The root appends the PR to the base-branch stack. The operator lands it bottom-up. Patch-id must match the verdict SHA per `pstack/skills/poteto-mode/playbooks/shipping.md`.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive the site through `control-ui`. Drive MCP through `curl` POST to `/mcp`.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Copy `.env.example` to `.env` with a dedicated Supabase project. Run `bun run gen:all && bun src/index.ts`. Wait until `GET /health` returns `ok`.
- [ ] Deliver site input only through `control-ui`. Deliver MCP only as HTTP POST to `/mcp` with a Bearer token. Read-only diagnostics are `GET /health` and the JSON-RPC error body.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Remove Google, close signup, and create the household (PR-1)

**Depends on.** None. Branch from `main`.

**Files.**

- [ ] Delete Google login first. Remove `GET /authorize/google` and `GET /auth/google/callback` from `src/oauth.ts` and from `OAUTH_PATHS`. Remove `googleNonce` from the session type.
- [ ] Delete `signInWithGoogleIdToken` from `src/supabase.ts`.
- [ ] Edit `src/copy/login.ts` and locale files. Delete `googleButton`, `googleCancelled`, and `googleFailed`. Drop the automatic-account `newHereNote` after a user exists. Keep a sign-in-only note.
- [ ] Edit `scripts/gen-login.ts`. Delete the Continue with Google control. Run `bun run gen:all`.
- [ ] Delete `docs/google-auth-setup.md`. Remove `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from `.env.example` and from `README.md`.
- [ ] Edit `src/oauth.ts` `/approve`. Count Auth users through a service-role helper before `signUpUser`. Allow `signUpUser` only when that count is zero. After the first user exists, `/approve` calls only `signInUser`. A wrong password must not fall through to signup. Do not add a join helper on this path. Login on trunk has no auto-join.
- [ ] Edit `src/dashboard.ts`. Trunk returns `forbiddenDashboardHtml` when `getHouseholdMembership` is null. If the cookie user has no membership and no household exists, show a create-household form instead of that 403. If a household exists and the user is not a member, keep the 403 empty state.
- [ ] Edit `src/household.ts`. Add `createHousehold` that inserts the singleton household and the caller as owner in one step, and fails if a household already exists. Leave `bootstrapHousehold` in this PR. PR-4 deletes the join-as-member behavior.
- [ ] Edit `src/supabase.ts`. Add a service-role call that creates the household plus the owner in one transaction. Add `authUserCount` via `auth.admin.listUsers` with `perPage` 1. Do not insert a member when a household already exists. Do not add `ensureHouseholdMembership`.
- [ ] Create `supabase/migrations/YYYYMMDDHHMMSS_create_household.sql` with `supabase migration new create_household`. The function takes the caller user id, household name, and display name. It runs in one transaction. The same migration `REVOKE`s execute on `public.bootstrap_household` from `authenticated`.
- [ ] Edit `src/oauth.test.ts`, `src/alt-pages.test.ts`, `src/dashboard.test.ts`, `src/household.test.ts`, `src/mcp.test.ts`, and `src/public-site.test.ts`. Drop the Google href pin and the nonce-for-Google test.
- [ ] Do not gate `POST /register`. That path is MCP client registration. Do not remove Google Fonts or the gtag CSP hosts. Those are not signup.

**Build.**

- [ ] Delete Google signup and Google sign-in from login. Do not keep a gated Google create path.
- [ ] Do not add join-as-member on login or on `GET /`. Login on trunk has no auto-join. SQL `bootstrap_household` and `bootstrapHousehold` still join as member until later PRs. Discard any local uncommitted `ensureHouseholdMembership` patch.
- [ ] Add `create_household` RPC and the site form that calls it for the first Auth user.
- [ ] Reject public `signUpUser` once any Auth user exists. Sign-in of existing email users stays.
- [ ] `authenticated` cannot execute `bootstrap_household`.

**You see.**

- [ ] Login HTML has email and password only. There is no Continue with Google control.
- [ ] First visit to `/` still shows login. After the first signup, a create-household form appears instead of widgets.
- [ ] After create, the dashboard shows the owner display name and one household.
- [ ] A second email on `/approve` does not create an Auth user and does not insert `household_members`.
- [ ] `GET /authorize/google` and `GET /auth/google/callback` are 404, not `google_not_configured`.
- [ ] Log line for the refused signup names `signup_closed` or the same error string the page shows.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/oauth.test.ts` gains a case that a second signup is refused, including a wrong-password sign-in that must not create a user.
- [ ] `src/oauth.test.ts` and `src/alt-pages.test.ts` no longer expect `/authorize/google`, `googleButton`, or `OAUTH_PATHS` Google routes.
- [ ] `src/household.test.ts` gains a case that a second `createHousehold` fails.
- [ ] `src/mcp.test.ts` `authenticated dashboard HTTP` gains a case that a non-member sees 403 when a household already exists. Do not add an auto-join mock as the spec. Run `bun test src/oauth.test.ts src/alt-pages.test.ts src/household.test.ts src/dashboard.test.ts src/mcp.test.ts src/public-site.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run a second email through `/approve` at trunk and at head. Trunk signs that email up. Record that. Gate that head refuses signup and writes no `household_members` row. Save `pr1-l1-regression.png`. Pass when head is refused and trunk is recorded.
- [ ] Lane 2. Empty project. Register the first email at `/`. Save `pr1-l2-first-signup.png`. Pass when login succeeds and the create-household form is visible.
- [ ] Lane 3. Submit create-household with a name and a display name. Save `pr1-l3-created.png`. Pass when the dashboard shows that display name as owner.
- [ ] Lane 4. Open `/` in a fresh profile after the household exists. Save `pr1-l4-login-only.png`. Pass when the page is sign-in, has no Continue with Google control, and does not promise automatic account creation.
- [ ] Lane 5. POST `/approve` with a new email after the first user exists. Save `pr1-l5-second-signup.png`. Pass when status is 400 and Auth user count stays 1.
- [ ] Lane 6. Sign in as the founder again. Save `pr1-l6-signin.png`. Pass when the dashboard loads without a second household row.
- [ ] Lane 7. Call `create_household` a second time as the founder. Save `pr1-l7-second-create.png`. Pass when the call fails and `households` still has one row.
- [ ] Lane 8. MCP OAuth for a new client_id after the household exists, with a new email. Save `pr1-l8-mcp-signup.png`. Pass when signup is refused and no member row appears.
- [ ] Lane 9. Authenticated PostgREST RPC `bootstrap_household` with a user JWT after create-household. Save `pr1-l9-bootstrap.png`. Pass when execute is revoked or the call does not insert a member.
- [ ] Lane 10. `GET /authorize/google` and `GET /auth/google/callback` at head, with and without `GOOGLE_*` set. Save `pr1-l10-google-gone.png`. Pass when both routes are 404.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time in milliseconds of POST `/approve` for a second email, plus time until the founder dashboard HTML is complete after create-household.
- [ ] Probe. Three interleaved curls of that `/approve` at trunk and at head, then three create-household posts at head only.
- [ ] Baseline. Record the trunk `/approve` times first.
- [ ] Rule. Head `/approve` p95 stays under 2000 ms. Create-household plus dashboard HTML stays under 3000 ms. Do not ratio unlike trunk and head signup outcomes.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, lane 4, and lane 5 screenshots into `docs/handoff/media/pr1-review-signup.png`, `docs/handoff/media/pr1-review-login-only.png`, and `docs/handoff/media/pr1-review-closed.png`.
- [ ] Record a 30 to 60 second video of first signup, create-household, and a refused second signup. Show that login has no Google control. Save it as `docs/handoff/media/pr1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends the PR to the base-branch stack. The operator lands it bottom-up.

## Restrict household admin to the owner (PR-2)

**Depends on.** PR-1.

**Files.**

- [ ] Edit `src/household.ts`. Add `requireOwner` that returns `not_a_member` or a typed not-owner error.
- [ ] Edit `src/mcp.ts`. `rotate_household_token` and `add_household_member` require `requireOwner` for OAuth callers. A household PAT may still call them because the token is the household bot.
- [ ] Edit `src/mcp.ts` household config writes (`update_household_config`, `update_fridge_locations`) the same way.
- [ ] Do not add an `owner_admin.sql` migration. Caller checks live in MCP because `add_household_member` execute is already `service_role` only.
- [ ] Edit `src/household.test.ts` and `src/mcp.test.ts` so a member cannot rotate or add.
- [ ] Edit `README.md`. Owner-only rotate and add. Drop the "Any member may rotate" line.

**Build.**

- [ ] Owner OAuth can add a member and rotate the token.
- [ ] Member OAuth cannot.

**You see.**

- [ ] `add_household_member` as the owner returns a new `user_id`.
- [ ] The same tool as a member returns an error that names the owner requirement.
- [ ] `rotate_household_token` as a member is refused. As the owner it returns an `nt_hh_` token once.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/household.test.ts` gains `requireOwner` cases.
- [ ] `src/mcp.test.ts` changes `any member may rotate` under `rotate_household_token from member OAuth` to owner-only, and adds a member-refused case for `add_household_member`. Run `bun test src/household.test.ts src/mcp.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Call `rotate_household_token` as member OAuth at trunk and at head. Trunk allows it. Record that. Gate that head refuses. Save `pr2-l1-regression.png`. Pass when head is refused.
- [ ] Lane 2. Owner calls `add_household_member` with a username and password. Save `pr2-l2-owner-add.png`. Pass when the result has `user_id` and `role` member.
- [ ] Lane 3. Member OAuth calls `add_household_member`. Save `pr2-l3-member-add.png`. Pass when status is an error and Auth user count is unchanged.
- [ ] Lane 4. Owner calls `rotate_household_token`. Save `pr2-l4-owner-rotate.png`. Pass when the plaintext `nt_hh_` token appears once.
- [ ] Lane 5. Member calls `rotate_household_token`. Save `pr2-l5-member-rotate.png`. Pass when the call is refused.
- [ ] Lane 6. Household PAT calls `add_household_member`. Save `pr2-l6-pat-add.png`. Pass when a member is created.
- [ ] Lane 7. Member calls `list_members`. Save `pr2-l7-member-list.png`. Pass when the list still works.
- [ ] Lane 8. Member calls `update_household_config`. Save `pr2-l8-member-config.png`. Pass when the write is refused.
- [ ] Lane 9. Owner calls `update_fridge_locations`. Save `pr2-l9-owner-config.png`. Pass when the locations update.
- [ ] Lane 10. Added member signs in at `/`. Save `pr2-l10-member-signin.png`. Pass when the dashboard loads and no public signup occurred.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time in milliseconds of `rotate_household_token` as owner at trunk and at head.
- [ ] Probe. Three interleaved tool calls at trunk and at head.
- [ ] Baseline. Record the trunk times first.
- [ ] Rule. Head p95 stays under 2x trunk. If trunk lacks owner checks, head stays under 1500 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, lane 3, and lane 5 screenshots into `docs/handoff/media/pr2-review-owner-add.png`, `docs/handoff/media/pr2-review-member-add.png`, and `docs/handoff/media/pr2-review-member-rotate.png`.
- [ ] Record a 30 to 60 second video of owner add, member refuse, and owner rotate. Save it as `docs/handoff/media/pr2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends the PR to the base-branch stack. The operator lands it bottom-up.

## Add household members from the site (PR-3)

**Depends on.** PR-2.

**Files.**

- [ ] Edit `src/dashboard.ts`. Owner self view gains a form for `display_name`, password, and either email or username. POST to a site route that calls `addHouseholdMemberForHousehold`.
- [ ] Edit `src/index.ts` or `src/oauth.ts` only if a new POST path is required. Keep it on the site cookie, not public.
- [ ] Edit `src/dashboard.test.ts` and the `authenticated dashboard HTTP` describe in `src/mcp.test.ts`.
- [ ] Do not add a public register path.

**Build.**

- [ ] The owner can add a member from `/` without MCP.
- [ ] A member who loads `/` does not see the form.

**You see.**

- [ ] Owner submits the form and the member switcher gains the new display name.
- [ ] Member view has no add form.
- [ ] A bad password under 8 characters stays on the page with the existing parse error string.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/dashboard.test.ts` gains owner-form and member-hidden cases.
- [ ] Site HTTP tests post the form as owner and as member in `src/mcp.test.ts` `authenticated dashboard HTTP`. Run `bun test src/dashboard.test.ts src/mcp.test.ts`. Do not add a second `mock.module` of `./supabase.js`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Load owner `/` at trunk and at head. If trunk has no form, record that. Gate that head shows the add form for the owner. Save `pr3-l1-regression.png`. Pass when head shows the form.
- [ ] Lane 2. Owner adds a member with username `kid` and a valid password. Save `pr3-l2-add-username.png`. Pass when the switcher lists that display name.
- [ ] Lane 3. Sign in as that member. Save `pr3-l3-member-login.png`. Pass when the dashboard loads.
- [ ] Lane 4. That member's `/` has no add form. Save `pr3-l4-member-no-form.png`. Pass when no add form is in the HTML.
- [ ] Lane 5. Owner adds a member with an email. Save `pr3-l5-add-email.png`. Pass when `list_members` includes that display name.
- [ ] Lane 6. Duplicate username. Save `pr3-l6-duplicate.png`. Pass when the page shows that login is already in use.
- [ ] Lane 7. Password shorter than 8. Save `pr3-l7-short-password.png`. Pass when no Auth user is created.
- [ ] Lane 8. Logged-out POST of the add form. Save `pr3-l8-logged-out.png`. Pass when the request does not add a member.
- [ ] Lane 9. Owner `?member=` peer view has no add form. Save `pr3-l9-peer.png`. Pass when the peer note is visible and the form is not.
- [ ] Lane 10. MCP `list_members` after two site adds. Save `pr3-l10-list.png`. Pass when both new members appear.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time in milliseconds of owner `GET /` at trunk and at head, plus time of the site add POST at head.
- [ ] Probe. Three interleaved `GET /` at trunk and at head, then three add POSTs at head.
- [ ] Baseline. Record trunk `GET /` first.
- [ ] Rule. Head `GET /` p95 stays under 2x trunk. Add POST plus redirect stays under 3000 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, lane 4, and lane 6 screenshots into `docs/handoff/media/pr3-review-add.png`, `docs/handoff/media/pr3-review-hidden.png`, and `docs/handoff/media/pr3-review-duplicate.png`.
- [ ] Record a 30 to 60 second video of owner add and member login. Save it as `docs/handoff/media/pr3-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends the PR to the base-branch stack. The operator lands it bottom-up.

## Delete the join-as-member bootstrap (PR-4)

**Depends on.** PR-3.

**Files.**

- [ ] Create `supabase/migrations/YYYYMMDDHHMMSS_drop_bootstrap_join.sql`. Replace `bootstrap_household` so a second caller gets an error instead of a member row. Keep execute revoked from `authenticated`.
- [ ] Edit `src/household.ts`. Delete or rewrite `bootstrapHousehold` so tests use `createHousehold` plus `addHouseholdMember` instead of silent join.
- [ ] Delete leftover `ensureHouseholdMembership` if any call site remains.
- [ ] Edit `src/household.test.ts` so the old "second user bootstrap joins as member" case is gone.

**Build.**

- [ ] No remaining path inserts a household member from public signup or from `bootstrap_household`.
- [ ] One create function and one add-member function remain.

**You see.**

- [ ] `SELECT proname FROM pg_proc WHERE proname = 'bootstrap_household'` still exists only if it errors on a second caller.
- [ ] `household.test.ts` has no join-as-member bootstrap case.
- [ ] `grep` for `ensureHouseholdMembership` returns no production call.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/household.test.ts` covers create-then-refuse-second and add-member.
- [ ] `bun test src/household.test.ts src/oauth.test.ts src/mcp.test.ts` stays green.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Call `bootstrap_household` as a second JWT at trunk and at head. If trunk joins, record that. Gate that head errors. Save `pr4-l1-regression.png`. Pass when head does not insert a member.
- [ ] Lane 2. Founder create-household still works. Save `pr4-l2-create.png`. Pass when one owner exists.
- [ ] Lane 3. Owner adds a member from the site. Save `pr4-l3-add.png`. Pass when the member can sign in.
- [ ] Lane 4. Public second signup still refused. Save `pr4-l4-signup.png`. Pass when Auth user count does not rise.
- [ ] Lane 5. Authenticated PostgREST RPC `bootstrap_household` with the anon key and a user JWT. Save `pr4-l5-rpc.png`. Pass when execute is revoked or the call errors.
- [ ] Lane 6. `list_members` as owner. Save `pr4-l6-list.png`. Pass when only owner-added people appear.
- [ ] Lane 7. Member still cannot rotate. Save `pr4-l7-rotate.png`. Pass when refused.
- [ ] Lane 8. `GET /health`. Save `pr4-l8-health.png`. Pass when `ok`.
- [ ] Lane 9. Owner dashboard after the migration. Save `pr4-l9-dashboard.png`. Pass when widgets render.
- [ ] Lane 10. `grep` on the head tree for `joinHousehold` and `ensureHouseholdMembership`. Save `pr4-l10-grep.png`. Pass when no production join-as-member helper remains.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time in milliseconds of founder `GET /` at trunk and at head.
- [ ] Probe. Three interleaved `GET /` at trunk and at head.
- [ ] Baseline. Record trunk first.
- [ ] Rule. Head p95 stays under 2x trunk.

**Review gate.** None. PR-4 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends the PR to the base-branch stack. The operator lands it bottom-up.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

No prototype branch. Product calls were settled in chat. The remaining unproven item is the exact create-household field copy. Google signup is deleted in PR-1, not gated.

## Appendix B. Alternatives rejected

Auto-join on login lost because a public URL would enroll strangers. Closing registration only after a household row exists lost because two people could register before either created the household. Invite tokens lost because the owner already creates Auth users through `add_household_member`. Gated Google signup lost because a refuse-new-accounts branch still leaves a public identity provider on the login page. Autopilot-full lost because the operator wants to land the stack.

## Appendix C. Risks

PR-1 without PR-2 still lets a later member add people through MCP until PR-2 lands. Watch that the operator lands PR-2 next. A dedicated Supabase project is required for live lanes so production Auth users are not used. Trunk `GET /` is 403 until create-household exists. Local uncommitted auto-join on the operator machine will fight PR-1. Discard it.

`/approve` on trunk signs up on any sign-in throw, including a wrong password. PR-1 must call `signUpUser` only when Auth is empty. `signInWithGoogleIdToken` provisions new users on trunk. Delete that function and the Google routes in the same PR. Do not keep sign-in-only Google. Nobody in this household is created through Google. `POST /register` is MCP client registration. Do not gate it.

SQL `bootstrap_household` is granted to `authenticated` on trunk and joins as member. PR-1 revokes that grant. PR-4 removes the join body. Login on trunk has no auto-join. The TS helper `bootstrapHousehold` still joins as member until PR-4.

This repo has no `pstack/` tree. Tick re-reads use the plugin cache. Record that each tick. `check-plan.mjs` requires the live-lane slug `grok-4.6-fast-xhigh`. Swarm workers still run as `cursor-grok-4.6-high` per `/setup-pstack`.

Login password UI is `minlength=6`. `addHouseholdMember` requires 8. Keep those as they are unless a live lane proves the first-user form should match.

## Appendix D. Links and reading list

Read `src/oauth.ts`, `src/copy/login.ts`, `scripts/gen-login.ts`, `docs/google-auth-setup.md`, `src/dashboard.ts`, `src/household.ts`, `src/mcp.ts`, `src/supabase.ts`, and `supabase/migrations/20260919*.sql` before editing. PR-1 and PR-2 get `pstack/skills/how/SKILL.md` and `pstack/skills/interrogate/SKILL.md` before merge-ready. Keep a local `decisions.tsv` per `pstack/skills/show-me-your-work/SKILL.md`. Do not commit the trail.

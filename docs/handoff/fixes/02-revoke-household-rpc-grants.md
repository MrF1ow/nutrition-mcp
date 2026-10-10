# Fix 2: Revoke client roles from household RPCs

Status: implemented on branch (pending live apply).

Source: deployment audit, 2026-10-07. Severity: **high**. Should be in the database before the deploy goes public.

## Problem

`add_household_member(uuid, uuid, text)` is `SECURITY DEFINER` and inserts a `household_members` row for any household and any Auth user it is given. Its migration (`20260919150000_add_household_member.sql`) only ran `revoke all ... from public`. That does not remove the **explicit** `EXECUTE` grants `anon` and `authenticated` get from the schema's default privileges (`20260417044712_remote_schema.sql`, `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO "anon"`, and the same for `authenticated`).

The audit verified this on a local build of all 39 migrations (`bun run db:dryrun --keep`, then querying `has_function_privilege`):

| function                      | anon | authenticated | security definer |
| ----------------------------- | ---- | ------------- | ---------------- |
| `add_household_member`        | t    | t             | t                |
| `bootstrap_household`         | t    | f             | t                |
| `create_household`            | f    | f             | t                |
| `household_mcp_token_hash`    | f    | f             | t                |
| `resolve_household_mcp_token` | f    | f             | t                |
| `rotate_household_mcp_token`  | f    | f             | t                |

The 2026-10-06 handoff says the live project matches a clean build of these files. Hosted Supabase is, if anything, more permissive by default, so treat the live project as affected.

Impact: anyone holding the project's anon key can call `POST /rest/v1/rpc/add_household_member` through PostgREST. If they also obtain an Auth user id (email sign-up is still enabled) and the household UUID, they can add themselves to the household. `bootstrap_household` only reads membership for `auth.uid()`, so it is harmless, but `anon` should not be able to call it either.

The server only calls these functions with the service role (`src/db/household.ts`), so nothing legitimate depends on the client-role grants.

## Changes

### 1. New migration

`supabase/migrations/20261010120000_revoke_household_rpc_client_grants.sql`. Pick any timestamp later than the newest file in the folder at implementation time, and do not edit any applied migration.

```sql
-- add_household_member and bootstrap_household only ran `revoke ... from public`,
-- which does not remove the explicit EXECUTE that the schema's default
-- privileges grant to anon and authenticated. The server calls both with the
-- service role only.
revoke execute on function public.add_household_member(uuid, uuid, text) from anon, authenticated;
revoke execute on function public.bootstrap_household(text, text) from anon, authenticated;
```

It must be idempotent (a revoke already is) and safe to re-run.

### 2. Stop new functions from inheriting the grant

Add to the same migration:

```sql
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
```

Check first whether this breaks anything. Run `grep -rn "\.rpc(" src/` and confirm every RPC the server calls goes through `getSupabase()` (the service role). If any client-role call exists, stop and report it rather than shipping this line. Table default privileges are deliberately not touched: those tables rely on RLS policies, and changing table grants is a separate review.

### 3. Assert it in the dry run

Add to the end of `scripts/migration-dryrun/check.sql`, inside the `do $$` block or as a second one:

```sql
if has_function_privilege('anon', 'public.add_household_member(uuid,uuid,text)', 'execute')
   or has_function_privilege('authenticated', 'public.add_household_member(uuid,uuid,text)', 'execute')
   or has_function_privilege('anon', 'public.bootstrap_household(text,text)', 'execute') then
    raise exception 'household RPCs are still executable by client roles';
end if;
-- And every security-definer function in public is closed to anon:
if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
) then
    raise exception 'a security definer function in public is executable by anon';
end if;
```

The second check is the regression guard: a future `SECURITY DEFINER` function that forgets to revoke `anon` fails the dry run.

Note: `check.sql` only runs in fixture mode. Do not move `DEFAULT_PENDING_FROM`. The new migration runs as a pending one on top of the fixture automatically.

## Applying to the live project

1. Merge the PR with CI green.
2. `PG_BIN=<postgres bin>/ bun run db:dryrun`. It must pass and print `fixture expectations: ok`.
3. `bunx supabase db push --dry-run` must list exactly this one migration. Then run `bunx supabase db push`.
4. Verify in the Supabase SQL editor:

    ```sql
    select p.proname,
           has_function_privilege('anon', p.oid, 'execute') as anon,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef order by 1;
    ```

    Every row should be `f`/`f`.

5. Smoke test: as the owner, add a member at **Settings → Household**. It must still work, because that path uses the service role.

## Also do (dashboard, not code)

After the owner account exists, go to Supabase **Authentication → Sign In / Providers → "Allow new users to sign up" → off**. Members are created with `auth.admin.createUser` (`src/db/household.ts`), which ignores that toggle. The owner's own first sign-up uses `auth.signUp` (`src/db/client.ts`), so flip the toggle **after** the owner signs up. Fix 4 documents this in the deploy checklist.

## Out of scope

- Table grants for `anon` (RLS covers them today), and token hashing.
- OAuth (Fix 1), MCP tools (Fix 3), and deploy hardening (Fix 4).

## Done when

- [x] `bun run db:dryrun` passes locally with the new assertions, and fails if you temporarily comment out the revoke. Try that once, then restore it.
- [x] `bun test`, `bun run typecheck` and `bun run format:check` are green.
- [ ] Applied to `dapbxswqfiqvxutsobhr`, with the verification query output pasted in the PR. (not done: live Supabase deploy is owner-only per plan)

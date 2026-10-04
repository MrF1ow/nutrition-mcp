# Self-hosting Foodable

Foodable is a single-household deploy. It is not a public hosted service. You run the Bun server yourself and point it at a Supabase project.

Clone [https://github.com/MrF1ow/nutrition-mcp](https://github.com/MrF1ow/nutrition-mcp), copy `.env.example` to `.env`, fill in the values below, push the migrations, and start the server.

```bash
git clone https://github.com/MrF1ow/nutrition-mcp.git
cd nutrition-mcp
bun install
cp .env.example .env
bun run generate-oauth-creds   # paste into .env
bun src/index.ts               # http://localhost:8080
```

`GET /health` returns `ok` when the process is up.

## Supabase: cloud first

Use [Supabase cloud](https://supabase.com) unless you already run Postgres yourself.

1. Create a project in the Supabase dashboard.
2. Copy the project URL into `SUPABASE_URL` (`https://<ref>.supabase.co`).
3. Copy the **service role** secret into `SUPABASE_SECRET_KEY`. The server uses the service role for Auth admin, household RPCs, and the rest of the data plane. The publishable/anon key is not enough.
4. Link the CLI and push every file in `supabase/migrations/`:

```bash
supabase link --project-ref <ref>
supabase db push
```

Do not skip migrations. Schema lives only in those files. `supabase db push` applies them in order to the linked project.

Auth must allow email and password. Foodable has no Google login. Confirm email can stay off for a household deploy so the first sign-up can sign in immediately; if you leave it on, the first user has to confirm before `/approve` succeeds.

## Self-hosted Supabase

Self-hosted Supabase is the other option, not the default. The app speaks the same PostgREST and GoTrue APIs, so the env vars do not change:

- `SUPABASE_URL` is the API origin of _your_ instance (the Kong/API gateway, not the Studio URL).
- `SUPABASE_SECRET_KEY` is that instance's service role JWT.

Install the Supabase CLI, point it at the self-hosted project, and run the same `supabase db push` against `supabase/migrations/`. You are responsible for Auth (email+password), storage (the `exports` bucket from the migrations), and keeping the instance reachable from the Foodable process.

A self-hosted instance that only exposes the database, without GoTrue and PostgREST, will not work. Sign-up, sign-in, and the household RPCs all go through the Supabase API.

## Environment variables

| Variable              | Required     | Purpose                                                            |
| --------------------- | ------------ | ------------------------------------------------------------------ |
| `SUPABASE_URL`        | yes          | Supabase API origin (cloud or self-hosted)                         |
| `SUPABASE_SECRET_KEY` | yes          | Service role secret                                                |
| `OAUTH_CLIENT_ID`     | yes          | MCP OAuth client id (`bun run generate-oauth-creds`)               |
| `OAUTH_CLIENT_SECRET` | yes          | MCP OAuth client secret, also the site-session HMAC                |
| `OFF_USER_AGENT`      | for barcodes | Open Food Facts User-Agent, `Foodable (you@example.com)`           |
| `PORT`                | no           | Listen port, default `8080`                                        |
| `PUBLIC_ORIGIN`       | production   | Canonical public origin, `https://foodable.example.com`            |
| `ALLOWED_ORIGINS`     | no           | Extra CORS origins, comma-separated. Localhost is already allowed. |

`PUBLIC_ORIGIN` is how the server stays host-agnostic. When it is set, `getBaseUrl` in `src/url.ts` returns that origin and **ignores** `X-Forwarded-Host` / `X-Forwarded-Proto`. OAuth metadata (`/.well-known/oauth-authorization-server`), the `/authorize` URLs inside it, the 401 `resource_metadata` challenge, and the MCP icon URL all stay on your origin even if a client sends a different forwarded host.

Leave `PUBLIC_ORIGIN` unset on a laptop. Then the request `Host` and `X-Forwarded-*` still win, which is what local dev and a trusted reverse proxy in front of localhost need.

## Reverse proxy

Terminate TLS in front of the container or `bun` process. Set `PUBLIC_ORIGIN` to the origin clients actually type, then still pass forwarding headers for client IP (rate limits) and `X-Forwarded-Proto` (the Secure cookie flag). nginx:

```nginx
server {
    listen 443 ssl;
    server_name foodable.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

With `PUBLIC_ORIGIN=https://foodable.example.com` the advertised OAuth `/authorize` base URL stays that origin even if a request forges `X-Forwarded-Host`. Docker is `Dockerfile` in the repo root (`bun --smol src/index.ts` on port 8080).

## First-user flow

This is the closed-household lifecycle already in the tree (`docs/handoff/closed-household-plan.md`). One deploy, one Supabase project, one household.

1. Open the site at `/` (or complete MCP OAuth at `/authorize`). There is no Google button. The first visit, while Auth is empty, is email and password.
2. That first successful `/approve` **signs up** the first Auth user. After any Auth user exists, `/approve` only signs in. A second email is refused (`signup_closed`); a wrong password does not fall through to sign-up.
3. The first user is not in a household yet. `/` shows **Create household** (household name and your name) instead of the app. Submit it. That RPC creates the singleton household and the caller as **owner**. A second create fails.
4. Later people exist only when the owner adds them. The owner uses **Settings → Household** (`/settings/household`) or the MCP tool `add_household_member` (email or username plus password). Members sign in with those credentials. They cannot rotate the household token or add people.
5. Public registration stays closed. There is no invite link, no Google identity provider, and no auto-join if someone finds the URL. `POST /register` is MCP client registration, not a user sign-up path.

Connect an agent at `https://your-host/mcp` with the household account.

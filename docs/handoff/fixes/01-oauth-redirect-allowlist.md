# Fix 1: OAuth redirect allow-list and required PKCE

Status: plan only. An implementation agent completes this branch and takes the PR out of draft.

Source: deployment audit, 2026-10-07. Severity: **critical**. Blocks putting the deploy on a public URL.

## Problem

`src/oauth.ts` lets anyone mint a one-year bearer token for a household member who clicks a link:

1. `POST /register` hands every caller the deploy's single `OAUTH_CLIENT_ID` **and** `OAUTH_CLIENT_SECRET`.
2. `GET /authorize` accepts any `redirect_uri`. Nothing checks it against a list.
3. `GET /authorize` does not require `code_challenge`, so PKCE is optional. `code_challenge_method` is never read.

Attack: send a member `https://<host>/authorize?response_type=code&client_id=<public id>&redirect_uri=https://evil.example/cb&state=x&code_challenge=<attacker's>`. The member sees the real Foodable sign-in page and signs in. The code is redirected to `evil.example`, and the attacker redeems it at `/token` with their own verifier. They now hold a 365-day access token plus a refresh token.

## Decisions (already made by the owner)

- Token lifetimes stay as they are: access and refresh tokens last 365 days. Do **not** shorten them.
- Do not hash the stored OAuth tokens in this PR. That is out of scope.
- Supported clients: Claude.ai and Claude.com connectors, ChatGPT connectors, Claude Code, and other local MCP clients on loopback.

## Changes

### 1. Redirect URI allow-list (new pure module)

Create `src/oauth-redirect.ts` with no Hono or Supabase imports, plus `src/oauth-redirect.test.ts`.

```ts
export function isAllowedRedirectUri(raw: string, extra: string[]): boolean;
export function extraRedirectUris(env = process.env): string[]; // parses ALLOWED_REDIRECT_URIS
```

Allowed:

| Pattern                                                 | Match rule                                                                         | Why                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `https://claude.ai/api/mcp/auth_callback`               | exact                                                                              | Claude web connector                                                                                                |
| `https://claude.com/api/mcp/auth_callback`              | exact                                                                              | Claude starts OAuth from either domain. Registering only one breaks a subset of users                               |
| `https://chatgpt.com/connector/oauth/<id>`              | `https:`, host exactly `chatgpt.com`, path starts `/connector/oauth/`, one segment | Current ChatGPT callback                                                                                            |
| `https://chatgpt.com/connector_platform_oauth_redirect` | exact                                                                              | Legacy ChatGPT callback, still honored                                                                              |
| `http://localhost:<any port>/<any path>`                | scheme `http`, host `localhost`, `127.0.0.1` or `[::1]`                            | RFC 8252 loopback redirects (Claude Code, MCP Inspector, local agents). Ports are ephemeral, so any port is allowed |
| each entry of `ALLOWED_REDIRECT_URIS`                   | exact string match after `new URL(...).href` normalization                         | Escape hatch for a self-hosted bot with its own callback                                                            |

Rules:

- Parse with `new URL()`. A parse failure means not allowed.
- Reject any URI with a fragment (`#`), and any URI with userinfo (`user:pass@`).
- Compare hosts with `URL.hostname`, never with substring or regex on the raw string. `https://claude.ai.evil.com/...` and `https://evil.com/?x=https://claude.ai/api/mcp/auth_callback` must both be rejected. Write tests for both.
- Query strings are allowed on loopback only.

Sources for the callback URLs:

- Claude: https://claude.com/docs/connectors/building/authentication
- ChatGPT: https://developers.openai.com/apps-sdk/build/auth

Re-check both pages when you implement this, in case the callbacks changed.

### 2. `/authorize`

In `oauth.get("/authorize")`, after the existing required-param checks:

- If `!isAllowedRedirectUri(redirectUri, extra)`, respond `400 { error: "invalid_request", error_description: "redirect_uri is not allowed" }`. Do **not** redirect to it. An unvalidated redirect target must never receive a redirect, not even an error one.
- Require `code_challenge`. A missing one gets `400 invalid_request` with `"code_challenge is required"`.
- Require `code_challenge_method === "S256"`. If it is absent, also respond 400: OAuth 2.1 defaults to `plain`, and we only advertise `S256` (`code_challenge_methods_supported` in `src/discovery.ts`).
- Validate the challenge's shape: 43 to 128 characters from `[A-Za-z0-9-._~]`.

### 3. `/token`

- `authorization_code` grant: require `redirect_uri` and require an exact match with the stored one. Today the check is skipped when the field is absent (`if (redirectUri && ...)`).
- `authorization_code` grant: always require `code_verifier`. Every code now carries a challenge. Keep the old `if (authCodeData.code_challenge)` branch from silently skipping: if a stored code somehow lacks a challenge, reject it.
- Keep the client-secret behavior: a wrong secret is still `401 invalid_client`, and a missing secret is fine (public client).

### 4. `/register`

- Validate `body.redirect_uris`. It must be a non-empty array, and every entry must pass `isAllowedRedirectUri`. Otherwise respond `400 { error: "invalid_redirect_uri" }` (RFC 7591 §3.2.2).
- Guard `await c.req.json()` with a try/catch. A malformed body is `400 invalid_client_metadata`, not a 500.
- Respond with `client_id` only, plus `token_endpoint_auth_method: "none"` and the echoed `redirect_uris`. **Do not return `client_secret`.**
- `registerClient(...)` persistence stays as is.

### 5. Discovery metadata

`src/discovery.ts` `authorizationServerMetadata`: keep `token_endpoint_auth_methods_supported: ["none", "client_secret_post"]`. Nothing else changes. Do not advertise `client_id_metadata_document_supported`. CIMD client IDs (URLs) would fail the `reqClientId !== clientId` check, and supporting them is a separate piece of work.

### 6. Login page context (small, user-visible)

`renderLoginPage` currently gives the user no hint of where the code is going. For `purpose: "mcp"` sessions, pass the redirect host and render one line above the form: "Signing in to connect **claude.ai**". Use the hostname only, HTML-escaped. Copy belongs in `src/copy/login.ts`. Run `bun run gen:all` after editing copy or `scripts/site-partials.ts`. Skip this step if it fights the template. It is defense in depth, not the fix.

### 7. Config and docs

- `.env.example`: add a commented `# ALLOWED_REDIRECT_URIS=` with a one-line explanation.
- `docs/self-hosting.md`: add `ALLOWED_REDIRECT_URIS` to **both** env tables, and add a short "Which AI clients can connect" note listing the built-in callbacks.

## Tests (`src/oauth.test.ts`, `src/oauth-redirect.test.ts`)

- Each allowed pattern passes. Lookalikes fail: `claude.ai.evil.com`, `evilclaude.ai`, `https://claude.ai/api/mcp/auth_callback/../x`, `http://claude.ai/...` (http), `http://localhost.evil.com`, `javascript:`, fragment-bearing URIs, and userinfo URIs.
- `/authorize` with an evil `redirect_uri` returns 400 and **no `Location` header**.
- `/authorize` without `code_challenge`, or with `code_challenge_method=plain`, returns 400.
- `/register` responds with no `client_secret` key at all (`expect(body).not.toHaveProperty("client_secret")`).
- `/register` with a disallowed `redirect_uris` entry returns 400 `invalid_redirect_uri`.
- `/token` without `redirect_uri`, or without `code_verifier`, returns 400. This needs the `consumeAuthCode` stub; follow the existing mock pattern in `oauth.test.ts`, and see the `mock.module` rules in `CLAUDE.md` before adding a mock.
- The existing site-login flow (`beginSiteLogin`, `purpose: "site"`) is untouched. It never takes a redirect URI from the request. Assert it still works.

## Out of scope

- Shortening token TTLs, hashing tokens, and a token revocation UI.
- CIMD support.
- The DB privilege fix (Fix 2), removing the MCP admin tools (Fix 3), and `SESSION_SECRET` (Fix 4).

## Conflicts with sibling PRs

Fix 4 also edits `.env.example` and the env tables in `docs/self-hosting.md`. Whichever merges second rebases and keeps both rows.

## Done when

- [x] `bun test`, `bun run typecheck` and `bun run format:check` are green. Also run `bun run gen:all` if the login copy changed.
- [x] Manual: with the local server, `curl -i '/authorize?...&redirect_uri=https://evil.example/cb...'` returns 400 with no `Location` header.
- [ ] Manual: MCP Inspector (`bun run inspect`) completes OAuth against the local server through its loopback callback. (not done: requires interactive MCP Inspector session)
- [ ] After deploy: connect Claude.ai to `https://<domain>/mcp` and confirm `tools/list` loads. (not done: requires production deploy)
- [ ] This file's checkboxes are ticked and the PR description summarizes the result. (not done: PR not opened in this worktree)

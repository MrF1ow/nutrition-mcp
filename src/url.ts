// Derive the public base URL of the server. The single implementation for
// every caller: the HTTP entry point, the bearer middleware (whose
// WWW-Authenticate challenge names the resource metadata URL), the OAuth
// router, and the /mcp server factory, which advertises the widget icon URL.
// That factory only ever sees a raw `Request` — never a Hono context — which
// is why this accepts both.
//
// PUBLIC_ORIGIN, when set, is the advertised origin and X-Forwarded-* is
// ignored. Without a proxy that strips those headers, a client can otherwise
// steer the OAuth metadata URLs. When unset, the request Host /
// X-Forwarded-* still win, which is the local-dev path.
//
// It used to be three near-copies. They drifted: /mcp's fell back to
// "http://localhost" on a host-less request while the OAuth metadata URLs
// derived from that same request used the real origin, so one request could
// advertise two different servers.
type HonoLikeContext = {
    req: { header: (name: string) => string | undefined; url: string };
};

function pinnedPublicOrigin(): string | undefined {
    const raw = process.env.PUBLIC_ORIGIN?.trim();
    if (!raw) return undefined;
    try {
        return new URL(raw).origin;
    } catch {
        return raw.replace(/\/+$/, "");
    }
}

export function getBaseUrl(source: HonoLikeContext | Request): string {
    const pinned = pinnedPublicOrigin();
    if (pinned) return pinned;

    // Hono's `header` reads `this`, so it is called through the context rather
    // than detached.
    const req =
        source instanceof Request
            ? {
                  header: (name: string) =>
                      source.headers.get(name) ?? undefined,
                  url: source.url,
              }
            : {
                  header: (name: string) => source.req.header(name),
                  url: source.req.url,
              };

    const proto = req.header("x-forwarded-proto") || "http";
    const host = req.header("x-forwarded-host") || req.header("host");
    if (host) return `${proto}://${host}`;
    return new URL(req.url).origin;
}

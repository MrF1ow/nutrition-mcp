import { afterEach, describe, expect, test } from "bun:test";
import { getBaseUrl } from "./url.js";

const saved = process.env.PUBLIC_ORIGIN;

afterEach(() => {
    if (saved === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = saved;
});

function forwardedRequest(
    url: string,
    headers: Record<string, string>,
): Request {
    return new Request(url, { headers });
}

describe.serial("getBaseUrl", () => {
    test("when PUBLIC_ORIGIN is unset, X-Forwarded-* still wins", () => {
        delete process.env.PUBLIC_ORIGIN;
        const req = forwardedRequest("http://127.0.0.1:8080/authorize", {
            "x-forwarded-proto": "https",
            "x-forwarded-host": "spoof.example",
            host: "127.0.0.1:8080",
        });
        expect(getBaseUrl(req)).toBe("https://spoof.example");
    });

    test("when PUBLIC_ORIGIN is unset, Host is used without forwarding headers", () => {
        delete process.env.PUBLIC_ORIGIN;
        const req = forwardedRequest("http://127.0.0.1:8080/authorize", {
            host: "localhost:8080",
        });
        expect(getBaseUrl(req)).toBe("http://localhost:8080");
    });

    test("when PUBLIC_ORIGIN is set, X-Forwarded-* is ignored", () => {
        process.env.PUBLIC_ORIGIN = "https://foodable.example";
        const req = forwardedRequest("http://127.0.0.1:8080/authorize", {
            "x-forwarded-proto": "https",
            "x-forwarded-host": "spoof.example",
            host: "127.0.0.1:8080",
        });
        expect(getBaseUrl(req)).toBe("https://foodable.example");
    });

    test("PUBLIC_ORIGIN strips a trailing slash and ignores a path", () => {
        process.env.PUBLIC_ORIGIN = "https://foodable.example:8443/extra/";
        expect(getBaseUrl(new Request("http://127.0.0.1:8080/mcp"))).toBe(
            "https://foodable.example:8443",
        );
    });

    test("blank PUBLIC_ORIGIN is treated as unset", () => {
        process.env.PUBLIC_ORIGIN = "   ";
        const req = forwardedRequest("http://127.0.0.1:8080/", {
            "x-forwarded-proto": "https",
            "x-forwarded-host": "spoof.example",
        });
        expect(getBaseUrl(req)).toBe("https://spoof.example");
    });

    test("PUBLIC_ORIGIN pins a Hono-like context the same way", () => {
        process.env.PUBLIC_ORIGIN = "https://foodable.example";
        const c = {
            req: {
                header: (name: string) =>
                    name.toLowerCase() === "x-forwarded-host"
                        ? "spoof.example"
                        : name.toLowerCase() === "host"
                          ? "127.0.0.1:8080"
                          : undefined,
                url: "http://127.0.0.1:8080/authorize",
            },
        };
        expect(getBaseUrl(c)).toBe("https://foodable.example");
    });
});

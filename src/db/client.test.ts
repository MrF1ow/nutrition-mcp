import { test, expect } from "bun:test";
import { createTimedFetch } from "./client.js";

test("createTimedFetch aborts a slow request", async () => {
    const timedFetch = createTimedFetch(50);
    const hangingFetch = ((_input, init) =>
        new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
                reject(init.signal?.reason);
            });
        })) as typeof fetch;
    const original = globalThis.fetch;
    globalThis.fetch = hangingFetch;
    try {
        await expect(
            timedFetch("https://example.test/slow", {}),
        ).rejects.toBeDefined();
    } finally {
        globalThis.fetch = original;
    }
});

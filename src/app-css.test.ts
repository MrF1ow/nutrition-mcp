import { test, expect } from "bun:test";
import { getAppCss } from "./widgets.js";

test("app.css assembles with no unresolved include markers", async () => {
    const css = await getAppCss();
    expect(css.length).toBeGreaterThan(0);
    expect(css.match(/\/\*@include/g)).toBeNull();
    expect(css).toContain(".bottom-nav");
});

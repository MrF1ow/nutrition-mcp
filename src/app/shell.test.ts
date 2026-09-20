import { test, expect } from "bun:test";
import {
    APP_TABS,
    bottomNav,
    comingSoonPage,
    resolveAccent,
    resolveTheme,
} from "./shell.js";

test("bottom nav hrefs and tab order", () => {
    expect(APP_TABS.map((tab) => tab.id)).toEqual([
        "fridge",
        "grocery",
        "nutrition",
        "recipes",
        "settings",
    ]);
    expect(APP_TABS.map((tab) => tab.href)).toEqual([
        "/fridge",
        "/grocery",
        "/",
        "/recipes",
        "/settings",
    ]);
    expect(APP_TABS.map((tab) => tab.label)).toEqual([
        "Fridge",
        "Groceries",
        "Nutrition",
        "Recipes",
        "Settings",
    ]);

    const html = bottomNav("nutrition");
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([
        "/fridge",
        "/grocery",
        "/",
        "/recipes",
        "/settings",
    ]);
    expect(html).toContain('href="/" aria-current="page"');
    expect(html).not.toContain('href="/fridge" aria-current="page"');
});

test("null accent resolves to sky", () => {
    expect(resolveAccent(null)).toEqual({
        light: "#2f8fd4",
        dark: "#5eb8f0",
    });
    expect(resolveAccent("rose").light).toBe("#e25d8a");
});

test("unset theme is light", () => {
    expect(resolveTheme(null)).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
});

test("fridge stub uses the shell and marks Fridge active", () => {
    const html = comingSoonPage("fridge");
    expect(html).toContain("<h1>Fridge</h1>");
    expect(html).toContain("Coming soon.");
    expect(html).toContain('href="/fridge" aria-current="page"');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain("--accent:#2f8fd4");
});

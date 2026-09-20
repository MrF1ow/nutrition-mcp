import { test, expect } from "bun:test";
import { SITE_LOCALES } from "./routes.js";
import { LOGIN, LOGIN_ERRORS } from "./copy/login.js";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const loginPath = (locale: (typeof SITE_LOCALES)[number]) =>
    locale === "en" ? "./public/login.html" : `./public/${locale}/login.html`;

test("every locale has a built login page, in its own language", async () => {
    for (const locale of SITE_LOCALES) {
        const path = loginPath(locale);
        expect(`${path}: ${await Bun.file(path).exists()}`).toBe(
            `${path}: true`,
        );
        const doc = LOGIN[locale];
        const html = collapse(await Bun.file(path).text());
        for (const line of [
            doc.subtitle,
            doc.emailLabel,
            doc.passwordLabel,
            doc.continueButton,
            doc.termsLinkText,
            doc.privacyLinkText,
            doc.newHereNote,
            doc.afterConnectNote,
        ]) {
            expect(`${path} [${line}]: ${html.includes(line)}`).toBe(
                `${path} [${line}]: true`,
            );
        }
        if (locale !== "en") {
            for (const en of [
                LOGIN.en.subtitle,
                LOGIN.en.newHereNote,
                LOGIN.en.afterConnectNote,
            ]) {
                expect(`${path} [en: ${en}]: ${html.includes(en)}`).toBe(
                    `${path} [en: ${en}]: false`,
                );
            }
        }
        expect(html).not.toContain('href="/terms"');
        expect(html).not.toContain('href="/privacy"');
        expect(html).not.toContain('href="/tools"');
        expect(html).not.toContain('href="/alternatives"');
        expect(html).not.toMatch(/class="brand"[^>]*href="\/"/);
        expect(html).toContain("{{LANG_SWITCHER}}");
        expect(html).toContain("theme-switch");
        expect(html).not.toContain("/authorize/google");
        expect(html).not.toContain("auth-btn-google");
        expect(html).not.toContain("created automatically");
        expect(html).not.toContain("Konto wird automatisch");
    }
});

// This page is a TEMPLATE: renderLoginPage() fills these four in per request.
// A token lost to a generator change would ship a login form whose submit
// posts an empty session_id.
test("every login page keeps its four runtime placeholders", async () => {
    for (const locale of SITE_LOCALES) {
        const path = loginPath(locale);
        const html = await Bun.file(path).text();
        for (const token of [
            "{{SESSION_ID}}",
            "{{ERROR}}",
            "{{LANG_SWITCHER}}",
            "{{TRANSLATION_NOTICE}}",
        ]) {
            expect(`${path} ${token}: ${html.includes(token)}`).toBe(
                `${path} ${token}: true`,
            );
        }
    }
});

test("every locale's closed-signup error is translated", () => {
    for (const locale of SITE_LOCALES) {
        if (locale === "en") continue;
        expect(
            `${locale}.signupClosed: ${LOGIN_ERRORS[locale].signupClosed === LOGIN_ERRORS.en.signupClosed}`,
        ).toBe(`${locale}.signupClosed: false`);
    }
});

test("site.js does not poll the taken-down /api/stats route", async () => {
    const siteJs = await Bun.file("./public/site.js").text();
    expect(siteJs).not.toContain("/api/stats");
    expect(siteJs).not.toContain("data-live-badge");
});

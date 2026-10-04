// Shared HTML fragments for the OAuth login templates. Login is the only
// generated public HTML; marketing pages are gone. Nothing here is escaped
// against untrusted input — callers pass developer-authored constants.

import type { SiteLocale } from "../src/routes.js";
import { chromeFor } from "../src/copy/chrome.js";

/** Minimal HTML-entity escaping for text interpolated into element bodies. */
export function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const HEAD_ASSETS = `        <link rel="stylesheet" href="/styles.css" />`;

export const THEME_PREPAINT = `        <script>
            // Apply a saved theme override before paint to avoid a flash.
            (function () {
                try {
                    var t = localStorage.getItem("theme");
                    if (t === "dark" || t === "light")
                        document.body.setAttribute("data-theme", t);
                } catch (e) {}
            })();
        </script>`;

/** Sky widget tokens for login /authorize only. styles.css stays FDA green
 *  for leftover marketing CSS; body.auth overrides beat those rules.
 *  @font-face lives here (not only in styles.css) so the generated login
 *  HTML itself names the self-hosted files — GET /authorize is the page
 *  visitors see, and a stylesheet href to styles.css does not put those
 *  URLs in the document. */
export const LOGIN_SKY_TOKENS = `            @font-face {
                font-family: "Bricolage Grotesque";
                src: url("/fonts/bricolage-grotesque-latin.woff2")
                    format("woff2");
                font-weight: 400 800;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: "Instrument Sans";
                src: url("/fonts/instrument-sans-latin.woff2") format("woff2");
                font-weight: 400 700;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: "Instrument Sans";
                src: url("/fonts/instrument-sans-latin-italic.woff2")
                    format("woff2");
                font-weight: 400 700;
                font-style: italic;
                font-display: swap;
            }
            @font-face {
                font-family: "Geist Mono";
                src: url("/fonts/geist-mono-latin.woff2") format("woff2");
                font-weight: 400 500;
                font-style: normal;
                font-display: swap;
            }
            body.auth {
                --font-display:
                    "Bricolage Grotesque", ui-sans-serif, system-ui,
                    -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
                    sans-serif;
                --font-body: "Instrument Sans", var(--font-display);
                --bg: #f5f5f7;
                --bg-alt: #f5f5f7;
                --surface: #ffffff;
                --surface-2: #ffffff;
                --ink: #1d1d1f;
                --ink-2: #6e6e73;
                --ink-3: #98989d;
                --line: #e6e6ea;
                --line-2: #e6e6ea;
                --accent: #2f8fd4;
                --accent-hover: #2478b8;
                --accent-ink: #ffffff;
                --accent-soft: color-mix(in srgb, var(--accent) 16%, #ffffff);
                --accent-soft-2: color-mix(in srgb, var(--accent) 28%, #ffffff);
                --shadow-card:
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    0 8px 22px rgba(0, 0, 0, 0.05);
            }
            @media (prefers-color-scheme: dark) {
                body.auth:not([data-theme="light"]) {
                    --bg: #000000;
                    --bg-alt: #000000;
                    --surface: #1c1c1e;
                    --surface-2: #1c1c1e;
                    --ink: #f5f5f7;
                    --ink-2: #98989d;
                    --ink-3: #6e6e73;
                    --line: #2c2c2e;
                    --line-2: #2c2c2e;
                    --accent: #5eb8f0;
                    --accent-hover: #7ec8f5;
                    --accent-ink: #0b1220;
                    --accent-soft: color-mix(in srgb, var(--accent) 22%, #1c1c1e);
                    --accent-soft-2: color-mix(
                        in srgb,
                        var(--accent) 32%,
                        #1c1c1e
                    );
                    --shadow-card: none;
                    color-scheme: dark;
                }
            }
            body.auth[data-theme="dark"] {
                --bg: #000000;
                --bg-alt: #000000;
                --surface: #1c1c1e;
                --surface-2: #1c1c1e;
                --ink: #f5f5f7;
                --ink-2: #98989d;
                --ink-3: #6e6e73;
                --line: #2c2c2e;
                --line-2: #2c2c2e;
                --accent: #5eb8f0;
                --accent-hover: #7ec8f5;
                --accent-ink: #0b1220;
                --accent-soft: color-mix(in srgb, var(--accent) 22%, #1c1c1e);
                --accent-soft-2: color-mix(in srgb, var(--accent) 32%, #1c1c1e);
                --shadow-card: none;
                color-scheme: dark;
            }
            body.auth[data-theme="light"] {
                --bg: #f5f5f7;
                --bg-alt: #f5f5f7;
                --surface: #ffffff;
                --surface-2: #ffffff;
                --ink: #1d1d1f;
                --ink-2: #6e6e73;
                --ink-3: #98989d;
                --line: #e6e6ea;
                --line-2: #e6e6ea;
                --accent: #2f8fd4;
                --accent-hover: #2478b8;
                --accent-ink: #ffffff;
                --accent-soft: color-mix(in srgb, var(--accent) 16%, #ffffff);
                --accent-soft-2: color-mix(in srgb, var(--accent) 28%, #ffffff);
                --shadow-card:
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    0 8px 22px rgba(0, 0, 0, 0.05);
                color-scheme: light;
            }`;

export const SITE_SCRIPT = `        <script src="/site.js" defer></script>`;

export function generatedBanner(script: string): string {
    return `        <!-- Generated by ${script} — edit the data there, not this file. -->`;
}

/**
 * Login header. Sky tokens on body.auth paint this chrome; brand stays on
 * this page (`#main`) and must not send anyone to `/`, which is not HTML.
 */
export function nav(locale: SiteLocale = "en"): string {
    const c = chromeFor(locale);
    return `        <a class="skip" href="#main">${esc(c.skipToContent)}</a>
        <header class="site-head" id="site-head">
            <div class="head-inner">
                <a class="brand" href="#main" aria-label="${esc(c.brandHomeAriaLabel)}">
                    <span class="brand-mark" aria-hidden="true">🍏</span>
                    <span>Nutrition&nbsp;MCP</span>
                </a>
                <div class="head-tools">
                    <details class="theme-switch" id="theme-switch">
                        <summary
                            class="icon-btn"
                            aria-label="${esc(c.theme.ariaLabel)}"
                            title="${esc(c.theme.title)}"
                        >
                            <svg class="auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
                            </svg>
                            <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                            </svg>
                            <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="4" />
                                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                            </svg>
                        </summary>
                        <div class="theme-menu" role="group" aria-label="${esc(c.theme.title)}">
                            <button type="button" data-theme-set="system" aria-pressed="true">${esc(c.theme.system)}</button>
                            <button type="button" data-theme-set="light" aria-pressed="false">${esc(c.theme.light)}</button>
                            <button type="button" data-theme-set="dark" aria-pressed="false">${esc(c.theme.dark)}</button>
                        </div>
                    </details>
                </div>
            </div>
        </header>`;
}

export function footer(locale: SiteLocale = "en"): string {
    const c = chromeFor(locale);
    return `        <footer class="footer">
            <div class="footer-inner">
                <span class="footer-brand">
                    <span class="brand-mark" aria-hidden="true">🍏</span>
                    Nutrition MCP
                </span>
                <p class="footer-note">
                    ${esc(c.footer.note)}
                </p>
            </div>
        </footer>`;
}

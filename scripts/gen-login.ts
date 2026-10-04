/**
 * Generates public/login.html from the typed data in src/copy/login.ts.
 *
 * This is a TEMPLATE, not a final document: src/oauth.ts's renderLoginPage()
 * reads the output this writes and fills in {{SESSION_ID}} and {{ERROR}} at
 * request time. Those tokens must reach the written file untouched; nothing
 * below interpolates them.
 *
 * Re-run after editing src/copy/login.ts:
 *   bun run scripts/gen-login.ts
 * The generated .html file is the served artifact — don't hand-edit it.
 */

import { HTML_LANG } from "../src/routes.js";
import {
    esc,
    footer,
    generatedBanner,
    nav,
    HEAD_ASSETS,
    LOGIN_SKY_TOKENS,
    SITE_SCRIPT,
    THEME_PREPAINT,
} from "./site-partials.js";
import { LOGIN, type LoginDoc } from "../src/copy/login.js";
import { rm } from "node:fs/promises";

const STALE_LOCALES = ["de", "es", "fr", "nl", "pl", "it", "uk", "ja"] as const;

async function removeStaleMarketingHtml(): Promise<void> {
    const files = [
        "public/index.html",
        "public/tools.html",
        "public/privacy.html",
        "public/terms.html",
        "public/sitemap.xml",
        "public/llms.txt",
    ];
    for (const locale of STALE_LOCALES) {
        for (const name of [
            "index.html",
            "tools.html",
            "privacy.html",
            "terms.html",
            "login.html",
        ]) {
            files.push(`public/${locale}/${name}`);
        }
    }
    await Promise.all(files.map((f) => rm(f, { force: true })));
    await rm("public/alternatives", { recursive: true, force: true });
    await Promise.all(
        STALE_LOCALES.map((locale) =>
            rm(`public/${locale}`, {
                recursive: true,
                force: true,
            }),
        ),
    );
}

await removeStaleMarketingHtml();

// Page-layout CSS, unchanged from the previous hand-authored login.html.
const LOGIN_STYLE = `        <style>
            /* Sky widget chrome on login /authorize only. styles.css keeps
               FDA green for leftover marketing CSS. */
${LOGIN_SKY_TOKENS}
            /* Page layout: sticky header, centred stage, footer at the foot.
               body.auth in styles.css is flex-centred for the old standalone
               card; here the stage does the centring instead. */
            body.auth {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: flex-start;
                padding: 0;
            }
            body.auth > main {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .auth-stage {
                flex: 1;
                display: grid;
                place-items: center;
                padding: clamp(2rem, 6vw, 4rem) 1rem;
            }
            /* The sign-in card takes the shared .card surface; the old
               standalone shadow + entrance animation go. */
            body.auth .auth-card {
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-card);
                animation: none;
            }
            body.auth .auth-title {
                font-size: clamp(1.7rem, 4vw, 2.1rem);
            }
            body.auth .auth-sub {
                margin-top: 0.45rem;
            }
            body.auth .auth-field label {
                font-family: var(--font-mono);
                font-size: 0.72rem;
                letter-spacing: 0.08em;
            }
            body.auth .auth-field input,
            body.auth .auth-btn {
                border-radius: 10px;
            }
        </style>`;

function renderDoc(doc: LoginDoc): string {
    const title = `${esc(doc.title)} — ${esc(doc.subtitle)}`;

    // Legal HTML is gone. Keep the consent sentence, but the {terms}/
    // {privacy} tokens are the localized names as text, not anchors.
    const consent = esc(doc.consentNote)
        .replace("{terms}", esc(doc.termsLinkText))
        .replace("{privacy}", esc(doc.privacyLinkText));

    return `<!doctype html>
<html lang="${HTML_LANG.en}">
    <head>
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta charset="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#f5f5f7" />
        <!-- No canonical/hreflang: this page has no fixed URL (rendered
             per in-flight OAuth session via GET /authorize, not routed by
             path — see src/copy/login.ts) and isn't in the sitemap. noindex
             is a defensive belt-and-suspenders in case a stray link to
             /authorize is ever crawled. -->
        <meta name="robots" content="noindex, nofollow" />
${HEAD_ASSETS}
${LOGIN_STYLE}
    </head>
    <body class="auth">
${generatedBanner("scripts/gen-login.ts")}
${THEME_PREPAINT}

${nav("en")}

        <main id="main">
            <div class="auth-stage">
                <div class="auth-wrap">
                    <div class="auth-card card">
                        <div class="auth-head">
                            <span class="auth-mark" aria-hidden="true">🍏</span>
                            <h1 class="auth-title">${esc(doc.title)}</h1>
                            <p class="auth-sub">${esc(doc.subtitle)}</p>
                        </div>

                        {{ERROR}}

                        <form method="POST" action="/approve" class="auth-form">
                            <input
                                type="hidden"
                                name="session_id"
                                value="{{SESSION_ID}}"
                            />
                            <div class="auth-field">
                                <label for="email">${esc(doc.emailLabel)}</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    autocomplete="email"
                                />
                            </div>
                            <div class="auth-field">
                                <label for="password">${esc(doc.passwordLabel)}</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    required
                                    minlength="6"
                                    autocomplete="current-password"
                                />
                            </div>
                            <button
                                type="submit"
                                name="action"
                                value="login"
                                class="auth-btn"
                            >
                                ${esc(doc.continueButton)}
                            </button>
                            <p class="auth-note">${consent}</p>
                            <p class="auth-note">${esc(doc.newHereNote)}</p>
                            <p class="auth-note">${esc(doc.afterConnectNote)}</p>
                        </form>
                    </div>
                </div>
            </div>
        </main>

${footer("en")}

${SITE_SCRIPT}
    </body>
</html>
`;
}

await Bun.write("./public/login.html", renderDoc(LOGIN));
console.log("wrote ./public/login.html");

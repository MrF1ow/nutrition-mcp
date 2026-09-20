// Typed content for the OAuth login screen (public/login.html and its
// translated public/{locale}/login.html), rendered by scripts/gen-login.ts.
// This page is rendered per in-flight OAuth session (see src/oauth.ts's
// renderLoginPage) rather than served as a flat file at a fixed URL. It is
// reachable only via GET /authorize with a client's redirect_uri/state/
// client_id, and has zero SEO surface.
//
// LOGIN and LOGIN_ERRORS are full `Record<SiteLocale, ...>`s. Adding a
// locale to src/routes.ts's LOCALES without adding its login copy here is a
// `bun run typecheck` failure. src/oauth.ts still decides availability by
// asking whether public/{locale}/login.html exists on disk rather than by
// importing this module. Keep the two in step by re-running
// scripts/gen-login.ts after touching this file.

import type { SiteLocale } from "../routes.js";
import { LOGIN_DE, LOGIN_ERRORS_DE } from "./login.de.js";
import { LOGIN_ES, LOGIN_ERRORS_ES } from "./login.es.js";
import { LOGIN_FR, LOGIN_ERRORS_FR } from "./login.fr.js";
import { LOGIN_NL, LOGIN_ERRORS_NL } from "./login.nl.js";
import { LOGIN_PL, LOGIN_ERRORS_PL } from "./login.pl.js";
import { LOGIN_IT, LOGIN_ERRORS_IT } from "./login.it.js";
import { LOGIN_UK, LOGIN_ERRORS_UK } from "./login.uk.js";
import { LOGIN_JA, LOGIN_ERRORS_JA } from "./login.ja.js";

export interface LoginDoc {
    title: string;
    subtitle: string;
    emailLabel: string;
    passwordLabel: string;
    continueButton: string;
    /** "By continuing you confirm..." — {terms}/{privacy} become the
     * localized names as plain text. Legal HTML is gone, so do not turn
     * these into anchors. */
    consentNote: string;
    termsLinkText: string;
    privacyLinkText: string;
    newHereNote: string;
    afterConnectNote: string;
}

export interface LoginErrors {
    signupClosed: string;
}

const EN: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Sign in to connect",
    emailLabel: "Email",
    passwordLabel: "Password",
    continueButton: "Continue",
    consentNote:
        "By continuing you confirm you're at least 16 and agree to the {terms} and {privacy}.",
    termsLinkText: "Terms of Service",
    privacyLinkText: "Privacy Policy",
    newHereNote: "Sign in with the email and password for this household.",
    afterConnectNote:
        "After successful connection in your client, save your password somewhere and close this browser tab.",
};

export const LOGIN: Record<SiteLocale, LoginDoc> = {
    en: EN,
    de: LOGIN_DE,
    es: LOGIN_ES,
    fr: LOGIN_FR,
    nl: LOGIN_NL,
    pl: LOGIN_PL,
    it: LOGIN_IT,
    uk: LOGIN_UK,
    ja: LOGIN_JA,
};

export const LOGIN_ERRORS: Record<SiteLocale, LoginErrors> = {
    en: {
        signupClosed: "Sign-up is closed. Sign in with an existing account.",
    },
    de: LOGIN_ERRORS_DE,
    es: LOGIN_ERRORS_ES,
    fr: LOGIN_ERRORS_FR,
    nl: LOGIN_ERRORS_NL,
    pl: LOGIN_ERRORS_PL,
    it: LOGIN_ERRORS_IT,
    uk: LOGIN_ERRORS_UK,
    ja: LOGIN_ERRORS_JA,
};

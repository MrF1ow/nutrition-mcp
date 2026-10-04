// Typed content for the OAuth login screen (public/login.html), rendered by
// scripts/gen-login.ts. This page is rendered per in-flight OAuth session
// (see src/oauth.ts's renderLoginPage) rather than served as a flat file at
// a fixed URL. It is reachable only via GET /authorize with a client's
// redirect_uri/state/client_id, and has zero SEO surface.

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

export const LOGIN: LoginDoc = {
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

export const LOGIN_ERRORS: LoginErrors = {
    signupClosed: "Sign-up is closed. Sign in with an existing account.",
};

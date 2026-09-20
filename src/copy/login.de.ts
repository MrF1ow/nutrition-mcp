import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_DE: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Anmelden, um die Verbindung herzustellen",
    emailLabel: "E-Mail",
    passwordLabel: "Passwort",
    continueButton: "Weiter",
    consentNote:
        "Wenn du fortfährst, bestätigst du, mindestens 16 Jahre alt zu sein, und stimmst den {terms} und der {privacy} zu.",
    termsLinkText: "Nutzungsbedingungen",
    privacyLinkText: "Datenschutzerklärung",
    newHereNote:
        "Melde dich mit der E-Mail-Adresse und dem Passwort für diesen Haushalt an.",
    afterConnectNote:
        "Speichere dein Passwort nach erfolgreicher Verbindung in deinem Client an einem sicheren Ort und schließe diesen Browser-Tab.",
};

export const LOGIN_ERRORS_DE: LoginErrors = {
    signupClosed:
        "Die Registrierung ist geschlossen. Melde dich mit einem bestehenden Konto an.",
};

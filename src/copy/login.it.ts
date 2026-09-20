import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_IT: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Accedi per collegarti",
    emailLabel: "Email",
    passwordLabel: "Password",
    continueButton: "Continua",
    consentNote:
        "Continuando, confermi di avere almeno 16 anni e accetti i {terms} e l'{privacy}.",
    termsLinkText: "Termini di servizio",
    privacyLinkText: "Informativa sulla privacy",
    newHereNote: "Accedi con l'email e la password di questa famiglia.",
    afterConnectNote:
        "Una volta completato il collegamento nel tuo client, salva la password in un posto sicuro e chiudi questa scheda del browser.",
};

export const LOGIN_ERRORS_IT: LoginErrors = {
    signupClosed:
        "Le registrazioni sono chiuse. Accedi con un account esistente.",
};

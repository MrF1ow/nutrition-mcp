import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_NL: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Log in om verbinding te maken",
    emailLabel: "E-mail",
    passwordLabel: "Wachtwoord",
    continueButton: "Doorgaan",
    consentNote:
        "Als je doorgaat, bevestig je dat je minstens 16 jaar oud bent en ga je akkoord met de {terms} en het {privacy}.",
    termsLinkText: "Gebruiksvoorwaarden",
    privacyLinkText: "Privacybeleid",
    newHereNote: "Log in met het e-mailadres en wachtwoord van dit huishouden.",
    afterConnectNote:
        "Als de verbinding in je client is gelukt, bewaar je wachtwoord dan op een veilige plek en sluit dit browsertabblad.",
};

export const LOGIN_ERRORS_NL: LoginErrors = {
    signupClosed: "Registratie is gesloten. Log in met een bestaand account.",
};

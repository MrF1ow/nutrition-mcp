import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_FR: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Connecte-toi pour autoriser l'accès",
    emailLabel: "E-mail",
    passwordLabel: "Mot de passe",
    continueButton: "Continuer",
    consentNote:
        "En continuant, tu confirmes avoir au moins 16 ans et tu acceptes les {terms} et la {privacy}.",
    termsLinkText: "Conditions d'utilisation",
    privacyLinkText: "Politique de confidentialité",
    newHereNote: "Connecte-toi avec l'e-mail et le mot de passe de ce foyer.",
    afterConnectNote:
        "Une fois la connexion établie dans ton client, conserve ton mot de passe en lieu sûr et ferme cet onglet du navigateur.",
};

export const LOGIN_ERRORS_FR: LoginErrors = {
    signupClosed:
        "Les inscriptions sont fermées. Connecte-toi avec un compte existant.",
};

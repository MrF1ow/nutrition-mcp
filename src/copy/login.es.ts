import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_ES: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Inicia sesión para conectar tu cliente",
    emailLabel: "Correo electrónico",
    passwordLabel: "Contraseña",
    continueButton: "Continuar",
    consentNote:
        "Al continuar confirmas que tienes al menos 16 años y aceptas los {terms} y la {privacy}.",
    termsLinkText: "Términos de servicio",
    privacyLinkText: "Política de privacidad",
    newHereNote: "Inicia sesión con el correo y la contraseña de este hogar.",
    afterConnectNote:
        "Cuando la conexión se haya completado en tu cliente, guarda tu contraseña en un lugar seguro y cierra esta pestaña del navegador.",
};

export const LOGIN_ERRORS_ES: LoginErrors = {
    signupClosed:
        "El registro está cerrado. Inicia sesión con una cuenta existente.",
};

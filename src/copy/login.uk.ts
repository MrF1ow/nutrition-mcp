import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_UK: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "Увійди, щоб підключитися",
    emailLabel: "Електронна пошта",
    passwordLabel: "Пароль",
    continueButton: "Продовжити",
    // "погоджуєшся з" governs the instrumental case, so both link texts are
    // in the instrumental rather than the nominative the footer uses.
    consentNote:
        "Продовжуючи, ти підтверджуєш, що тобі щонайменше 16 років, і погоджуєшся з {terms} та {privacy}.",
    termsLinkText: "Умовами використання",
    privacyLinkText: "Політикою приватності",
    newHereNote:
        "Увійди з електронною поштою та паролем цього домогосподарства.",
    afterConnectNote:
        "Після успішного підключення у твоєму клієнті збережи пароль у надійному місці й закрий цю вкладку браузера.",
};

export const LOGIN_ERRORS_UK: LoginErrors = {
    signupClosed: "Реєстрацію закрито. Увійди з наявним обліковим записом.",
};

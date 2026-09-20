import type { LoginDoc, LoginErrors } from "./login.js";

export const LOGIN_JA: LoginDoc = {
    title: "Nutrition MCP",
    subtitle: "接続するにはサインイン",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    continueButton: "続行",
    consentNote:
        "続行すると、16歳以上であることを確認し、{terms}と{privacy}に同意したことになります。",
    termsLinkText: "利用規約",
    privacyLinkText: "プライバシーポリシー",
    newHereNote:
        "この世帯のメールアドレスとパスワードでサインインしてください。",
    afterConnectNote:
        "クライアントでの接続が完了したら、パスワードを安全な場所に保存して、このブラウザタブを閉じてください。",
};

export const LOGIN_ERRORS_JA: LoginErrors = {
    signupClosed:
        "新規登録は終了しています。既存のアカウントでサインインしてください。",
};

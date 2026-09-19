// Locale data for login templates and widget language. Deliberately free of
// any import that reaches for Supabase credentials or has other side
// effects (unlike src/index.ts), so this module is safe to import from
// oauth, mcp, the login generator, and tests.

/** Non-English site locales, in the order the language switcher lists them. */
export const LOCALES = [
    "de",
    "es",
    "fr",
    "nl",
    "pl",
    "it",
    "uk",
    "ja",
] as const;
export type Locale = (typeof LOCALES)[number];

/** English plus every translated locale — every language the site ships in. */
export type SiteLocale = "en" | Locale;
export const SITE_LOCALES: readonly SiteLocale[] = ["en", ...LOCALES];

/** Each locale's own name for itself, for the language switcher. */
export const LOCALE_NAMES: Record<SiteLocale, string> = {
    en: "English",
    de: "Deutsch",
    es: "Español",
    fr: "Français",
    nl: "Nederlands",
    pl: "Polski",
    it: "Italiano",
    uk: "Українська",
    ja: "日本語",
};

/**
 * The disclosure on a translated login page — AI translation, no human
 * review pass. The English-original link is built by the caller (oauth.ts
 * uses authorizeUrl so it stays in the in-flight OAuth flow). Keyed by
 * `Locale`, not `SiteLocale`: English structurally can never have a notice
 * about itself.
 */
export const TRANSLATION_NOTICE: Partial<
    Record<Locale, { text: string; linkText: string }>
> = {
    de: {
        text: "Diese Seite wurde mit KI aus dem Englischen übersetzt und wurde nicht von einer Person überprüft.",
        linkText: "Original auf Englisch lesen",
    },
    es: {
        text: "Esta página fue traducida con IA a partir del inglés y no ha sido revisada por una persona.",
        linkText: "Leer el original en inglés",
    },
    fr: {
        text: "Cette page a été traduite avec l'IA à partir de l'anglais et n'a pas été relue par une personne.",
        linkText: "Lire l'original en anglais",
    },
    nl: {
        text: "Deze pagina is met AI vertaald vanuit het Engels en is niet door een mens gecontroleerd.",
        linkText: "Origineel in het Engels lezen",
    },
    pl: {
        text: "Ta strona została przetłumaczona przez sztuczną inteligencję z języka angielskiego i nie została sprawdzona przez człowieka.",
        linkText: "Przeczytaj oryginał po angielsku",
    },
    it: {
        text: "Questa pagina è stata tradotta con l'IA dall'inglese e non è stata rivista da una persona.",
        linkText: "Leggi l'originale in inglese",
    },
    uk: {
        text: "Цю сторінку перекладено за допомогою ШІ з англійської, і її не перевіряла людина.",
        linkText: "Читати оригінал англійською",
    },
    ja: {
        text: "このページはAIによって英語から翻訳されており、人による確認は行われていません。",
        linkText: "英語の原文を読む",
    },
};

/** IETF BCP 47 tag for `<html lang>` — a bare 2-letter code for every locale
 * here, since none needs a region qualifier (no en-US vs en-GB split, etc). */
export const HTML_LANG: Record<SiteLocale, string> = {
    en: "en",
    de: "de",
    es: "es",
    fr: "fr",
    nl: "nl",
    pl: "pl",
    it: "it",
    uk: "uk",
    ja: "ja",
};

/** Open Graph's `og:locale` wants language_TERRITORY, not a bare tag. */
export const OG_LOCALE: Record<SiteLocale, string> = {
    en: "en_US",
    de: "de_DE",
    es: "es_ES",
    fr: "fr_FR",
    nl: "nl_NL",
    pl: "pl_PL",
    it: "it_IT",
    uk: "uk_UA",
    ja: "ja_JP",
};

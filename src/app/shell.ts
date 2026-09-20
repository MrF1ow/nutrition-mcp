export const APP_TABS = [
    { id: "fridge", href: "/fridge", label: "Fridge" },
    { id: "grocery", href: "/grocery", label: "Groceries" },
    { id: "nutrition", href: "/", label: "Nutrition" },
    { id: "recipes", href: "/recipes", label: "Recipes" },
    { id: "settings", href: "/settings", label: "Settings" },
] as const;

export type AppTabId = (typeof APP_TABS)[number]["id"];

export type Theme = "light" | "dark";

export const ACCENT_SWATCHES = {
    sky: { light: "#2f8fd4", dark: "#5eb8f0" },
    violet: { light: "#7c6af0", dark: "#a78bfa" },
    teal: { light: "#0f9d91", dark: "#2dd4bf" },
    rose: { light: "#e25d8a", dark: "#fb7199" },
    amber: { light: "#d97706", dark: "#fbbf24" },
    slate: { light: "#64748b", dark: "#94a3b8" },
} as const;

export type AccentSwatch = keyof typeof ACCENT_SWATCHES;

export type AccentTokens = {
    light: string;
    dark: string;
};

export type ViewerChrome = {
    theme: Theme;
    accent: AccentTokens;
};

export type AppChrome = ViewerChrome & {
    title: string;
    active: AppTabId;
    body: string;
};

const SWATCH_NAMES = new Set<string>(Object.keys(ACCENT_SWATCHES));

export function isAccentSwatch(
    value: string | null | undefined,
): value is AccentSwatch {
    return value != null && SWATCH_NAMES.has(value);
}

export function resolveAccent(swatch: string | null | undefined): AccentTokens {
    if (isAccentSwatch(swatch)) return ACCENT_SWATCHES[swatch];
    return ACCENT_SWATCHES.sky;
}

export function resolveTheme(theme: string | null | undefined): Theme {
    return theme === "dark" ? "dark" : "light";
}

export function accentColor(theme: Theme, accent: AccentTokens): string {
    return theme === "dark" ? accent.dark : accent.light;
}

export function accentCssVars(theme: Theme, accent: AccentTokens): string {
    const color = accentColor(theme, accent);
    const ink = theme === "dark" ? "#0b1220" : "#ffffff";
    return `--accent:${color};--accent-ink:${ink}`;
}

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function bottomNav(active: AppTabId): string {
    const links = APP_TABS.map((tab) => {
        const current = tab.id === active ? ' aria-current="page"' : "";
        return `<a href="${tab.href}"${current}>${escapeHtml(tab.label)}</a>`;
    }).join("");
    return `<nav class="bottom-nav" aria-label="App">${links}</nav>`;
}

export function appHead(
    title: string,
    theme: Theme,
    accent: AccentTokens,
): string {
    return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/app.css" />
<style>html[data-theme="${theme}"]{${accentCssVars(theme, accent)}}</style>`;
}

export function renderAppShell(chrome: AppChrome): string {
    return `<!doctype html>
<html lang="en" data-theme="${chrome.theme}">
<head>
${appHead(chrome.title, chrome.theme, chrome.accent)}
</head>
<body>
<header class="app-bar"><a href="/logout">Log out</a></header>
<main class="app-main">${chrome.body}</main>
${bottomNav(chrome.active)}
<script>
document.querySelectorAll(".widget-frame").forEach((frame) => {
    const fit = () => {
        try {
            const doc = frame.contentDocument;
            if (!doc) return;
            frame.style.height = Math.ceil(doc.documentElement.scrollHeight) + "px";
        } catch (_) {}
    };
    frame.addEventListener("load", fit);
    window.addEventListener("message", (e) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data;
        if (d && d.method && String(d.method).endsWith("size-changed") && d.params && d.params.height) {
            frame.style.height = d.params.height + "px";
        }
    });
});
</script>
</body>
</html>`;
}

export function parseAppearanceInput(input: {
    theme?: unknown;
    accent_swatch?: unknown;
}): { theme: Theme; accent_swatch: AccentSwatch | null } {
    const theme = input.theme === "dark" ? "dark" : "light";
    const raw =
        typeof input.accent_swatch === "string" ? input.accent_swatch : "";
    return {
        theme,
        accent_swatch: isAccentSwatch(raw) ? raw : null,
    };
}

export function comingSoonPage(
    tab: Exclude<AppTabId, "nutrition">,
    chrome: ViewerChrome = {
        theme: "light",
        accent: ACCENT_SWATCHES.sky,
    },
): string {
    const label = APP_TABS.find((t) => t.id === tab)!.label;
    return renderAppShell({
        title: label,
        active: tab,
        theme: chrome.theme,
        accent: chrome.accent,
        body: `<h1>${escapeHtml(label)}</h1><p class="coming-soon">Coming soon.</p>`,
    });
}

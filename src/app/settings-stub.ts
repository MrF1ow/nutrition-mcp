import {
    ACCENT_SWATCHES,
    escapeHtml,
    renderAppShell,
    type AccentSwatch,
    type ViewerChrome,
} from "./shell.js";

const SWATCH_ORDER = Object.keys(ACCENT_SWATCHES) as AccentSwatch[];

export function renderSettingsStub(
    chrome: ViewerChrome,
    selectedSwatch: AccentSwatch | null,
): string {
    const themeLight = chrome.theme === "light" ? " checked" : "";
    const themeDark = chrome.theme === "dark" ? " checked" : "";
    const current = selectedSwatch ?? "sky";
    const swatches = SWATCH_ORDER.map((name) => {
        const checked = name === current ? " checked" : "";
        const color = ACCENT_SWATCHES[name].light;
        return `<label class="swatch">
            <input type="radio" name="accent_swatch" value="${name}"${checked} />
            <span class="swatch-chip" style="background:${color}"></span>
            ${escapeHtml(name)}
        </label>`;
    }).join("");

    const body = `
        <h1>Settings</h1>
        <p class="coming-soon">Account and household settings land in a later change. Theme and app color save here now.</p>
        <form method="POST" action="/settings" class="appearance">
            <fieldset>
                <legend>Theme</legend>
                <label><input type="radio" name="theme" value="light"${themeLight} /> Light</label>
                <label><input type="radio" name="theme" value="dark"${themeDark} /> Dark</label>
            </fieldset>
            <fieldset>
                <legend>App color</legend>
                <div class="swatches">${swatches}</div>
            </fieldset>
            <button type="submit">Save</button>
        </form>
    `;
    return renderAppShell({
        title: "Settings",
        active: "settings",
        theme: chrome.theme,
        accent: chrome.accent,
        body,
    });
}

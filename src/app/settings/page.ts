import {
    ACCENT_SWATCHES,
    escapeHtml,
    renderAppShell,
    type AccentSwatch,
    type ViewerChrome,
} from "../shell.js";
import { DRINK_UNITS, isDrinkUnit, type DrinkUnit } from "../../alcohol.js";
import { SITE_LOCALES, LOCALE_NAMES, type SiteLocale } from "../../routes.js";
import { WEIGHT_UNITS, isWeightUnit, type WeightUnit } from "../../units.js";

const SWATCH_ORDER = Object.keys(ACCENT_SWATCHES) as AccentSwatch[];

export type SettingsPageView = {
    chrome: ViewerChrome;
    selectedSwatch: AccentSwatch | null;
    displayName: string;
    timezone: string;
    locale: string;
    weightUnit: WeightUnit | "";
    widgetsEnabled: boolean;
    alcoholTrackingEnabled: boolean;
    drinkUnit: DrinkUnit | "";
    error?: string;
};

export type NutritionPrefsPatch = {
    timezone?: string;
    locale?: string;
    preferred_weight_unit?: WeightUnit | null;
    widgets_enabled?: boolean;
    alcohol_tracking_enabled?: boolean;
    preferred_drink_unit?: DrinkUnit | null;
};

export function parseNutritionPrefsInput(input: {
    timezone?: unknown;
    locale?: unknown;
    preferred_weight_unit?: unknown;
    widgets_enabled?: unknown;
    alcohol_tracking_enabled?: unknown;
    preferred_drink_unit?: unknown;
}): NutritionPrefsPatch {
    const patch: NutritionPrefsPatch = {};
    if (typeof input.timezone === "string") {
        patch.timezone = input.timezone.trim();
    }
    if (typeof input.locale === "string") {
        const locale = input.locale.trim();
        if ((SITE_LOCALES as readonly string[]).includes(locale)) {
            patch.locale = locale;
        }
    }
    if (typeof input.preferred_weight_unit === "string") {
        const unit = input.preferred_weight_unit.trim();
        patch.preferred_weight_unit = isWeightUnit(unit) ? unit : null;
    }
    if (input.widgets_enabled !== undefined) {
        patch.widgets_enabled =
            input.widgets_enabled === "on" ||
            input.widgets_enabled === "true" ||
            input.widgets_enabled === true;
    }
    if (input.alcohol_tracking_enabled !== undefined) {
        patch.alcohol_tracking_enabled =
            input.alcohol_tracking_enabled === "on" ||
            input.alcohol_tracking_enabled === "true" ||
            input.alcohol_tracking_enabled === true;
    }
    if (typeof input.preferred_drink_unit === "string") {
        const unit = input.preferred_drink_unit.trim();
        patch.preferred_drink_unit = isDrinkUnit(unit) ? unit : null;
    }
    return patch;
}

function optionList(
    values: readonly string[],
    selected: string,
    labels?: Record<string, string>,
): string {
    const blank =
        selected === ""
            ? `<option value="" selected>Not set</option>`
            : `<option value="">Not set</option>`;
    const opts = values
        .map((value) => {
            const sel = value === selected ? " selected" : "";
            const label = labels?.[value] ?? value;
            return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(label)}</option>`;
        })
        .join("");
    return `${blank}${opts}`;
}

export function renderSettingsPage(view: SettingsPageView): string {
    const themeLight = view.chrome.theme === "light" ? " checked" : "";
    const themeDark = view.chrome.theme === "dark" ? " checked" : "";
    const current = view.selectedSwatch ?? "sky";
    const swatches = SWATCH_ORDER.map((name) => {
        const checked = name === current ? " checked" : "";
        const color = ACCENT_SWATCHES[name].light;
        return `<label class="swatch">
            <input type="radio" name="accent_swatch" value="${name}"${checked} />
            <span class="swatch-chip" style="background:${color}"></span>
            ${escapeHtml(name)}
        </label>`;
    }).join("");
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const localeLabels = Object.fromEntries(
        SITE_LOCALES.map((code) => [code, LOCALE_NAMES[code as SiteLocale]]),
    );
    const widgetsChecked = view.widgetsEnabled ? " checked" : "";
    const alcoholChecked = view.alcoholTrackingEnabled ? " checked" : "";
    const body = `
        <h1>Settings</h1>
        ${error}
        <p class="settings-lead"><a href="/settings/household">Household</a></p>
        <form method="POST" action="/settings" class="appearance">
            <input type="hidden" name="group" value="account" />
            <fieldset>
                <legend>Account</legend>
                <label for="display_name">Display name</label>
                <input id="display_name" name="display_name" value="${escapeHtml(view.displayName)}" maxlength="80" autocomplete="nickname" />
            </fieldset>
            <fieldset>
                <legend>Theme</legend>
                <label><input type="radio" name="theme" value="light"${themeLight} /> Light</label>
                <label><input type="radio" name="theme" value="dark"${themeDark} /> Dark</label>
            </fieldset>
            <fieldset>
                <legend>App color</legend>
                <div class="swatches">${swatches}</div>
            </fieldset>
            <button type="submit">Save account</button>
        </form>
        <form method="POST" action="/settings" class="appearance nutrition-prefs">
            <input type="hidden" name="group" value="nutrition" />
            <fieldset>
                <legend>Nutrition prefs</legend>
                <label for="timezone">Timezone</label>
                <input id="timezone" name="timezone" value="${escapeHtml(view.timezone)}" placeholder="America/Los_Angeles" autocomplete="off" />
                <label for="locale">Language</label>
                <select id="locale" name="locale">${optionList(SITE_LOCALES, view.locale, localeLabels)}</select>
                <label for="preferred_weight_unit">Weight unit</label>
                <select id="preferred_weight_unit" name="preferred_weight_unit">${optionList(WEIGHT_UNITS, view.weightUnit)}</select>
                <label><input type="checkbox" name="widgets_enabled" value="true"${widgetsChecked} /> Show in-chat widgets</label>
                <label><input type="checkbox" name="alcohol_tracking_enabled" value="true"${alcoholChecked} /> Alcohol tracking</label>
                <label for="preferred_drink_unit">Drink unit</label>
                <select id="preferred_drink_unit" name="preferred_drink_unit">${optionList(DRINK_UNITS, view.drinkUnit, { us: "US drinks", uk: "UK units" })}</select>
            </fieldset>
            <button type="submit">Save nutrition prefs</button>
        </form>
    `;
    return renderAppShell({
        title: "Settings",
        active: "settings",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}
